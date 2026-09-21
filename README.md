# ImageGen

A local Qwen-Image 2.1 studio for Apple Silicon. Matrix signals and Prism's Nocturne theme power the interface, with Prism's animated Veil background. Express launches the installed MFLUX command directly; the default workflow does not need Ollama, Stable Diffusion, or ComfyUI.

## Run locally

Use Node.js 22.12 or newer, npm, and an installed `mflux-generate-qwen-2.1` executable. Installing this application's npm dependencies does not install MFLUX or download its models.

```sh
npm install
# Only copy this when you do not already have server/.env:
cp server/.env.example server/.env
npm run dev
```

Open `http://localhost:5173`. Express listens on `http://127.0.0.1:3000`, and Vite proxies `/api` to it.

The default executable is `~/.local/bin/mflux-generate-qwen-2.1`. Set `MFLUX_BINARY` if yours is elsewhere. Download the Qwen weights separately with `scripts/download-qwen-image-2.1.sh`. The app launches MFLUX with `HF_HUB_OFFLINE=1` so clicking Generate cannot silently start another model download. If you used a custom cache directory, give the server the same `HF_HUB_CACHE`.

The header checks whether the executable exists and is executable. It does not load the model or verify model readiness, memory requirements, or render speed.

## Studio controls

The initial settings match this command:

```sh
~/.local/bin/mflux-generate-qwen-2.1 \
  --prompt "An astronaut cat exploring a moonlit greenhouse" \
  --width 512 --height 512 --steps 40 --seed 42 \
  --quantize 4 --low-ram --output "$HOME/Desktop/qwen-test.png"
```

- Edit the prompt, dimensions, steps, seed, quantization, low-memory setting, and output filename.
- Shape presets change dimensions; the dice button chooses a random seed. Reset restores the initial settings.
- Dimensions must be 256–2048 pixels in multiples of 32; steps are 1–100; seeds are 0–4294967295; supported quantization values are 3, 4, 5, 6, and 8.
- Output is a PNG basename, not an arbitrary path. Set the destination folder with `OUTPUT_DIRECTORY`. Existing files are preserved by adding a numeric suffix.
- The command preview reflects the selected controls. The app itself renders into a temporary file before validating and saving the result without overwriting anything. Running the displayed command directly does not provide that protection.
- Veil pauses during rendering and when the tab is hidden. The pause button and operating-system reduced-motion preference also stop the animation.
- Cancel terminates the MFLUX child process, escalating from SIGTERM to SIGKILL after three seconds if necessary. It does not interrupt unrelated jobs.

512 pixels, 4-bit quantization, and low-memory mode are conservative starting settings, not a guarantee that a particular model will fit in available memory. A real Qwen render on this machine remains unverified.

## Configuration

`server/.env` is loaded from a stable path in development and production. Shell environment variables take precedence; a root `.env` supplies fallback values. Do not commit either file. Changes to environment files require restarting the affected process yourself.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST`, `PORT` | `127.0.0.1`, `3000` | API listen address and port |
| `CLIENT_ORIGIN` | localhost and 127.0.0.1 on port 5173 | Allowed browser origins |
| `IMAGE_PROVIDER` | `mflux` | `mflux` or `stable-diffusion` |
| `PROMPT_REFINEMENT` | `none` for MFLUX; `ollama` for SD | Whether to refine the prompt before rendering |
| `MFLUX_BINARY` | `~/.local/bin/mflux-generate-qwen-2.1` | Executable path; `~/` expands to the server user's home |
| `OUTPUT_DIRECTORY` | `~/Desktop` | Local MFLUX output folder |
| `MFLUX_TIMEOUT_MS` | `1800000` | MFLUX timeout; maximum one hour |
| `MAX_CONCURRENT_GENERATIONS` | `1` | Maximum simultaneous generation requests |
| `IMAGE_WIDTH`, `IMAGE_HEIGHT` | `512` | API defaults when dimensions are omitted |
| `IMAGE_STEPS` | `40` for MFLUX; `25` for SD | API default when steps are omitted |
| `OLLAMA_HOST`, `OLLAMA_MODEL` | `http://127.0.0.1:11434`, `llama3` | Optional prompt-refinement provider |
| `OLLAMA_TIMEOUT_MS` | `120000` | Optional refinement timeout |
| `IMAGE_API_URL` | `http://127.0.0.1:7860` | Legacy AUTOMATIC1111-compatible endpoint |
| `IMAGE_API_USERNAME`, `IMAGE_API_PASSWORD` | Empty | Optional image API Basic authentication |
| `IMAGE_TIMEOUT_MS` | `180000` | Legacy image API timeout |

