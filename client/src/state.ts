import { batch, computed, effect, signal } from '@mickyballadelli/matrix';
import type { GenerationProgress, GenerationResult, GenerationSettings, RuntimeInfo } from './api';

const settingsStorageKey = 'imagegen.generation-settings';
const promptHistoryStorageKey = 'imagegen.prompt-history';
type StoredSettings = Partial<GenerationSettings>;
export interface PromptHistoryItem {
  id: string;
  prompt: string;
  createdAt: number;
  updatedAt: number;
}

function readStoredSettings(): StoredSettings {
  try {
    const raw = localStorage.getItem(settingsStorageKey);
    if (!raw) return {};
    const value = JSON.parse(raw) as Record<string, unknown>;
    const validDimension = (input: unknown): input is number => typeof input === 'number' && Number.isInteger(input) && input >= 256 && input <= 2048 && input % 32 === 0;
    const validSteps = (input: unknown): input is number => typeof input === 'number' && Number.isInteger(input) && input >= 1 && input <= 100;
    const validSeed = (input: unknown): input is number => typeof input === 'number' && Number.isInteger(input) && input >= 0 && input <= 4294967295;
    return {
      width: validDimension(value.width) ? value.width : undefined,
      height: validDimension(value.height) ? value.height : undefined,
      steps: validSteps(value.steps) ? value.steps : undefined,
      seed: validSeed(value.seed) ? value.seed : undefined,
      quantize: [3, 4, 5, 6, 8].includes(value.quantize as number) ? value.quantize as GenerationSettings['quantize'] : undefined,
      lowRam: typeof value.lowRam === 'boolean' ? value.lowRam : undefined,
      output: typeof value.output === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._ -]{0,95}\.png$/i.test(value.output) ? value.output : undefined,
    };
  } catch {
    return {};
  }
}

const storedSettings = readStoredSettings();
function readStoredPromptHistory(): PromptHistoryItem[] {
  try {
    const raw = localStorage.getItem(promptHistoryStorageKey);
    if (!raw) return [];
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is PromptHistoryItem => {
      const entry = item as Partial<PromptHistoryItem> | null;
      return typeof entry?.id === 'string' && typeof entry.prompt === 'string' && Boolean(entry.prompt.trim())
        && typeof entry.createdAt === 'number' && typeof entry.updatedAt === 'number';
    }).slice(0, 30);
  } catch {
    return [];
  }
}

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
export const generationProgressSignal = signal<GenerationProgress | null>(null);
export const progressSamplesSignal = signal<Array<{ step: number; at: number }>>([]);
export const generationDurationSignal = signal<number | null>(null);
// Matrix's numeric input binding emits numbers after edits, strings on reset.
export const widthSignal = signal<string | number>(storedSettings.width ?? '512');
export const heightSignal = signal<string | number>(storedSettings.height ?? '512');
export const stepsSignal = signal<string | number>(storedSettings.steps ?? '40');
export const seedSignal = signal<string | number>(storedSettings.seed ?? '42');
export const quantizeSignal = signal(String(storedSettings.quantize ?? 4));
export const lowRamSignal = signal(storedSettings.lowRam ?? true);
export const outputSignal = signal(storedSettings.output ?? 'qwen-test.png');
export const promptHistorySignal = signal<PromptHistoryItem[]>(readStoredPromptHistory());
export const editingPromptIdSignal = signal<string | null>(null);
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

export function readPromptHistory() {
  return promptHistorySignal.get();
}

function promptId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `prompt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createPromptHistory(prompt: string) {
  const normalized = prompt.trim();
  if (!normalized) return null;
  const now = Date.now();
  const existing = promptHistorySignal.get().find(item => item.prompt === normalized);
  const item = existing
    ? { ...existing, updatedAt: now }
    : { id: promptId(), prompt: normalized, createdAt: now, updatedAt: now };
  promptHistorySignal.set([item, ...promptHistorySignal.get().filter(entry => entry.id !== item.id)].slice(0, 30));
  return item.id;
}

export function updatePromptHistory(id: string, prompt: string) {
  const normalized = prompt.trim();
  if (!normalized || !promptHistorySignal.get().some(item => item.id === id)) return false;
  const now = Date.now();
  promptHistorySignal.set(promptHistorySignal.get().map(item => item.id === id
    ? { ...item, prompt: normalized, updatedAt: now }
    : item));
  return true;
}

export function deletePromptHistory(id: string) {
  promptHistorySignal.set(promptHistorySignal.get().filter(item => item.id !== id));
  if (editingPromptIdSignal.get() === id) editingPromptIdSignal.set(null);
}

export function clearPromptHistory() {
  promptHistorySignal.set([]);
  editingPromptIdSignal.set(null);
}

effect(() => {
  try { localStorage.setItem(settingsStorageKey, JSON.stringify(getSettings())); }
  catch { /* Browser storage may be unavailable or full. */ }
});

effect(() => {
  try { localStorage.setItem(promptHistoryStorageKey, JSON.stringify(promptHistorySignal.get())); }
  catch { /* Browser storage may be unavailable or full. */ }
});

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
