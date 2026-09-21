import { homedir } from 'node:os';
import { resolve } from 'node:path';

export interface Config {
  imageProvider: 'mflux' | 'stable-diffusion';
  promptRefinement: 'none' | 'ollama';
  mfluxBinary: string;
  outputDirectory: string;
  mfluxTimeoutMs: number;
  host: string;
  port: number;
  allowedOrigins: string[];
  ollamaHost: string;
  ollamaModel: string;
  imageApiUrl: string;
  imageApiUsername: string;
  imageApiPassword: string;
  ollamaTimeoutMs: number;
  imageTimeoutMs: number;
  maxConcurrent: number;
  width: number;
  height: number;
  steps: number;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const integer = (key: string, fallback: number, min: number, max: number) => {
    const value = Number(env[key] ?? fallback);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(`${key} must be an integer between ${min} and ${max}.`);
    }
    return value;
  };
  const url = (key: string, fallback: string) => {
    const parsed = new URL(env[key] || fallback);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
      throw new Error(`${key} must be an HTTP(S) URL without embedded credentials.`);
    }
    return parsed.toString().replace(/\/$/, '');
  };
  const width = integer('IMAGE_WIDTH', 512, 64, 2048);
  const height = integer('IMAGE_HEIGHT', 512, 64, 2048);
  if (width % 8 || height % 8) throw new Error('Image dimensions must be multiples of 8.');
  const imageProvider = env.IMAGE_PROVIDER || 'mflux';
  if (!['mflux', 'stable-diffusion'].includes(imageProvider)) throw new Error('IMAGE_PROVIDER must be mflux or stable-diffusion.');
  const promptRefinement = env.PROMPT_REFINEMENT || (imageProvider === 'mflux' ? 'none' : 'ollama');
  if (!['none', 'ollama'].includes(promptRefinement)) throw new Error('PROMPT_REFINEMENT must be none or ollama.');
  const localPath = (value: string) => resolve(value.startsWith('~/') ? `${homedir()}/${value.slice(2)}` : value);
  return {
    imageProvider: imageProvider as Config['imageProvider'],
    promptRefinement: promptRefinement as Config['promptRefinement'],
    mfluxBinary: localPath(env.MFLUX_BINARY || '~/.local/bin/mflux-generate-qwen-2.1'),
    outputDirectory: localPath(env.OUTPUT_DIRECTORY || '~/Desktop'),
    mfluxTimeoutMs: integer('MFLUX_TIMEOUT_MS', 1800000, 1, 3600000),
    host: env.HOST || '127.0.0.1',
    port: integer('PORT', 3000, 1, 65535),
    allowedOrigins: (env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
      .split(',').map(origin => new URL(origin.trim()).origin),
    ollamaHost: url('OLLAMA_HOST', 'http://127.0.0.1:11434'),
    ollamaModel: env.OLLAMA_MODEL?.trim() || 'llama3',
    imageApiUrl: url('IMAGE_API_URL', 'http://127.0.0.1:7860'),
    imageApiUsername: env.IMAGE_API_USERNAME || '',
    imageApiPassword: env.IMAGE_API_PASSWORD || '',
    ollamaTimeoutMs: integer('OLLAMA_TIMEOUT_MS', 120000, 1, 600000),
    imageTimeoutMs: integer('IMAGE_TIMEOUT_MS', 180000, 1, 600000),
    maxConcurrent: integer('MAX_CONCURRENT_GENERATIONS', 1, 1, 10),
    width, height,
    steps: integer('IMAGE_STEPS', imageProvider === 'mflux' ? 40 : 25, 1, 100),
  };
}
