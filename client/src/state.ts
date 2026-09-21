import { batch, computed, signal } from '@mickyballadelli/matrix';
import type { GenerationResult, GenerationSettings, RuntimeInfo } from './api';

export const userPromptSignal = signal('');
export const enhancedPromptSignal = signal('');
export const imageUrlSignal = signal('');
export const isLoadingSignal = signal(false);
export const errorSignal = signal<string | null>(null);
export const resultSignal = signal<GenerationResult | null>(null);
export const runtimeSignal = signal<RuntimeInfo | null>(null);
export const runtimeErrorSignal = signal(false);
export const motionSignal = signal(true);
export const elapsedSignal = signal(0);
// Matrix's numeric input binding emits numbers after edits, strings on reset.
export const widthSignal = signal<string | number>('512');
export const heightSignal = signal<string | number>('512');
export const stepsSignal = signal<string | number>('40');
export const seedSignal = signal<string | number>('42');
export const quantizeSignal = signal('4');
export const lowRamSignal = signal(true);
export const outputSignal = signal('qwen-test.png');
export const outputDirectorySignal = computed(() => runtimeSignal.get()?.outputDirectory ?? '~/Desktop');
export const providerNameSignal = computed(() => runtimeSignal.get()?.imageProvider === 'stable-diffusion' ? 'Stable Diffusion' : 'Qwen-Image 2.1');

export function getSettings(): GenerationSettings {
  return {
    width: Number(widthSignal.get()), height: Number(heightSignal.get()),
    steps: Number(stepsSignal.get()), seed: Number(seedSignal.get()),
    quantize: Number(quantizeSignal.get()) as GenerationSettings['quantize'],
    lowRam: lowRamSignal.get(), output: outputSignal.get().trim(),
  };
}

export const settingsErrorSignal = computed(() => {
  const settings = getSettings();
  if (![settings.width, settings.height].every(n => Number.isInteger(n) && n >= 256 && n <= 2048 && n % 32 === 0)) return 'Dimensions must be 256–2048 px, in multiples of 32.';
  if (!Number.isInteger(settings.steps) || settings.steps < 1 || settings.steps > 100) return 'Use 1–100 sampling steps.';
  if (!String(seedSignal.get()).trim() || !Number.isInteger(settings.seed) || settings.seed < 0 || settings.seed > 4294967295) return 'Seed must be an integer from 0 to 4294967295.';
  if (![3, 4, 5, 6, 8].includes(settings.quantize)) return 'Choose a supported quantization.';
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._ -]{0,95}\.png$/i.test(settings.output)) return 'Use a PNG filename without folders or special characters.';
  return null;
});

export function resetSettings() {
  batch(() => {
    widthSignal.set('512'); heightSignal.set('512'); stepsSignal.set('40'); seedSignal.set('42');
    quantizeSignal.set('4'); lowRamSignal.set(true); outputSignal.set('qwen-test.png');
  });
}

const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;
export const commandSignal = computed(() => {
  const s = getSettings();
  const directory = outputDirectorySignal.get();
  const path = directory.startsWith('~/') ? `"$HOME"/${quote(`${directory.slice(2)}/${s.output}`)}` : quote(`${directory}/${s.output}`);
  return [
    '~/.local/bin/mflux-generate-qwen-2.1',
    `  --prompt=${quote(userPromptSignal.get() || 'Describe your image')}`,
    `  --width ${s.width} --height ${s.height}`, `  --steps ${s.steps} --seed ${s.seed}`,
    `  --quantize ${s.quantize}${s.lowRam ? ' --low-ram' : ''}`, `  --output ${path}`,
  ].join(' \\\n');
});
