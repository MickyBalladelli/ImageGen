import { component, computed, effect, html, signal } from '@mickyballadelli/matrix';
import { ButtonComponent as PrismButton, SpinnerComponent } from '@mickyballadelli/prism';
import { enhancedPromptSignal, imageUrlSignal, isLoadingSignal, errorSignal } from '../state';

export function ImageViewer() {
  const imageReady = signal(false);
  const copyStatus = signal('');
  const previewUrl = signal('');
  effect(() => {
    const dataUrl = imageUrlSignal.get();
    imageReady.set(false);
    copyStatus.set('');
    previewUrl.set('');
    if (!dataUrl) return;
    // Matrix rejects dynamic data: URLs. Convert validated raster data into a
    // scoped Blob URL rather than bypassing the renderer's URL safety checks.
    const [header, encoded] = dataUrl.split(',');
    const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: header.slice(5, -7) }));
    previewUrl.set(url);
    return () => URL.revokeObjectURL(url);
  });

  async function copyPrompt() {
    const prompt = enhancedPromptSignal.get();
    try {
      await navigator.clipboard.writeText(prompt);
      if (enhancedPromptSignal.get() === prompt) copyStatus.set('Prompt copied.');
    } catch {
      copyStatus.set('Copy is unavailable. Select the prompt text and copy it manually.');
    }
  }

  return html`<section class="result" aria-label="Image result">
    <div class="section-heading"><h2>Your image</h2><span class="muted">${computed(() => isLoadingSignal.get() ? 'Working' : imageReady.get() ? 'Ready' : 'Preview')}</span></div>
    <div class="feedback" role="alert">${computed(() => errorSignal.get() ? html`<p class="error-message">${errorSignal.get()}</p>` : null)}</div>
    <div class="image-stage" aria-busy=${computed(() => String(isLoadingSignal.get()))}>
      ${computed(() => {
        if (isLoadingSignal.get()) return html`<div class="placeholder" role="status">${SpinnerComponent({ ariaLabel: 'Generating image' })}<h3>From idea to image</h3><p>Refining your prompt, then rendering.<br />This may take a few minutes on local hardware.</p></div>`;
        const url = imageUrlSignal.get();
        if (url) return html`<img src=${url} alt="Generated image" @load=${() => imageReady.set(true)} @error=${() => { imageReady.set(false); errorSignal.set('The image could not be displayed. Try generating it again.'); }} />`;
        return html`<div class="placeholder"><svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true"><rect x="6" y="6" width="44" height="44" rx="7" stroke="currentColor" stroke-width="1.5"/><circle cx="20" cy="20" r="4" stroke="currentColor" stroke-width="1.5"/><path d="m9 42 13-13 9 9 6-7 10 11" stroke="currentColor" stroke-width="1.5"/></svg><h3>A space for your next idea</h3><p>Describe a scene and generate your first image.</p></div>`;
      })}
    </div>
    ${computed(() => {
      const url = imageUrlSignal.get();
      if (!url || !imageReady.get()) return null;
      const extension = url.startsWith('data:image/jpeg') ? 'jpg' : url.startsWith('data:image/webp') ? 'webp' : 'png';
      return html`<div class="download-row"><span class="muted">Generated with Stable Diffusion</span><a class="download-link" href=${url} download=${`imagegen.${extension}`}>Download image</a></div>`;
    })}
    ${computed(() => enhancedPromptSignal.get() ? html`<section class="enhanced-prompt" aria-label="Enhanced prompt"><div class="section-heading"><h3>Refined prompt</h3>${PrismButton({ label: 'Copy prompt', variant: 'secondary', size: 'small', onClick: () => { void copyPrompt(); } })}</div><p class="prompt-text">${enhancedPromptSignal}</p><p class="copy-status muted" role="status">${copyStatus}</p></section>` : null)}
  </section>`;
}

export const ImageViewerComponent = () => component(ImageViewer);
