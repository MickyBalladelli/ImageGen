import { component, computed, html } from '@mickyballadelli/matrix';
import { ButtonComponent as Button, CloseIcon } from '@mickyballadelli/prism';
import {
  createPromptHistory,
  deletePromptHistory,
  editingPromptIdSignal,
  isLoadingSignal,
  promptHistorySignal,
  readPromptHistory,
  updatePromptHistory,
  userPromptSignal,
  clearPromptHistory,
} from '../state';

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(timestamp);
}

export function PromptHistory() {
  function saveCurrent() {
    createPromptHistory(userPromptSignal.get());
  }
  function editPrompt(id: string, prompt: string) {
    userPromptSignal.set(prompt);
    editingPromptIdSignal.set(id);
  }
  function usePrompt(prompt: string) {
    userPromptSignal.set(prompt);
    editingPromptIdSignal.set(null);
  }
  function saveEdit() {
    const id = editingPromptIdSignal.get();
    if (!id || !updatePromptHistory(id, userPromptSignal.get())) return;
    editingPromptIdSignal.set(null);
  }
  function clearHistory() {
    clearPromptHistory();
  }

  return html`<section class="prompt-history" aria-label="Prompt history">
    <div class="section-heading"><h2>Prompt history</h2><div class="history-heading-actions">${Button({ type: 'button', label: 'Save current', size: 'small', variant: 'secondary', class: 'quiet-button', disabled: computed(() => isLoadingSignal.get() || !userPromptSignal.get().trim()), onClick: saveCurrent })}${Button({ type: 'button', label: 'Clear', size: 'small', variant: 'secondary', class: 'quiet-button', disabled: computed(() => isLoadingSignal.get() || readPromptHistory().length === 0), onClick: clearHistory })}</div></div>
    ${computed(() => {
      const history = promptHistorySignal.get();
      if (!history.length) return html`<p class="history-empty">Saved prompts appear here.</p>`;
      return html`<div class="history-list">${history.map(item => html`<article class="history-item"><p class="history-prompt">${item.prompt}</p><div class="history-meta"><time datetime=${new Date(item.updatedAt).toISOString()}>${formatDate(item.updatedAt)}</time><div class="history-actions">${Button({ type: 'button', label: 'Use', size: 'small', variant: 'secondary', class: 'history-action', disabled: isLoadingSignal, onClick: () => usePrompt(item.prompt) })}${Button({ type: 'button', label: 'Edit', size: 'small', variant: 'secondary', class: 'history-action', disabled: isLoadingSignal, onClick: () => editPrompt(item.id, item.prompt) })}${Button({ type: 'button', label: 'Delete', ariaLabel: `Delete prompt: ${item.prompt}`, icon: CloseIcon(), showLabel: false, size: 'small', variant: 'secondary', class: 'history-delete quiet-button', disabled: isLoadingSignal, onClick: () => deletePromptHistory(item.id) })}</div></div></article>`)}</div>`;
    })}
    ${computed(() => editingPromptIdSignal.get() ? html`<div class="history-editing" role="status"><span>Editing saved prompt. Change the text above.</span><div>${Button({ type: 'button', label: 'Save changes', size: 'small', variant: 'secondary', disabled: computed(() => isLoadingSignal.get() || !userPromptSignal.get().trim()), onClick: saveEdit })}${Button({ type: 'button', label: 'Cancel', size: 'small', variant: 'secondary', class: 'quiet-button', disabled: isLoadingSignal, onClick: () => editingPromptIdSignal.set(null) })}</div></div>` : null)}
  </section>`;
}

export const PromptHistoryComponent = () => component(PromptHistory);
