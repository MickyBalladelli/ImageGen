import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import type { Config } from './config.js';
import { AppError } from './errors.js';
import type { GenerationServices } from './services.js';
import { parseSettings } from './settings.js';
import { mfluxInstalled } from './mflux.js';
import { homedir } from 'node:os';

export function createApp(config: Config, services: GenerationServices, clientDirectory?: string) {
  const app = express();
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
  const allowedOrigins = new Set([
    ...config.allowedOrigins,
    `http://localhost:${config.port}`, `http://127.0.0.1:${config.port}`,
  ]);
  app.use('/api', cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) callback(null, true);
      else callback(new AppError(403, 'This origin is not allowed.'));
    },
    methods: ['GET', 'POST'],
  }));
  app.use('/api', (_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.use(express.json({ limit: '16kb' }));
  app.get('/api/health', async (_req, res) => res.json({
    status: 'ok',
    model: config.imageProvider === 'mflux' ? 'Qwen-Image 2.1' : 'Stable Diffusion',
    imageProvider: config.imageProvider,
    promptRefinement: config.promptRefinement,
    runtimeInstalled: config.imageProvider === 'mflux' ? await mfluxInstalled(config) : null,
    outputDirectory: config.outputDirectory.startsWith(`${homedir()}/`)
      ? `~/${config.outputDirectory.slice(homedir().length + 1)}` : config.outputDirectory,
    timeoutMs: config.ollamaTimeoutMs + (config.imageProvider === 'mflux' ? config.mfluxTimeoutMs : config.imageTimeoutMs) + 15000,
  }));

  let active = 0;
  app.post('/api/generate', async (req, res, next) => {
    const prompt: unknown = req.body?.userPrompt;
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 2000) {
      return next(new AppError(400, 'userPrompt must be a non-empty string of at most 2000 characters.'));
    }
    let settings;
    try { settings = parseSettings(req.body?.settings, config); } catch (error) { return next(error); }
    if (active >= config.maxConcurrent) {
      res.setHeader('Retry-After', '5');
      return next(new AppError(429, 'The image generator is busy. Please try again shortly.'));
    }
    active += 1;
    const controller = new AbortController();
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    const sendEvent = (event: string, data: unknown) => {
      if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    const disconnected = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', disconnected);
    try {
      if (config.promptRefinement === 'ollama') sendEvent('progress', { phase: 'refining' });
      const enhancedPrompt = await services.enhance(prompt.trim(), controller.signal);
      controller.signal.throwIfAborted();
      const generated = await services.generate(enhancedPrompt, controller.signal, settings, progress => sendEvent('progress', progress));
      const imageUrl = typeof generated === 'string' ? generated : generated.imageUrl;
      if (!controller.signal.aborted) {
        sendEvent('complete', {
          enhancedPrompt, imageUrl, error: null,
        ...(req.body?.settings || typeof generated !== 'string' ? {
          settings, provider: config.imageProvider, promptRefined: config.promptRefinement === 'ollama',
        } : {}),
        ...(typeof generated !== 'string' ? { savedFile: generated.savedFile, filename: generated.filename } : {}),
        });
        res.end();
      }
    } catch (error) {
      if (!controller.signal.aborted && !res.writableEnded) {
        sendEvent('error', { error: error instanceof AppError ? error.message : 'An unexpected error occurred.' });
        res.end();
      }
    } finally {
      active -= 1;
      res.off('close', disconnected);
    }
  });
  app.use('/api', (_req, _res, next) => next(new AppError(404, 'API endpoint not found.')));
  if (clientDirectory) app.use(express.static(clientDirectory));
  const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
    const bodyError = error as { type?: string } | null;
    const status = error instanceof AppError ? error.status
      : bodyError?.type === 'entity.parse.failed' ? 400
      : bodyError?.type === 'entity.too.large' ? 413 : 500;
    const message = error instanceof AppError ? error.message
      : status === 400 ? 'Request body must be valid JSON.'
      : status === 413 ? 'Request body is too large.' : 'An unexpected server error occurred.';
    // Do not leak raw upstream bodies, credentials, or prompts to the browser or logs.
    res.status(status).json({ enhancedPrompt: null, imageUrl: null, error: message });
  };
  app.use(errorHandler);
  return app;
}
