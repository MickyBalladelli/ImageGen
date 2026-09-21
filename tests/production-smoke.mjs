import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as wait } from 'node:timers/promises';
import { createServer } from 'node:net';

// Reserve a free loopback port, then launch only this test's own server.
const reservation = createServer();
reservation.listen(0, '127.0.0.1');
await once(reservation, 'listening');
const port = reservation.address().port;
await new Promise(resolve => reservation.close(resolve));
const child = spawn(process.execPath, ['server/dist/index.js'], {
  env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const exited = once(child, 'exit');
let output = '';
child.stdout.on('data', chunk => { output += chunk; });
child.stderr.on('data', chunk => { output += chunk; });
try {
  for (let attempt = 0; !output.includes('API listening'); attempt++) {
    if (child.exitCode !== null || attempt > 100) throw new Error(`Production server failed to start: ${output}`);
    await wait(50);
  }
  const base = `http://127.0.0.1:${port}`;
  const response = await fetch(base);
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /ImageGen/);
  const script = html.match(/src="([^"]+\.js)"/)?.[1];
  assert.ok(script, 'Built JavaScript is referenced');
  assert.equal((await fetch(`${base}${script}`)).status, 200);
  const health = await fetch(`${base}/api/health`);
  assert.equal((await health.json()).status, 'ok');
  const invalid = await fetch(`${base}/api/generate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(invalid.status, 400);
  console.log('Production smoke passed: built client, assets, health endpoint and validation.');
} finally {
  child.kill('SIGTERM');
  await exited;
}
