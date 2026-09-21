export interface Config {
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
  return {
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
    steps: integer('IMAGE_STEPS', 25, 1, 100),
  };
}
