import { batch, component, computed, html, signal, type Signal } from '@mickyballadelli/matrix';
import { ButtonComponent as Button, CheckBoxComponent, SelectComponent, TextFieldComponent, SettingsIcon, TerminalIcon, CopyIcon } from '@mickyballadelli/prism';
import { widthSignal, heightSignal, stepsSignal, seedSignal, quantizeSignal, lowRamSignal, outputSignal, outputDirectorySignal, isLoadingSignal, commandSignal, settingsErrorSignal, resetSettings, runtimeSignal } from '../state';

function numberField(label: string, id: string, value: Signal<string | number>, suffix?: string) {
  return html`<div class="setting-field"><label for=${id}>${label}</label><div class="number-field">${TextFieldComponent({ id, value, type: 'number', inputMode: 'numeric', disabled: isLoadingSignal })}${suffix ? html`<span class="field-unit">${suffix}</span>` : null}</div></div>`;
}

export function GenerationSettings() {
  const copyStatus = signal('');
  function preset(width: number, height: number) { batch(() => { widthSignal.set(String(width)); heightSignal.set(String(height)); }); }
  async function copyCommand() {
    try { await navigator.clipboard.writeText(commandSignal.get()); copyStatus.set('Command copied.'); }
    catch { copyStatus.set('Select the command to copy it manually.'); }
  }
  const legacy = computed(() => runtimeSignal.get()?.imageProvider === 'stable-diffusion');
  return html`<section class="settings-panel" aria-label="Generation settings">
    <div class="section-heading"><h2>${SettingsIcon()} Generation settings</h2>${Button({ label: 'Reset', size: 'small', variant: 'secondary', class: 'quiet-button', disabled: isLoadingSignal, onClick: resetSettings })}</div>
    <div class="ratio-presets" role="group" aria-label="Image shape">
      ${[{ label: 'Square', width: 512, height: 512, shape: 'square' }, { label: 'Landscape', width: 768, height: 512, shape: 'landscape' }, { label: 'Portrait', width: 512, height: 768, shape: 'portrait' }].map(p => Button({
        label: p.label, icon: html`<span class="ratio-icon ${p.shape}" aria-hidden="true"></span>`,
        variant: 'secondary', size: 'small', class: 'preset-button', disabled: isLoadingSignal,
        pressed: computed(() => Number(widthSignal.get()) === p.width && Number(heightSignal.get()) === p.height),
        onClick: () => preset(p.width, p.height),
      }))}
    </div>
    <div class="field-grid dimensions">${numberField('Width', 'image-width', widthSignal, 'px')}${numberField('Height', 'image-height', heightSignal, 'px')}</div>
    <div class="field-grid">
      ${numberField('Steps', 'image-steps', stepsSignal)}
      <div class="setting-field"><div class="label-row"><label for="image-seed">Seed</label>${Button({ label: 'Random seed', ariaLabel: 'Randomize seed', showLabel: false, class: 'random-button quiet-button', size: 'small', variant: 'secondary', disabled: isLoadingSignal, icon: html`<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="3" y="3" width="14" height="14" rx="4" stroke="currentColor" stroke-width="1.4"/><circle cx="7" cy="7" r="1.2" fill="currentColor"/><circle cx="13" cy="13" r="1.2" fill="currentColor"/><circle cx="10" cy="10" r="1.2" fill="currentColor"/></svg>`, onClick: () => seedSignal.set(String(crypto.getRandomValues(new Uint32Array(1))[0])) })}</div>${TextFieldComponent({ id: 'image-seed', value: seedSignal, type: 'number', inputMode: 'numeric', disabled: isLoadingSignal })}</div>
    </div>
    <div class="setting-field quantization"><label for="image-quantize">Quantization</label>${SelectComponent({ id: 'image-quantize', ariaLabel: 'Quantization', value: quantizeSignal, disabled: computed(() => isLoadingSignal.get() || legacy.get()), options: [
      { value: '3', label: '3-bit · smallest' }, { value: '4', label: '4-bit · recommended' }, { value: '5', label: '5-bit' }, { value: '6', label: '6-bit' }, { value: '8', label: '8-bit · higher memory' },
    ] })}</div>
    <div class="memory-row">${CheckBoxComponent({ id: 'low-ram', checked: lowRamSignal, disabled: computed(() => isLoadingSignal.get() || legacy.get()), children: html`<span><strong>Low-memory mode</strong><small>Use less memory. Rendering may take longer.</small></span>` })}</div>
    <p class="memory-warning">${computed(() => Number(widthSignal.get()) * Number(heightSignal.get()) > 1048576 || Number(quantizeSignal.get()) > 4 || !lowRamSignal.get() ? 'Higher settings may exceed available memory on a 32 GB Mac.' : '512 px, 4-bit, and low-memory mode are a cautious starting point.')}</p>
    <div class="setting-field output-field"><label for="image-output">Output filename</label>${TextFieldComponent({ id: 'image-output', value: outputSignal, maxLength: 100, disabled: computed(() => isLoadingSignal.get() || legacy.get()) })}<p class="field-hint">${computed(() => legacy.get() ? 'Local file saving is available with MFLUX.' : html`Saved to <code>${outputDirectorySignal}</code>. Existing files are kept.`)}</p></div>
    <p class="settings-validation">${settingsErrorSignal}</p>
    <details class="command-details"><summary>${TerminalIcon()} Equivalent command <span aria-hidden="true">⌄</span></summary><div class="command-content"><pre><code>${commandSignal}</code></pre>${Button({ label: 'Copy command', icon: CopyIcon(), size: 'small', variant: 'secondary', disabled: computed(() => Boolean(settingsErrorSignal.get())), onClick: () => { void copyCommand(); } })}<p class="field-hint" role="status">${copyStatus}</p><p class="field-hint">The app saves through a temporary file and adds a suffix if the filename exists.</p></div></details>
  </section>`;
}

export const GenerationSettingsComponent = () => component(GenerationSettings);
