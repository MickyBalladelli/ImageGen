export interface GenerationSettings {
  width: number; height: number; steps: number; seed: number;
  quantize: 3 | 4 | 5 | 6 | 8; lowRam: boolean; output: string;
}
export interface GenerationResult {
  enhancedPrompt: string; imageUrl: string; error: null;
  settings?: GenerationSettings; provider?: string; promptRefined?: boolean;
  savedFile?: string; filename?: string;
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

export async function generateImage(userPrompt: string, signal: AbortSignal, settings: GenerationSettings): Promise<GenerationResult> {
  const response = await fetch('/api/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userPrompt, settings }), signal,
  });
  let data: unknown;
  try { data = await response.json(); }
  catch { throw new Error('The server returned an unreadable response. Check that the API is running.'); }
  const body = data as Partial<GenerationResult> | null;
  if (!response.ok) throw new Error(typeof body?.error === 'string' ? body.error : `Generation failed (HTTP ${response.status}).`);
  if (typeof body?.enhancedPrompt !== 'string' || !body.enhancedPrompt.trim()
      || typeof body?.imageUrl !== 'string'
      || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(body.imageUrl)
      || body.error !== null) throw new Error('The server returned an incomplete or invalid image result.');
  return body as GenerationResult;
}
