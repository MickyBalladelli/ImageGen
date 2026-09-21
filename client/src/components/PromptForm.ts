import { batch, component, computed, html, onUnmount } from '@mickyballadelli/matrix';
import { ButtonComponent as PrismButton, TextFieldComponent as PrismInput } from '@mickyballadelli/prism';
import { generateImage } from '../api';
import { userPromptSignal, enhancedPromptSignal, imageUrlSignal, isLoadingSignal, errorSignal } from '../state';

export function PromptForm() {
  let activeController: AbortController | undefined;
  onUnmount(() => activeController?.abort());

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (isLoadingSignal.get()) return;
    const prompt = userPromptSignal.get().trim();
    if (!prompt || prompt.length > 2000) {
      errorSignal.set('Describe an image in 1–2000 characters.');
      return;
    }
    const controller = new AbortController();
    activeController = controller;
    // Leave room for both configurable backend stages (up to 10 minutes each).
    const timeout = setTimeout(() => controller.abort('timeout'), 1210000);
    batch(() => {
      isLoadingSignal.set(true);
      errorSignal.set(null);
      enhancedPromptSignal.set('');
      imageUrlSignal.set('');
    });
    try {
      const result = await generateImage(prompt, controller.signal);
      batch(() => {
        enhancedPromptSignal.set(result.enhancedPrompt);
        imageUrlSignal.set(result.imageUrl);
      });
    } catch (error) {
      errorSignal.set(controller.signal.aborted
        ? controller.signal.reason === 'timeout' ? 'Generation timed out. Please try again.' : 'Generation cancelled.'
        : error instanceof TypeError ? 'Cannot reach the server. Check your connection and try again.'
        : error instanceof Error ? error.message : 'Generation failed. Please try again.');
    } finally {
      clearTimeout(timeout);
      activeController = undefined;
      isLoadingSignal.set(false);
    }
  }

  return html`<form class="prompt-form" @submit=${submit} novalidate>
    <label for="user-prompt">Describe your image</label>
    <p id="prompt-help" class="muted">Start with a subject. Add a setting, mood, or style.</p>
    ${PrismInput({
      id: 'user-prompt', name: 'userPrompt', value: userPromptSignal,
      placeholder: 'An astronaut cat in a moonlit greenhouse',
      maxLength: 2000, required: true, disabled: isLoadingSignal,
      ariaDescribedBy: 'prompt-help prompt-count', autocomplete: 'off',
    })}
    <div class="form-meta"><span id="prompt-count">${computed(() => `${userPromptSignal.get().length} / 2000`)}</span></div>
    <div class="form-actions">
      ${PrismButton({ type: 'submit', label: 'Generate image', loading: isLoadingSignal, loadingLabel: 'Generating…' })}
      ${computed(() => isLoadingSignal.get() ? PrismButton({ label: 'Cancel', variant: 'secondary', onClick: () => activeController?.abort() }) : null)}
    </div>
    <p class="local-note">Ollama refines your words. Stable Diffusion creates the image.</p>
  </form>`;
}

export const PromptFormComponent = () => component(PromptForm);
