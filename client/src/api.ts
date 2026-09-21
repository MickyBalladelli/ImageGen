export interface GenerationResult { enhancedPrompt: string; imageUrl: string; error: null }

export async function generateImage(userPrompt: string, signal: AbortSignal): Promise<GenerationResult> {
  const response = await fetch('/api/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userPrompt }), signal,
  });
  let data: unknown;
  try { data = await response.json(); }
  catch { throw new Error('The server returned an unreadable response. Check that the API is running.'); }
  const body = data as Partial<GenerationResult> | null;
  if (!response.ok) {
    throw new Error(typeof body?.error === 'string' ? body.error : `Generation failed (HTTP ${response.status}).`);
  }
  // This provider returns inline raster images, never arbitrary remote URLs/SVG.
  if (typeof body?.enhancedPrompt !== 'string' || !body.enhancedPrompt.trim()
      || typeof body?.imageUrl !== 'string'
      || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(body.imageUrl)
      || body.error !== null) {
    throw new Error('The server returned an incomplete or invalid image result.');
  }
  return body as GenerationResult;
}
