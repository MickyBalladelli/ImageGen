import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readdir, readFile, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { createApp } from '../app.js';
import { readConfig } from '../config.js';
import { createServices } from '../services.js';
import { parseSettings } from '../settings.js';
import { generateWithMflux, mfluxArguments } from '../mflux.js';

const config = readConfig({});
const defaults = parseSettings(undefined, config);
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';

test('Qwen settings match the command defaults; invalid and path-like outputs are rejected', () => {
  assert.deepEqual(defaults, { width: 512, height: 512, steps: 40, seed: 42, quantize: 4, lowRam: true, output: 'qwen-test.png' });
  for (const value of [null, [], { width: 513 }, { width: 32 }, { height: 4096 }, { steps: '40' }, { seed: -1 }, { seed: 4294967296 }, { quantize: 7 }, { lowRam: 'false' }, { output: '../test.png' }, { output: '/tmp/test.png' }, { output: '$(touch a).png' }]) {
    assert.throws(() => parseSettings(value, config));
  }
});

test('MFLUX arguments carry every option as separate arguments without shell evaluation', () => {
  const prompt = '$(touch /tmp/never-run); "astronaut cat"';
  const args = mfluxArguments(prompt, { ...defaults, width: 768, seed: 0, lowRam: false }, '/tmp/image.png');
  assert.equal(args[0], `--prompt=${prompt}`);
  assert.deepEqual(args.slice(1), ['--width', '768', '--height', '512', '--steps', '40', '--seed', '0', '--quantize', '4', '--output', '/tmp/image.png']);
  assert.ok(mfluxArguments('cat', defaults, '/tmp/a.png').includes('--low-ram'));
});

test('invalid settings are rejected before either generation service runs', async () => {
  const app = createApp(config, { enhance: async () => { throw new Error('must not run'); }, generate: async () => '' });
  await request(app).post('/api/generate').send({ userPrompt: 'cat', settings: { output: '../bad.png' } }).expect(400);
});

test('MFLUX does not call Ollama by default', async () => {
  const services = createServices(config, async () => { throw new Error('network must not run'); });
  assert.equal(await services.enhance('An astronaut cat', new AbortController().signal), 'An astronaut cat');
});

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'imagegen-test-'));
  const binary = join(root, 'mflux-fixture');
  await writeFile(binary, `#!/usr/bin/env node
const fs = require('node:fs');
const args = process.argv.slice(2);
const output = args[args.indexOf('--output') + 1];
const prompt = args.find(arg => arg.startsWith('--prompt='));
if (prompt === '--prompt=fail') { console.error('out of memory'); process.exit(1); }
if (prompt === '--prompt=slow') { setTimeout(() => {}, 60000); }
else fs.writeFileSync(output, Buffer.from('${png}', 'base64'));
`, { mode: 0o700 });
  return { root, config: { ...config, mfluxBinary: binary, outputDirectory: join(root, 'Desktop') } };
}

test('real child process returns the PNG and saves without overwriting files or symlinks', async () => {
  const f = await fixture();
  try {
    const services = createServices(f.config);
    const signal = new AbortController().signal;
    const first = await services.generate('cat', signal, defaults);
    assert.equal(typeof first, 'object');
    assert.equal((first as { filename: string }).filename, 'qwen-test.png');
    const second = await services.generate('cat', signal, defaults);
    assert.equal((second as { filename: string }).filename, 'qwen-test-2.png');
    assert.equal((first as { imageUrl: string }).imageUrl, `data:image/png;base64,${png}`);
    const protectedFile = join(f.root, 'protected.txt');
    await writeFile(protectedFile, 'unchanged');
    await symlink(protectedFile, join(f.config.outputDirectory, 'other.png'));
    const third = await services.generate('cat', signal, { ...defaults, output: 'other.png' });
    assert.equal((third as { filename: string }).filename, 'other-2.png');
    assert.equal(await readFile(protectedFile, 'utf8'), 'unchanged');
    assert.equal((await readdir(f.config.outputDirectory)).length, 4);
  } finally { await rm(f.root, { recursive: true, force: true }); }
});

test('missing executable, memory failure, timeout and cancellation are actionable', async () => {
  const f = await fixture();
  try {
    const signal = new AbortController().signal;
    await assert.rejects(generateWithMflux({ ...f.config, mfluxBinary: '/missing/mflux' }, 'cat', defaults, signal), { status: 503 });
    await assert.rejects(createServices(f.config).generate('fail', signal, defaults), { status: 503 });
    await assert.rejects(createServices({ ...f.config, mfluxTimeoutMs: 150 }).generate('slow', signal, defaults), { status: 504 });
    const controller = new AbortController();
    const work = createServices(f.config).generate('slow', controller.signal, defaults);
    setTimeout(() => controller.abort(), 100);
    await assert.rejects(work, { status: 499 });
  } finally { await rm(f.root, { recursive: true, force: true }); }
});
