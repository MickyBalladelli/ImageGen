# 📋 TODO.md — ImageGen

A web application project for image generation utilizing **Vite**, **TypeScript**, **`@mickyballadelli/matrix`** (for reactive signal state management), and **`@mickyballadelli/prism`** (for UI components) on the frontend. The backend is powered by a **Node.js (Express)** server that leverages a local **Ollama LLM** to refine prompts prior to image generation.

---

## 🏗️ Phase 1: Architecture & Project Setup

- [ ] **1.1 Monorepo Structure Setup**
  - [ ] Create the root directory `ImageGen/`
  - [ ] Create subdirectories `client/` and `server/`

- [ ] **1.2 Frontend Configuration (`client/`)**
  - [ ] Initialize the Vite TypeScript application:
    ```bash
    cd client && npm create vite@latest . -- --template vanilla-ts
    ```
  - [ ] Install reactivity and UI dependencies:
    ```bash
    npm install @mickyballadelli/matrix @mickyballadelli/prism
    ```
  - [ ] Configure the API proxy in `client/vite.config.ts` to forward calls to `http://localhost:3000`

- [ ] **1.3 Backend Configuration (`server/`)**
  - [ ] Initialize the Node.js project and `package.json` inside `server/`
  - [ ] Install production dependencies: `express`, `cors`, `dotenv`, `ollama`
  - [ ] Install dev dependencies: `typescript`, `@types/node`, `@types/express`, `tsx`
  - [ ] Configure `tsconfig.json` for the Node.js environment

- [ ] **1.4 Root Execution Scripts (`package.json`)**
  - [ ] Set up the root `package.json` to launch both environments simultaneously:
    ```json
    "scripts": {
      "dev:server": "cd server && npx tsx watch index.ts",
      "dev:client": "cd client && npm run dev",
      "dev": "npm run dev:server & npm run dev:client"
    }
    ```

---

## ⚙️ Phase 2: Backend Development (Express + Ollama LLM)

- [ ] **2.1 Express Server Initialization (`server/index.ts`)**
  - [ ] Configure Express with required middleware (`cors`, `express.json()`)
  - [ ] Load environment variables via `dotenv`
  - [ ] Start listening on HTTP port `3000`

- [ ] **2.2 Ollama LLM Integration for Prompt Refinement**
  - [ ] Instantiate the `Ollama` client connected to `http://localhost:11434`
  - [ ] Craft a strict system prompt instructing the LLM (e.g., `llama3` / `mistral`) to transform raw user input into a detailed diffusion model positive prompt.

- [ ] **2.3 Generation Endpoint (`POST /api/generate`)**
  - [ ] Validate incoming payload `{ userPrompt: string }`
  - [ ] Query Ollama to produce the optimized version (`enhancedPrompt`)
  - [ ] Query the image generation API (e.g., Replicate, DALL-E 3, or a local Stable Diffusion API)
  - [ ] Return the JSON response to the client:
    ```json
    {
      "enhancedPrompt": "string",
      "imageUrl": "string",
      "error": null
    }
    ```
  - [ ] Implement central error handling with proper HTTP status codes (`400`, `500`)

---

## 🎨 Phase 3: Frontend Development (Matrix + Prism)

- [ ] **3.1 Reactive State Model (`client/src/state.ts`)**
  - [ ] Create `userPromptSignal` (stores the raw user prompt string)
  - [ ] Create `enhancedPromptSignal` (stores the LLM-enhanced prompt string)
  - [ ] Create `imageUrlSignal` (stores the generated image URL or base64)
  - [ ] Create `isLoadingSignal` (boolean loading status)
  - [ ] Create `errorSignal` (stores error messages)

- [ ] **3.2 Prompt Input Form Component (`client/src/components/PromptForm.ts`)**
  - [ ] Build the form using Prism UI primitives (`PrismInput`, `PrismButton`)
  - [ ] Attach `onsubmit` handler:
    - Set `isLoadingSignal.set(true)`
    - Clear previous errors with `errorSignal.set(null)`
    - Execute `fetch('/api/generate')`
    - Update `enhancedPromptSignal` and `imageUrlSignal` with API responses
    - Reset `isLoadingSignal.set(false)` in a `finally` block

- [ ] **3.3 Image Viewer & Feedback Component (`client/src/components/ImageViewer.ts`)**
  - [ ] Reactively listen to `isLoadingSignal` to display a spinner/skeleton placeholder
  - [ ] Listen to `enhancedPromptSignal` to display the refined prompt in a badge or box
  - [ ] Listen to `imageUrlSignal` to render the final image with download options
  - [ ] Listen to `errorSignal` to present error alerts when calls fail

- [ ] **3.4 Application Entry Point & UI Theme (`client/src/main.ts`)**
  - [ ] Apply the global Prism theme (`prismTheme`) to the root container (`#app`)
  - [ ] Assemble `PromptForm` and `ImageViewer` components into the DOM

---

## 🧪 Phase 4: Testing & Local Deployment

- [ ] **4.1 End-to-End Integration Testing**
  - [ ] Start the local Ollama daemon (`ollama run llama3`)
  - [ ] Start development servers with `npm run dev`
  - [ ] Test with a simple prompt (e.g., *"An astronaut cat"*)
  - [ ] Verify that the LLM expands the prompt into an English descriptor
  - [ ] Confirm the final image is received and rendered properly in the UI

- [ ] **4.2 UX Refinements**
  - [ ] Add a one-click copy button for the enhanced prompt
  - [ ] Handle edge cases (empty input, Ollama connection timeout)