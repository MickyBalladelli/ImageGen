import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:15173', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: [
    { command: 'npx tsx tests/e2e/upstream.ts', url: 'http://127.0.0.1:19001/health', reuseExistingServer: false },
    {
      command: 'npm run dev', url: 'http://127.0.0.1:15173', reuseExistingServer: false,
      env: {
        PORT: '13000', HOST: '127.0.0.1', CLIENT_PORT: '15173',
        API_PROXY_TARGET: 'http://127.0.0.1:13000',
        CLIENT_ORIGIN: 'http://127.0.0.1:15173',
        OLLAMA_HOST: 'http://127.0.0.1:19001', IMAGE_API_URL: 'http://127.0.0.1:19001',
        OLLAMA_MODEL: 'test-model',
      },
    },
  ],
});
