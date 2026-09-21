import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createServices, imageDataUrl, SYSTEM_PROMPT } from '../services.js';
import { readConfig } from '../config.js';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';
const signal = () => new AbortController().signal;

test('real Ollama SDK and SD HTTP adapter send expected payloads', async () => {
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  const upstream = createServer(async (req, res) => {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.from(chunk));
    const body = JSON.parse(Buffer.concat(chunks).toString());
    calls.push({ url: req.url!, body });
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(req.url === '/api/chat'
      ? { message: { role: 'assistant', content: ' A cinematic astronaut cat. ' }, done: true }
      : { images: [png] }));
  });
  upstream.listen(0, '127.0.0.1');
  await once(upstream, 'listening');
  try {
    const port = (upstream.address() as { port: number }).port;
    const url = `http://127.0.0.1:${port}`;
    const services = createServices(readConfig({ OLLAMA_HOST: url, IMAGE_API_URL: url }));
    const prompt = await services.enhance('An astronaut cat', signal());
    assert.equal(prompt, 'A cinematic astronaut cat.');
    assert.equal(await services.generate(prompt, signal()), `data:image/png;base64,${png}`);
    assert.equal(calls[0].url, '/api/chat');
    assert.deepEqual(calls[0].body.messages, [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: 'An astronaut cat' }]);
    assert.equal(calls[1].url, '/sdapi/v1/txt2img');
    assert.equal(calls[1].body.prompt, prompt);
    assert.equal(calls[1].body.batch_size, 1);
  } finally { upstream.closeAllConnections(); await new Promise<void>(resolve => upstream.close(() => resolve())); }
});

test('image validation accepts raster data and rejects missing images, SVG and URLs', () => {
  assert.equal(imageDataUrl(png), `data:image/png;base64,${png}`);
  assert.equal(imageDataUrl(`data:image/png;base64,${png}`), `data:image/png;base64,${png}`);
  for (const value of [undefined, '', 'https://example.com/image.png', Buffer.from('<svg/>').toString('base64'), 'a!']) {
    assert.throws(() => imageDataUrl(value));
  }
});

test('upstream timeouts abort work and return a helpful 504', async () => {
  const waitingFetch: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
  });
  const services = createServices(readConfig({ OLLAMA_TIMEOUT_MS: '20', IMAGE_TIMEOUT_MS: '20' }), waitingFetch);
  // AbortSignal.timeout is unref'd; keep the test alive like a real HTTP server.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    await assert.rejects(services.enhance('cat', signal()), { status: 504 });
    await assert.rejects(services.generate('cat', signal()), { status: 504 });
  } finally { clearInterval(keepAlive); }
});

test('cancellation propagates and unreachable services yield 502', async () => {
  const services = createServices(readConfig({}), async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(services.enhance('cat', signal()), { status: 502 });
  await assert.rejects(services.generate('cat', signal()), { status: 502 });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(services.generate('cat', controller.signal), { status: 499 });
});

test('missing Ollama model is reported without exposing the upstream response', async () => {
  const services = createServices(readConfig({}), async () => new Response(JSON.stringify({ error: 'model not found' }), { status: 404 }));
  await assert.rejects(services.enhance('cat', signal()), { status: 503 });
});

test('bad image provider responses and empty prompts are rejected', async () => {
  for (const body of [{ images: [] }, { images: ['garbage'] }, null]) {
    const services = createServices(readConfig({}), async () => Response.json(body));
    await assert.rejects(services.generate('cat', signal()), { status: 502 });
  }
  const empty = createServices(readConfig({}), async () => Response.json({ message: { content: '  ' } }));
  await assert.rejects(empty.enhance('cat', signal()), { status: 502 });
  const httpError = createServices(readConfig({}), async () => new Response('private internal error', { status: 401 }));
  await assert.rejects(httpError.generate('cat', signal()), { status: 502 });
});
