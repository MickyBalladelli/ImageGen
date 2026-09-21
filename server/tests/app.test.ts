import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../app.js';
import { readConfig } from '../config.js';
import { AppError } from '../errors.js';
import type { GenerationServices } from '../services.js';

const config = readConfig({});
const result = 'data:image/png;base64,iVBORw0KGgo=';
const services: GenerationServices = {
  enhance: async prompt => `Detailed ${prompt}`,
  generate: async () => result,
};

test('generation refines the trimmed prompt before rendering and keeps response contract', async () => {
  const calls: string[] = [];
  const app = createApp(config, {
    enhance: async prompt => { calls.push(prompt); return 'A detailed astronaut cat'; },
    generate: async prompt => { calls.push(prompt); return result; },
  });
  const response = await request(app).post('/api/generate').send({ userPrompt: ' An astronaut cat ' }).expect(200);
  assert.deepEqual(calls, ['An astronaut cat', 'A detailed astronaut cat']);
  assert.deepEqual(response.body, { enhancedPrompt: 'A detailed astronaut cat', imageUrl: result, error: null });
});

for (const userPrompt of [undefined, null, '', '   ', 123, {}, [], 'a'.repeat(2001)]) {
  test(`reject invalid userPrompt ${JSON.stringify(userPrompt)?.slice(0, 30)}`, async () => {
    const app = createApp(config, { ...services, enhance: async () => { throw new Error('Must not run'); } });
    const response = await request(app).post('/api/generate').send({ userPrompt }).expect(400);
    assert.equal(response.body.imageUrl, null);
  });
}

test('malformed JSON, oversized requests and unknown endpoints return JSON errors', async () => {
  const app = createApp(config, services);
  await request(app).post('/api/generate').set('Content-Type', 'application/json').send('{').expect(400);
  await request(app).post('/api/generate').send({ userPrompt: 'x'.repeat(20000) }).expect(413);
  await request(app).get('/api/missing').expect(404).expect('Content-Type', /json/);
});

test('central handler preserves public errors but conceals unexpected internals', async () => {
  for (const [error, expected] of [[new AppError(504, 'Ollama timed out.'), 504], [new Error('secret-token'), 500]] as const) {
    const app = createApp(config, { ...services, enhance: async () => { throw error; } });
    const response = await request(app).post('/api/generate').send({ userPrompt: 'cat' }).expect(expected);
    assert.ok(!JSON.stringify(response.body).includes('secret-token'));
  }
});

test('origin protection permits local client and rejects unrelated websites', async () => {
  const app = createApp(config, services);
  await request(app).post('/api/generate').set('Origin', 'https://untrusted.example').send({ userPrompt: 'cat' }).expect(403);
  await request(app).post('/api/generate').set('Origin', 'http://localhost:5173').send({ userPrompt: 'cat' }).expect(200);
});

test('concurrency guard rejects overlapping jobs and releases the slot afterward', async () => {
  let release!: () => void;
  let started!: () => void;
  const entered = new Promise<void>(resolve => { started = resolve; });
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const app = createApp(config, { ...services, enhance: async () => { started(); await waiting; return 'cat'; } });
  const first = request(app).post('/api/generate').send({ userPrompt: 'cat' }).then(res => res);
  await entered;
  await request(app).post('/api/generate').send({ userPrompt: 'cat' }).expect(429).expect('Retry-After', '5');
  release();
  assert.equal((await first).status, 200);
  await request(app).post('/api/generate').send({ userPrompt: 'cat' }).expect(200);
});

test('configuration rejects invalid ports, URL schemes, sizes and timeouts', () => {
  for (const env of [{ PORT: 'abc' }, { IMAGE_API_URL: 'file:///tmp/a' }, { IMAGE_WIDTH: '513' }, { OLLAMA_TIMEOUT_MS: '0' }]) {
    assert.throws(() => readConfig(env));
  }
  assert.equal(readConfig({}).port, 3000);
});
