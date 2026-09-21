# 📋 TODO.md — ImageGen

A web application project for image generation utilizing **Vite**, **TypeScript**, **`@mickyballadelli/matrix`** (for reactive signal state management), and **`@mickyballadelli/prism`** (for UI components) on the frontend. The backend is powered by a **Node.js (Express)** server that leverages a local **Ollama LLM** to refine prompts prior to image generation.

---

## 🏗️ Phase 1: Architecture & Project Setup

- [x] **1.1 Monorepo Structure Setup**
  - [x] Create the root directory `ImageGen/`
  - [x] Create subdirectories `client/` and `server/`

- [x] **1.2 Frontend Configuration (`client/`)**
  - [x] Initialize the Vite TypeScript application:
    ```bash
    cd client && npm create vite@latest . -- --template vanilla-ts
    ```
  - [x] Install reactivity and UI dependencies:
    ```bash
    npm install @mickyballadelli/matrix @mickyballadelli/prism
    ```
  - [x] Configure the API proxy in `client/vite.config.ts` to forward calls to `http://localhost:3000`

- [x] **1.3 Backend Configuration (`server/`)**
  - [x] Initialize the Node.js project and `package.json` inside `server/`
  - [x] Install production dependencies: `express`, `cors`, `dotenv`, `ollama`
  - [x] Install dev dependencies: `typescript`, `@types/node`, `@types/express`, `tsx`
  - [x] Configure `tsconfig.json` for the Node.js environment

- [x] **1.4 Root Execution Scripts (`package.json`)**
  - [x] Set up the root `package.json` to launch both environments simultaneously:
    ```json
    "scripts": {
      "dev:server": "cd server && npx tsx watch index.ts",
      "dev:client": "cd client && npm run dev",
      "dev": "npm run dev:server & npm run dev:client"
    }
    ```

---

## ⚙️ Phase 2: Backend Development (Express + Ollama LLM)

- [x] **2.1 Express Server Initialization (`server/index.ts`)**
  - [x] Configure Express with required middleware (`cors`, `express.json()`)
  - [x] Load environment variables via `dotenv`
  - [x] Start listening on HTTP port `3000`

- [x] **2.2 Ollama LLM Integration for Prompt Refinement**
  - [x] Instantiate the `Ollama` client connected to `http://localhost:11434`
  - [x] Craft a strict system prompt instructing the LLM (e.g., `llama3` / `mistral`) to transform raw user input into a detailed diffusion model positive prompt.

- [x] **2.3 Generation Endpoint (`POST /api/generate`)**
  - [x] Validate incoming payload `{ userPrompt: string }`
  - [x] Query Ollama to produce the optimized version (`enhancedPrompt`)
  - [x] Query the image generation API (e.g., Replicate, DALL-E 3, or a local Stable Diffusion API)
  - [x] Return the JSON response to the client:
    ```json
    {
      "enhancedPrompt": "string",
      "imageUrl": "string",
      "error": null
    }
    ```
  - [x] Implement central error handling with proper HTTP status codes (`400`, `500`)

---

## 🎨 Phase 3: Frontend Development (Matrix + Prism)

- [x] **3.1 Reactive State Model (`client/src/state.ts`)**
  - [x] Create `userPromptSignal` (stores the raw user prompt string)
  - [x] Create `enhancedPromptSignal` (stores the LLM-enhanced prompt string)
  - [x] Create `imageUrlSignal` (stores the generated image URL or base64)
  - [x] Create `isLoadingSignal` (boolean loading status)
  - [x] Create `errorSignal` (stores error messages)

- [x] **3.2 Prompt Input Form Component (`client/src/components/PromptForm.ts`)**
  - [x] Build the form using Prism UI primitives (`PrismInput`, `PrismButton`)
  - [x] Attach `onsubmit` handler:
    - Set `isLoadingSignal.set(true)`
    - Clear previous errors with `errorSignal.set(null)`
    - Execute `fetch('/api/generate')`
    - Update `enhancedPromptSignal` and `imageUrlSignal` with API responses
    - Reset `isLoadingSignal.set(false)` in a `finally` block

- [x] **3.3 Image Viewer & Feedback Component (`client/src/components/ImageViewer.ts`)**
  - [x] Reactively listen to `isLoadingSignal` to display a spinner/skeleton placeholder
  - [x] Listen to `enhancedPromptSignal` to display the refined prompt in a badge or box
  - [x] Listen to `imageUrlSignal` to render the final image with download options
  - [x] Listen to `errorSignal` to present error alerts when calls fail

- [x] **3.4 Application Entry Point & UI Theme (`client/src/main.ts`)**
  - [x] Apply the global Prism theme (`prismTheme`) to the root container (`#app`)
  - [x] Assemble `PromptForm` and `ImageViewer` components into the DOM

---

## 🧪 Phase 4: Testing & Local Deployment

