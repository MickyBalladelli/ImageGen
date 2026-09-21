# ImageGen

A local image studio built with Vite, TypeScript, Matrix signals, Prism components, Express, Ollama, and an AUTOMATIC1111-compatible Stable Diffusion API.

The browser sends a description to Express. Ollama expands it into an English positive prompt, and Stable Diffusion generates one image. The UI displays the refined prompt and image, with copy, download, and cancellation controls.

## Run locally

Use Node.js 22.12 or newer and npm. From the project root:

```sh
npm install
cp server/.env.example server/.env
```

Ollama and an image-generation server are separate prerequisites. Installing this application's npm dependencies does not install their models.

1. Start Ollama if it is not already running. Install the configured model with `ollama pull llama3`; this is a separate, multi-gigabyte download. `ollama serve` starts the daemon when the desktop app is not already serving it. Change `OLLAMA_MODEL` to use another installed model.
2. Install/configure an AUTOMATIC1111-compatible Stable Diffusion server, load a checkpoint appropriate for your hardware, and launch it with its `--api` option. This app expects it at `http://127.0.0.1:7860`. The provider's API documentation should be available at `/docs`.
3. Run `npm run dev` here, then open `http://localhost:5173`.

The server runs at `http://127.0.0.1:3000`; Vite proxies `/api` to it. No paid provider is configured. The [upstream API guide](https://github.com/AUTOMATIC1111/stable-diffusion-webui/discussions/3734) explains the Stable Diffusion API and `txt2img` endpoint.

## Configuration

`server/.env` is loaded from a stable path in both development and production. Shell environment variables take precedence. A root `.env` can supply fallback values. Do not commit either file.

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `127.0.0.1` | API listen address |
| `PORT` | `3000` | API listen port |
| `CLIENT_ORIGIN` | localhost and 127.0.0.1 on port 5173 | Comma-separated allowed browser origins |
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama API base URL |
| `OLLAMA_MODEL` | `llama3` | Installed text model used for refinement |
| `IMAGE_API_URL` | `http://127.0.0.1:7860` | Stable Diffusion API base URL |
| `IMAGE_API_USERNAME`, `IMAGE_API_PASSWORD` | Empty | Optional Basic authentication for the image API |
| `OLLAMA_TIMEOUT_MS` | `120000` | Prompt-refinement timeout |
| `IMAGE_TIMEOUT_MS` | `180000` | Image-generation timeout |
| `MAX_CONCURRENT_GENERATIONS` | `1` | Maximum concurrent application requests |
| `IMAGE_WIDTH`, `IMAGE_HEIGHT` | `512` | Image size, multiples of 8, from 64 to 2048 |
| `IMAGE_STEPS` | `25` | Diffusion steps, from 1 to 100 |

When changing development ports, set `CLIENT_PORT` and `API_PROXY_TARGET` in the shell that launches Vite; these are not read from `server/.env`. Update `CLIENT_ORIGIN` accordingly. The default configuration needs no changes.

```sh
PORT=3100 API_PROXY_TARGET=http://127.0.0.1:3100 npm run dev
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start frontend and backend together; stop both with Ctrl+C |
| `npm run dev:client` | Start Vite only |
| `npm run dev:server` | Start Express with TypeScript watch mode |
| `npm run build` | Type-check both workspaces and compile production outputs |
| `npm run typecheck` | Type-check without producing output |
| `npm test` | Run backend validation, configuration, concurrency, and provider tests |
| `npm run test:e2e` | Run browser integration tests using local upstream fixtures |
| `npm run test:production` | Smoke-test the built server and frontend; run build first |
| `npm start` | Serve the built app and API on port 3000 |

Before the first browser test, install its browser with `npx playwright install chromium`. Set `PLAYWRIGHT_SKIP_BROWSER_GC=1` during installation to preserve browser versions used by other projects.

Browser tests launch `npm run dev` on isolated ports 13000/15173 and an upstream fixture on 19001, then shut those test processes down. They exercise the real Vite proxy, Express application, Ollama SDK, image adapter, image decoding, clipboard, and download. **Their images and refined prompts are fixtures, not real model outputs.** Production code has no mock-mode switch.

For a real integration check, start the services described above, generate `An astronaut cat`, and inspect the English refined prompt and the displayed/downloaded image. See the unchecked live-verification tasks in `TODO.md`.

## API

`POST /api/generate` accepts a JSON body:

```json
{ "userPrompt": "An astronaut cat" }
```

A successful response has HTTP 200 with `enhancedPrompt`, `imageUrl` (a raster-image data URL), and `error: null`. Errors return `enhancedPrompt: null`, `imageUrl: null`, and a readable `error` string.

The API validates a non-empty prompt of at most 2000 characters, limits request bodies to 16 KB, and limits image-service responses to 24 MB. Validation errors use 400, disallowed browser origins 403, oversized requests 413, busy generation 429, upstream failures 502, a missing Ollama model 503, and upstream timeouts 504. Unexpected errors use 500 without exposing their internal details.

`GET /api/health` reports application liveness and configured provider/model names. It does not claim that either model service is ready.

## Implementation notes

Prism 0.1.4 exports `TextFieldComponent` and `ButtonComponent`, not `PrismInput` and `PrismButton`. The form uses aliases for those real exports. `client/src/prism.d.ts` types the small API surface used here because that package ships no TypeScript declarations.

Matrix rejects dynamic `data:` URLs. The viewer converts validated raster data to Blob URLs for rendering/download, revoking old URLs on replacement or unmount. Prompts are rendered as text rather than inserted as HTML.

Cancel closes the application request and aborts its upstream HTTP calls. Some image backends may continue computing after the connection closes; this app does not send a global interrupt that could terminate unrelated backend jobs. The concurrency cap governs application requests, not the image backend's global queue.

Generated results are held in browser memory and are not saved by this app. Download images before refreshing. Service-side storage/logging is controlled by the external services. Prompts are sent to the configured service URLs, which may be remote if you change them.

This is a loopback-only local application by default, not an authenticated public service. Add authentication and deployment-level abuse controls before exposing it to other users.

## Troubleshooting

- **Model not installed:** pull the name configured in `OLLAMA_MODEL`, or select an installed model.
- **Stable Diffusion unavailable:** check its URL, `--api` setting, loaded checkpoint, and optional Basic credentials. Ollama alone does not provide this app's image-generation endpoint.
- **Generation timed out:** reduce image dimensions/steps or increase the corresponding timeout, up to 600000 ms per stage.
- **Port already in use:** stop the conflicting process yourself or configure another port. The app does not terminate existing servers.
- **Clipboard unavailable:** use localhost/HTTPS and allow clipboard access, or select and copy the refined prompt manually.
