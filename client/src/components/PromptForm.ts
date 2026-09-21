import { batch, component, computed, html, onUnmount } from '@mickyballadelli/matrix';
import { ButtonComponent as Button, SparkIcon, CloseIcon } from '@mickyballadelli/prism';
import { generateImage } from '../api';
import { GenerationSettingsComponent } from './GenerationSettings';
import { userPromptSignal, enhancedPromptSignal, imageUrlSignal, isLoadingSignal, errorSignal, resultSignal, runtimeSignal, elapsedSignal, getSettings, settingsErrorSignal } from '../state';

export function PromptForm() {
  let activeController: AbortController | undefined;
  onUnmount(() => activeController?.abort());

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (isLoadingSignal.get()) return;
    const prompt = userPromptSignal.get().trim();
    if (!prompt || prompt.length > 2000) { errorSignal.set('Describe an image in 1–2000 characters.'); return; }
    if (settingsErrorSignal.get()) { errorSignal.set(settingsErrorSignal.get()); return; }
    const settings = getSettings();
    const controller = new AbortController();
    activeController = controller;
    const timeout = setTimeout(() => controller.abort('timeout'), runtimeSignal.get()?.timeoutMs ?? 3735000);
    const start = performance.now();
    const clock = setInterval(() => elapsedSignal.set(Math.floor((performance.now() - start) / 1000)), 1000);
    batch(() => {
      isLoadingSignal.set(true); errorSignal.set(null); resultSignal.set(null);
      enhancedPromptSignal.set(''); imageUrlSignal.set(''); elapsedSignal.set(0);
    });
    try {
      const result = await generateImage(prompt, controller.signal, settings);
      batch(() => {
        resultSignal.set(result); enhancedPromptSignal.set(result.enhancedPrompt); imageUrlSignal.set(result.imageUrl);
      });
    } catch (error) {
      errorSignal.set(controller.signal.aborted
        ? controller.signal.reason === 'timeout' ? 'Generation timed out. Please try again.' : 'Generation cancelled.'
        : error instanceof TypeError ? 'Cannot reach the server. Check your connection and try again.'
        : error instanceof Error ? error.message : 'Generation failed. Please try again.');
    } finally {
      clearTimeout(timeout); clearInterval(clock);
      activeController = undefined; isLoadingSignal.set(false);
    }
  }
  function keyboardSubmit(event: KeyboardEvent) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault(); (event.currentTarget as HTMLTextAreaElement).form?.requestSubmit();
    }
  }
  return html`<form class="prompt-form" @submit=${submit} novalidate>
    <section class="prompt-panel">
      <div class="section-heading"><h1>Describe the scene.</h1><span class="tiny-chip">Text to image</span></div>
      <p id="prompt-help" class="muted">The subject. The light. The little details.</p>
      <label for="user-prompt" class="sr-only">Describe your image</label>
      <textarea id="user-prompt" name="userPrompt" rows="5" maxlength="2000" placeholder="An astronaut cat exploring a moonlit greenhouse…" aria-describedby="prompt-help prompt-count" use:bind=${userPromptSignal} ?disabled=${isLoadingSignal} @keydown=${keyboardSubmit}></textarea>
      <div class="form-meta"><span>⌘ / Ctrl + Enter to generate</span><span id="prompt-count">${computed(() => `${userPromptSignal.get().length} / 2000`)}</span></div>
      <div class="prompt-examples" aria-label="Prompt ideas">${[
        { label: 'Lunar greenhouse', prompt: 'An astronaut cat exploring a moonlit greenhouse, condensation on the glass, silver foliage, cinematic illustration' },
        { label: 'Coastal architecture', prompt: 'A sculptural concrete house above a turquoise sea, warm afternoon light, architectural photography' },
        { label: 'Botanical study', prompt: 'An intricate botanical illustration of luminous wildflowers on deep navy paper, fine silver ink, delicate textures' },
      ].map(example => Button({ label: example.label, variant: 'secondary', size: 'small', class: 'example-button', disabled: isLoadingSignal, onClick: () => userPromptSignal.set(example.prompt) }))}</div>
    </section>
    ${GenerationSettingsComponent()}
    <div class="generate-footer">
      ${Button({ type: 'submit', label: 'Generate image', icon: SparkIcon(), fullWidth: true, class: 'generate-button', loading: isLoadingSignal, loadingLabel: 'Generating…' })}
      ${computed(() => isLoadingSignal.get() ? Button({ label: 'Cancel', icon: CloseIcon(), variant: 'secondary', class: 'cancel-button', onClick: () => activeController?.abort() }) : null)}
      <p>${computed(() => runtimeSignal.get()?.imageProvider === 'stable-diffusion' ? 'Using the configured Stable Diffusion service.' : 'Runs on your Mac. No image-generation credits.')}</p>
    </div>
  </form>`;
}

export const PromptFormComponent = () => component(PromptForm);