The studio sends its visible settings explicitly; the dimension/step environment defaults apply to API requests that omit those settings. To retain the old workflow, set both `IMAGE_PROVIDER=stable-diffusion` and `PROMPT_REFINEMENT=ollama`. Quantization, low-memory mode, and local output saving apply only to MFLUX. A remote image backend may continue computing after its HTTP request is cancelled.

When changing Vite ports, set `CLIENT_PORT` and `API_PROXY_TARGET` in the shell that launches Vite, not `server/.env`. Update `CLIENT_ORIGIN` accordingly.

```sh
PORT=3100 API_PROXY_TARGET=http://127.0.0.1:3100 npm run dev
```

## Commands and checks

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start frontend and backend together |
| `npm run dev:client` / `npm run dev:server` | Start one development process |
| `npm run build` | Type-check and compile both workspaces |
| `npm run typecheck` | Type-check without producing output |
| `npm test` | Backend, validation, provider, and child-process regression tests |
| `npm run test:e2e` | Browser tests with fixture services and intercepted MFLUX results |
| `npm run test:production` | Smoke-test compiled outputs; build first |
| `npm start` | Serve the built app and API on port 3000 |

Before the first browser test, install Chromium with `PLAYWRIGHT_SKIP_BROWSER_GC=1 npx playwright install chromium` to preserve other projects' browser versions.

Browser tests use isolated ports 13000/15173 and a fixture upstream on 19001, shutting down their own processes afterward. MFLUX backend tests run a small temporary fake executable, covering arguments, save collisions, symlink preservation, missing executables, memory errors, timeouts, and cancellation. No tests load Qwen weights or perform a real model render.

## API

`POST /api/generate` accepts:

```json
{
  "userPrompt": "An astronaut cat",
  "settings": {
    "width": 512,
    "height": 512,
    "steps": 40,
    "seed": 42,
    "quantize": 4,
    "lowRam": true,
    "output": "qwen-test.png"
  }
}
```

Settings are optional and validated before acquiring a generation slot. A successful response includes `enhancedPrompt`, a raster `imageUrl` data URL, and `error: null`. MFLUX responses also include the applied `settings`, `provider`, `promptRefined`, `savedFile`, and `filename`. Without refinement, `enhancedPrompt` contains the original trimmed prompt for backward compatibility.

Prompts are limited to 2000 characters; request bodies to 16 KB; local PNGs to 18 MB. Validation errors use 400, disallowed origins 403, oversized requests 413, busy generation 429, provider failures 502, missing runtime/model or memory errors 503, and timeouts 504. Unexpected errors use 500 without exposing raw internals.

`GET /api/health` reports the selected provider/model, executable availability, output directory, refinement mode, and client timeout. It is not a model-readiness probe.

## Implementation and storage

Prism's published JavaScript components are described by narrow local declarations in `client/src/prism.d.ts`. Matrix numeric input bindings emit numbers after edits. The viewer converts validated raster data into scoped Blob URLs because Matrix rejects dynamic `data:` URLs, and revokes them on replacement or unmount. Prompt text is never inserted as raw HTML.

MFLUX is spawned with a separate argument array, never a shell command. Generation runs in a temporary folder; the PNG is validated before an exclusive copy into the destination. Temporary files are removed on success, failure, and cancellation. Desktop images persist after refreshing; browser preview state does not.

This is a loopback-only local application, not an authenticated public service. Add authentication and deployment-level abuse controls before exposing it. Optional remote providers receive prompts when explicitly configured.

## Troubleshooting

- **Install MFLUX:** check `MFLUX_BINARY` and executable permissions.
- **Missing cache files:** run the download script separately and ensure the server uses the same Hugging Face cache.
- **Not enough memory:** close other applications, start at 512 × 512 with 4-bit quantization and low-memory mode, and avoid parallel renders.
- **Cannot save:** allow the terminal/API process access to Desktop or set another `OUTPUT_DIRECTORY`.
- **Timed out:** reduce steps or dimensions, or increase `MFLUX_TIMEOUT_MS` up to one hour.
- **Port already in use:** stop the conflicting process yourself or configure another port.
- **Clipboard unavailable:** use localhost/HTTPS and allow clipboard access, or copy the displayed text manually.