- [ ] **4.1 End-to-End Integration Testing — live models blocked**
  - [ ] Start the local Ollama daemon with the configured model (`ollama run llama3`). The daemon is already running, but `/api/tags` returns no installed models; the separate model download has not been performed.
  - [x] Start development servers with `npm run dev` — verified by the browser suite on isolated test ports, then stopped.
  - [ ] Test with a simple prompt (e.g., *"An astronaut cat"*) against real model services. The same prompt passes the full application flow using deterministic upstream fixtures.
  - [ ] Verify that the real LLM expands the prompt into an English descriptor. The prompt instruction and SDK request are tested; model output quality remains unverified.
  - [ ] Confirm the real generated image is received and rendered properly in the UI. Rendering, decoding and downloading fixture images pass; no Stable Diffusion API is listening at `127.0.0.1:7860`.

  **Unblocking:** install the configured Ollama model, provide an AUTOMATIC1111-compatible image server with a loaded checkpoint and `--api`, then follow the live integration steps in `README.md`. No mock result is counted as a live-model verification.

- [x] **4.2 UX Refinements**
  - [x] Add a one-click copy button for the enhanced prompt
  - [x] Handle edge cases (empty input, Ollama connection timeout)

---

## Phase 5: Additional Tasks Found During Implementation

- [x] Add npm workspaces, a lockfile, `.gitignore`, configurable environment defaults, and setup/troubleshooting documentation in `README.md`.
- [x] Use the published Matrix/Prism APIs rather than assumed component names; add narrow TypeScript declarations for Prism's JavaScript-only package.
- [x] Implement the local Stable Diffusion HTTP adapter with optional Basic authentication, bounded response sizes, raster-format validation, and actionable upstream errors.
- [x] Limit input sizes, restrict browser origins, hide unexpected error details, and bound concurrent generation requests.
- [x] Add per-stage timeouts and cancellation on client disconnect without aborting other requests; document the external backend cancellation limitation.
- [x] Fix Matrix's rejection of dynamic data URLs by using scoped Blob URLs; revoke replaced/unmounted URLs and test regeneration cleanup.
- [x] Handle malformed API results, clipboard denial, image decoding errors, and escaped prompt markup; prevent duplicate submissions.
- [x] Add production build/start scripts, static frontend serving, liveness endpoint, graceful shutdown, and a production smoke test.
- [x] Add and run automated backend/provider regression tests and browser integration tests with isolated upstream fixtures.
- [x] Verify responsive mobile layout and copy/download behavior in Chromium.

## Theme Update

- [x] Apply Prism's `nocturne` theme globally and replace application-specific light colors with Prism tokens, including preview, text, borders, links, focus states, and errors.
- Live browser preview for this theme change was not verified: the development server was not running on port 5173. No servers were started or restarted.

## Qwen Studio Redesign

- [x] Add the original ImageGen logo/favicon and compact Nocturne studio layout with Prism Veil animation.
- [x] Add a multiline prompt, prompt ideas, shape presets, width/height, steps, seed/randomize, quantization, low-memory mode, output filename, and command preview.
- [x] Connect settings to the MFLUX executable; make direct Qwen generation the default without Ollama or ComfyUI.
- [x] Pause Veil while rendering or while the tab is hidden; support manual pause and reduced motion.
- [x] Add runtime availability, elapsed time, cancellation, persisted output location, and image download.
- [x] Validate arguments, run without a shell, prohibit implicit model downloads, preserve existing output files, and clean temporary files.
- [x] Update environment examples and README, preserving the optional legacy SD/Ollama adapter.
- [x] Pass TypeScript checks and 26 backend/provider tests, including fixture MFLUX child-process tests.
- [x] Pass the 8 existing browser tests; fix Matrix numeric-binding handling found by the new settings test, then pass all 3 new studio tests on rerun.
- Desktop/mobile screenshots were captured, but the file viewer could not open them for visual review. Layout overflow, controls, Veil toggling, reduced motion, and request payloads were checked in browser tests.
- [ ] Run a real Qwen-Image 2.1 generation and measure memory/performance on the M1 Max. No model render or additional model download was started by this change.
- No existing development servers were manually restarted. Test processes ran on their own isolated ports.

## Original Implementation and Verification Notes

- The existing `ImageGen/` folder was used as the root. The Vite vanilla-TypeScript setup was authored directly rather than running the interactive scaffolder.
- The form aliases Prism's actual `TextFieldComponent` and `ButtonComponent` exports as `PrismInput` and `PrismButton`.
- The root `dev` script uses `concurrently -k` instead of background shell jobs, so both child processes stop together.
- Image generation uses the configured AUTOMATIC1111-compatible API, not a paid cloud provider.
- `npm run build`: passed for both workspaces, including TypeScript checks.
- `npm test`: 20 backend/provider tests passed.
- `npm run test:e2e`: 8 Chromium tests passed, including a full request flow through real application code with fixture model services.
- `npm run test:production`: passed for the compiled server, built frontend/assets, health endpoint, and input validation.
- Live Ollama/Stable Diffusion validation is the only unfinished group. No running user services were restarted; test servers were shut down after verification.