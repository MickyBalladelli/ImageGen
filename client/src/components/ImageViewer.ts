import { component, computed, effect, html, signal } from '@mickyballadelli/matrix';
import { ButtonComponent as Button, SpinnerComponent, CopyIcon, DownloadIcon, ImageIcon } from '@mickyballadelli/prism';
import { Logo } from './Logo';
import { enhancedPromptSignal, imageUrlSignal, isLoadingSignal, errorSignal, resultSignal, elapsedSignal, generationProgressSignal, progressSamplesSignal, providerNameSignal, widthSignal, heightSignal, stepsSignal, quantizeSignal } from '../state';

function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}:${String(remainder).padStart(2, '0')}` : `${remainder}s`;
}

export function ImageViewer() {
  const imageReady = signal(false);
  const copyStatus = signal('');
  const previewUrl = signal('');
  effect(() => {
    const dataUrl = imageUrlSignal.get();
    imageReady.set(false); copyStatus.set(''); previewUrl.set('');
    if (!dataUrl) return;
    const [header, encoded] = dataUrl.split(',');
    const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: header.slice(5, -7) }));
    previewUrl.set(url);
    return () => URL.revokeObjectURL(url);
  });
  async function copyPrompt() {
    const prompt = enhancedPromptSignal.get();
    try { await navigator.clipboard.writeText(prompt); if (enhancedPromptSignal.get() === prompt) copyStatus.set('Prompt copied.'); }
    catch { copyStatus.set('Copy is unavailable. Select the prompt text and copy it manually.'); }
  }
  const dimensions = computed(() => {
    const settings = resultSignal.get()?.settings;
    return settings ? `${settings.width} × ${settings.height}` : `${widthSignal.get()} × ${heightSignal.get()}`;
  });
  const elapsed = computed(() => `${Math.floor(elapsedSignal.get() / 60)}:${String(elapsedSignal.get() % 60).padStart(2, '0')}`);
  const remaining = computed(() => {
    const progress = generationProgressSignal.get();
    const samples = progressSamplesSignal.get().slice(-8);
    const step = progress?.step;
    const totalSteps = progress?.totalSteps;
    if (progress?.phase !== 'rendering' || typeof step !== 'number' || typeof totalSteps !== 'number'
        || !Number.isInteger(step) || !Number.isInteger(totalSteps)
        || step >= totalSteps || samples.length < 2) return null;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const stepCount = last.step - first.step;
    if (stepCount < 1) return null;
    const secondsPerStep = (last.at - first.at) / 1000 / stepCount;
    return Math.max(1, Math.round((totalSteps - step) * secondsPerStep));
  });
  const progressLabel = computed(() => {
    const progress = generationProgressSignal.get();
    if (progress?.phase === 'refining') return 'Refining prompt…';
    if (progress?.phase === 'loading') return 'Loading model…';
    if (progress?.phase === 'saving') return 'Saving image…';
    if (progress?.phase === 'rendering' && Number.isInteger(progress.step) && Number.isInteger(progress.totalSteps)) {
      const eta = remaining.get();
      return eta ? `Step ${progress.step} / ${progress.totalSteps} · ~${formatDuration(eta)} left` : `Step ${progress.step} / ${progress.totalSteps}`;
    }
    return 'Rendering…';
  });

  return html`<section class="result" aria-label="Image result">
    <div class="canvas-toolbar"><h2>${ImageIcon()} Your canvas</h2><div><span class="canvas-dimensions">${dimensions}</span><span class="canvas-status">${computed(() => isLoadingSignal.get() ? 'Rendering' : imageReady.get() ? 'Complete' : 'Preview')}</span></div></div>
    <div class="feedback" role="alert">${computed(() => errorSignal.get() ? html`<p class="error-message">${errorSignal.get()}</p>` : null)}</div>
    <div class=${computed(() => `image-stage ${imageReady.get() ? 'has-image' : ''}`)} aria-busy=${computed(() => String(isLoadingSignal.get()))}>
      <span class="canvas-corner corner-tl" aria-hidden="true"></span><span class="canvas-corner corner-tr" aria-hidden="true"></span><span class="canvas-corner corner-bl" aria-hidden="true"></span><span class="canvas-corner corner-br" aria-hidden="true"></span>
      ${computed(() => {
        if (isLoadingSignal.get()) return html`<div class="placeholder loading-placeholder" role="status"><div class="loading-orbit">${SpinnerComponent({ ariaLabel: 'Generating image' })}</div><span class="elapsed-time">${elapsed}</span><span class="generation-progress" aria-live="polite">${progressLabel}</span><h3>Bringing the scene to life.</h3><p>Loading the model and rendering on your machine.<br />The first image can take several minutes.</p><div class="indeterminate-track" aria-hidden="true"><span></span></div></div>`;
        const url = previewUrl.get();
        if (url) return html`<img src=${url} alt="Generated image" @load=${() => imageReady.set(true)} @error=${() => { imageReady.set(false); errorSignal.set('The image could not be displayed. Try generating it again.'); }} />`;
        return html`<div class="placeholder empty-placeholder"><div class="canvas-emblem"><span></span><span></span>${Logo()}</div><h3>The next frame is yours.</h3><p>Describe a scene, shape the settings,<br />and see where your imagination goes.</p><div class="canvas-empty-tags"><span>${dimensions} px</span><span>${computed(() => `${stepsSignal.get()} steps`)}</span><span>${computed(() => `${quantizeSignal.get()}-bit`)}</span></div></div>`;
      })}
    </div>
    <div class="canvas-bottom-bar"><span>${providerNameSignal}</span><span>${computed(() => imageReady.get() ? 'PNG / ready to save' : 'Image output appears here')}</span></div>
    ${computed(() => {
      const url = previewUrl.get();
      if (!url || !imageReady.get()) return null;
      const result = resultSignal.get();
      const filename = result?.filename ?? result?.settings?.output ?? 'imagegen.png';
      return html`<div class="download-row"><div><strong>Image ready</strong><p class="field-hint">${result?.savedFile ? `Saved to ${result.savedFile}` : 'Download a copy to your device.'}</p></div><a class="download-link" href=${url} download=${filename}>${DownloadIcon()} Download image</a></div>`;
    })}
    ${computed(() => enhancedPromptSignal.get() ? html`<section class="enhanced-prompt" aria-label="Enhanced prompt"><div class="section-heading"><h3>${resultSignal.get()?.promptRefined ? 'Refined prompt' : 'Generation prompt'}</h3>${Button({ label: 'Copy prompt', icon: CopyIcon(), variant: 'secondary', size: 'small', class: 'quiet-button', onClick: () => { void copyPrompt(); } })}</div><p class="prompt-text">${enhancedPromptSignal}</p><p class="copy-status muted" role="status">${copyStatus}</p>${resultSignal.get()?.settings ? html`<div class="result-settings"><span>Seed ${resultSignal.get()?.settings?.seed}</span><span>${resultSignal.get()?.settings?.steps} steps</span><span>${resultSignal.get()?.settings?.quantize}-bit</span></div>` : null}</section>` : null)}
    <div class="canvas-note"><span class="note-symbol" aria-hidden="true">i</span><p>Start small, then explore. Larger images and higher precision need more memory.</p></div>
  </section>`;
}
export const ImageViewerComponent = () => component(ImageViewer);
