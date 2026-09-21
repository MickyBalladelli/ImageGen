export interface GenerationSettings {
  width: number; height: number; steps: number; seed: number;
  quantize: 3 | 4 | 5 | 6 | 8; lowRam: boolean; output: string;
}
export interface GenerationResult {
  enhancedPrompt: string; imageUrl: string; error: null;
  settings?: GenerationSettings; provider?: string; promptRefined?: boolean;
  savedFile?: string; filename?: string;
}
export interface GenerationProgress {
  phase: 'refining' | 'loading' | 'rendering' | 'saving';
  step?: number; totalSteps?: number;
}
export interface RuntimeInfo {
  status: string; model: string; imageProvider: 'mflux' | 'stable-diffusion';
  runtimeInstalled: boolean | null; outputDirectory: string; timeoutMs: number;
  promptRefinement: 'none' | 'ollama';
}

export async function getRuntime(signal: AbortSignal): Promise<RuntimeInfo> {
  const response = await fetch('/api/health', { signal });
  if (!response.ok) throw new Error('Server unavailable');
  const data = await response.json() as RuntimeInfo;
  if (!['mflux', 'stable-diffusion'].includes(data.imageProvider)) throw new Error('Unknown runtime');
  return data;
}

function parseGenerationResult(data: unknown): GenerationResult {
  const body = data as Partial<GenerationResult> | null;
  if (typeof body?.enhancedPrompt !== 'string' || !body.enhancedPrompt.trim()
      || typeof body?.imageUrl !== 'string'
      || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(body.imageUrl)
      || body.error !== null) throw new Error('The server returned an incomplete or invalid image result.');
  return body as GenerationResult;
}

function parseProgress(data: unknown): GenerationProgress {
  const progress = data as Partial<GenerationProgress> | null;
  if (!progress || !['refining', 'loading', 'rendering', 'saving'].includes(progress.phase ?? '')) {
    throw new Error('The server returned invalid generation progress.');
  }
  return progress as GenerationProgress;
}

export async function generateImage(
  userPrompt: string,
  signal: AbortSignal,
  settings: GenerationSettings,
  onProgress: (progress: GenerationProgress) => void = () => {},
): Promise<GenerationResult> {
  const response = await fetch('/api/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ userPrompt, settings }), signal,
  });
  if (!response.ok) {
    let data: unknown;
    try { data = await response.json(); }
    catch { throw new Error('The server returned an unreadable response. Check that the API is running.'); }
    const body = data as Partial<GenerationResult> | null;
    throw new Error(typeof body?.error === 'string' ? body.error : `Generation failed (HTTP ${response.status}).`);
  }
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    let data: unknown;
    try { data = await response.json(); }
    catch { throw new Error('The server returned an unreadable response. Check that the API is running.'); }
    return parseGenerationResult(data);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('The server returned an empty generation stream.');
  const decoder = new TextDecoder();
  let buffer = '';
  let result: GenerationResult | null = null;
  try {
    const handleBlock = (block: string) => {
      let event = 'message';
      let data = '';
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (!data) return;
      let payload: unknown;
      try { payload = JSON.parse(data); }
      catch { throw new Error('The server returned an unreadable generation event.'); }
      if (event === 'progress') onProgress(parseProgress(payload));
      else if (event === 'complete') result = parseGenerationResult(payload);
      else if (event === 'error') {
        const error = payload as { error?: unknown } | null;
        throw new Error(typeof error?.error === 'string' ? error.error : 'Generation failed.');
      }
    };
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? '';
      for (const block of blocks) handleBlock(block);
      if (done) break;
    }
    if (buffer.trim()) handleBlock(buffer);
  } finally {
    reader.releaseLock();
  }
  if (!result) throw new Error('The server ended the generation before returning an image.');
  return result;
}
