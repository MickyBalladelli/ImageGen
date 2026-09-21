import { spawn } from 'node:child_process';
import { constants } from 'node:fs';
import { access, copyFile, mkdir, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import type { Config } from './config.js';
import type { GenerationSettings } from './settings.js';
import type { ProgressListener } from './progress.js';
import { AppError } from './errors.js';

export interface MfluxResult { imageUrl: string; savedFile: string; filename: string }

export function mfluxArguments(prompt: string, settings: GenerationSettings, output: string): string[] {
  return [
    `--prompt=${prompt}`, '--width', String(settings.width), '--height', String(settings.height),
    '--steps', String(settings.steps), '--seed', String(settings.seed), '--quantize', String(settings.quantize),
    ...(settings.lowRam ? ['--low-ram'] : []), '--output', output,
  ];
}

export async function mfluxInstalled(config: Config): Promise<boolean> {
  try { await access(config.mfluxBinary, constants.X_OK); return true; } catch { return false; }
}

function parseProgress(line: string, fallbackTotal: number) {
  const match = line.match(/(?:^|\s)(\d+)\s*\/\s*(\d+)(?:\s|$)/)
  if (!match) return null
  const step = Number(match[1])
  const totalSteps = Number(match[2]) || fallbackTotal
  if (!Number.isInteger(step) || !Number.isInteger(totalSteps) || step < 0 || totalSteps < 1 || step > totalSteps) return null
  return { step, totalSteps }
}

async function executeMflux(
  binary: string,
  args: string[],
  signal: AbortSignal,
  totalSteps: number,
  onProgress?: ProgressListener,
): Promise<void> {
  signal.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(binary, args, {
      shell: false,
      // Generation must not silently start another multi-GB model download.
      env: { ...process.env, HF_HUB_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let diagnostic = '';
    let progressBuffer = '';
    let lastStep = -1;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const collect = (chunk: Buffer) => {
      const text = chunk.toString()
      diagnostic = (diagnostic + text).slice(-16000)
      progressBuffer += text
      const lines = progressBuffer.split(/[\r\n]+/)
      progressBuffer = lines.pop() ?? ''
      for (const line of lines) {
        const progress = parseProgress(line, totalSteps)
        if (!progress || progress.step === lastStep) continue
        lastStep = progress.step
        onProgress?.({ phase: 'rendering', ...progress })
      }
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    const abort = () => {
      child.kill('SIGTERM');
      killTimer = setTimeout(() => child.kill('SIGKILL'), 3000);
      killTimer.unref();
    };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    const cleanup = () => { signal.removeEventListener('abort', abort); if (killTimer) clearTimeout(killTimer); };
    child.once('error', (error: NodeJS.ErrnoException) => {
      cleanup();
      reject(new AppError(503, error.code === 'ENOENT'
        ? 'MFLUX is not installed. Install mflux-generate-qwen-2.1 or set MFLUX_BINARY in server/.env.'
        : 'MFLUX could not start. Check executable permissions and MFLUX_BINARY.'));
    });
    child.once('close', (code, exitSignal) => {
      cleanup();
      if (signal.aborted) return reject(signal.reason);
      if (code === 0) return resolve();
      if (/out of memory|insufficient memory|failed to allocate/i.test(diagnostic)) {
        return reject(new AppError(503, 'Not enough memory. Close other apps, use 4-bit quantization and low-memory mode, and reduce the image size.'));
      }
      if (/offline|LocalEntryNotFound|not found in.*cache/i.test(diagnostic)) {
        return reject(new AppError(503, 'Qwen model files are missing from the server’s cache. Run the download script and use the same HF_HUB_CACHE for the server.'));
      }
      reject(new AppError(502, `MFLUX stopped (${exitSignal ?? `exit ${code}`}). Check the installation, available memory, and model cache.`));
    });
  });
}

async function saveWithoutOverwrite(source: string, directory: string, filename: string): Promise<string> {
  await mkdir(directory, { recursive: true });
  for (let suffix = 0; suffix < 10000; suffix++) {
    const name = suffix === 0 ? filename : `${filename.slice(0, -4)}-${suffix + 1}.png`;
    const destination = join(directory, name);
    try {
      await copyFile(source, destination, constants.COPYFILE_EXCL);
      return destination;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
  throw new AppError(409, 'Too many images use this filename. Choose a different output name.');
}

export async function generateWithMflux(
  config: Config,
  prompt: string,
  settings: GenerationSettings,
  signal: AbortSignal,
  onProgress?: ProgressListener,
): Promise<MfluxResult> {
  const directory = await mkdtemp(join(tmpdir(), 'imagegen-'));
  const output = join(directory, 'result.png');
  try {
    onProgress?.({ phase: 'loading', totalSteps: settings.steps })
    await executeMflux(config.mfluxBinary, mfluxArguments(prompt, settings, output), signal, settings.steps, onProgress);
    signal.throwIfAborted();
    onProgress?.({ phase: 'saving', step: settings.steps, totalSteps: settings.steps })
    const info = await stat(output).catch(() => { throw new AppError(502, 'MFLUX exited without producing an image. Check memory and battery level.'); });
    if (!info.isFile() || info.size > 18 * 1024 * 1024) throw new AppError(502, 'MFLUX output exceeds the 18 MB image limit.');
    const image = await readFile(output);
    if (!image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
      throw new AppError(502, 'MFLUX did not produce a valid PNG image.');
    }
    signal.throwIfAborted();
    const destination = await saveWithoutOverwrite(output, config.outputDirectory, settings.output);
    const home = homedir();
    return {
      imageUrl: `data:image/png;base64,${image.toString('base64')}`,
      savedFile: destination.startsWith(`${home}/`) ? `~/${destination.slice(home.length + 1)}` : destination,
      filename: basename(destination),
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EACCES' || (error as NodeJS.ErrnoException).code === 'EPERM') {
      throw new AppError(500, 'The server cannot save to the output folder. Allow Desktop access or change OUTPUT_DIRECTORY in server/.env.');
    }
    throw error;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
