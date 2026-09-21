import type { Config } from './config.js';
import { AppError } from './errors.js';

export interface GenerationSettings {
  width: number;
  height: number;
  steps: number;
  seed: number;
  quantize: 3 | 4 | 5 | 6 | 8;
  lowRam: boolean;
  output: string;
}

export function parseSettings(value: unknown, config: Config): GenerationSettings {
  if (value !== undefined && (!value || typeof value !== 'object' || Array.isArray(value))) {
    throw new AppError(400, 'settings must be an object.');
  }
  const input = (value ?? {}) as Record<string, unknown>;
  const number = (name: string, fallback: number, min: number, max: number) => {
    const result = input[name] === undefined ? fallback : input[name];
    if (typeof result !== 'number' || !Number.isInteger(result) || result < min || result > max) {
      throw new AppError(400, `${name} must be an integer between ${min} and ${max}.`);
    }
    return result;
  };
  const width = number('width', config.width, 256, 2048);
  const height = number('height', config.height, 256, 2048);
  if (width % 32 || height % 32) throw new AppError(400, 'Width and height must be multiples of 32.');
  const quantize = number('quantize', 4, 3, 8);
  if (![3, 4, 5, 6, 8].includes(quantize)) throw new AppError(400, 'Quantization must be 3, 4, 5, 6, or 8 bits.');
  const lowRam = input.lowRam === undefined ? true : input.lowRam;
  if (typeof lowRam !== 'boolean') throw new AppError(400, 'lowRam must be a boolean.');
  const output = input.output === undefined ? 'qwen-test.png' : input.output;
  if (typeof output !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._ -]{0,95}\.png$/i.test(output)) {
    throw new AppError(400, 'Output must be a PNG filename, without folders or special characters.');
  }
  return {
    width, height, steps: number('steps', config.steps, 1, 100),
    seed: number('seed', 42, 0, 4294967295), quantize: quantize as GenerationSettings['quantize'],
    lowRam, output,
  };
}
