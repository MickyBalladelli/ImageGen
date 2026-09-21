import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { readConfig } from './config.js';
import { createServices } from './services.js';
import { createApp } from './app.js';

const serverDirectory = fileURLToPath(new URL(import.meta.url.endsWith('.ts') ? './' : '../', import.meta.url));
dotenv.config({ path: [resolve(serverDirectory, '.env'), resolve(serverDirectory, '../.env')], quiet: true });
const config = readConfig();
const app = createApp(config, createServices(config), resolve(serverDirectory, '../client/dist'));
const server = app.listen(config.port, config.host, () => {
  console.log(`ImageGen API listening on http://${config.host}:${config.port}`);
});
server.requestTimeout = config.ollamaTimeoutMs + Math.max(config.imageTimeoutMs, config.mfluxTimeoutMs) + 15000;
server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${config.port} is already in use.` : error.message);
  process.exitCode = 1;
});
for (const event of ['SIGINT', 'SIGTERM'] as const) {
  process.once(event, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  });
}
