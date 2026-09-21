// Deterministic upstream fixtures only. The production app never imports this.
import { createServer } from 'node:http';
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';
createServer(async (req, res) => {
  if (req.url === '/health') { res.end('ok'); return; }
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const body = JSON.parse(Buffer.concat(chunks).toString());
  res.setHeader('Content-Type', 'application/json');
  if (req.url === '/api/chat') {
    const prompt: string = body.messages.at(-1).content;
    if (prompt === 'fail upstream') { res.writeHead(500); res.end(JSON.stringify({ error: 'fixture failure' })); return; }
    const delay = prompt === 'cancel generation' ? 1500 : 200;
    setTimeout(() => res.end(JSON.stringify({ message: { role: 'assistant', content: `A cinematic scene of ${prompt}, soft moonlight, detailed textures.` }, done: true })), delay);
  } else if (req.url === '/sdapi/v1/txt2img') {
    setTimeout(() => res.end(JSON.stringify({ images: [png] })), 200);
  } else { res.writeHead(404); res.end('{}'); }
}).listen(19001, '127.0.0.1');
