import { test, expect } from '@playwright/test';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a3ioAAAAASUVORK5CYII=';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/health', route => route.fulfill({ json: {
    status: 'ok', imageProvider: 'mflux', model: 'Qwen-Image 2.1', runtimeInstalled: true,
    outputDirectory: '~/Desktop', timeoutMs: 10000, promptRefinement: 'none',
  } }));
  await page.goto('/');
});

test('Nocturne, Veil and the logo render; Veil can be paused', async ({ page }) => {
  await expect(page.locator('html')).toHaveClass(/prism-theme-model-nocturne/);
  await expect(page.getByRole('link', { name: 'ImageGen home' }).locator('svg')).toBeVisible();
  await expect(page.locator('.prism-background-veil')).toHaveCount(1);
  await page.getByRole('button', { name: 'Toggle Veil animation' }).click();
  await expect(page.locator('.prism-background-veil')).toHaveClass(/prism-background-static/);
  await expect(page.locator('.prism-background-canvas')).toHaveCount(0);
  await page.screenshot({ path: 'test-results/nocturne-studio-desktop.png', fullPage: true });
});

test('all settings reach the API and the command preview matches; rendering pauses Veil', async ({ page }) => {
  let submitted: Record<string, unknown> | undefined;
  let complete!: () => void;
  const gate = new Promise<void>(resolve => { complete = resolve; });
  await page.route('**/api/generate', async route => {
    submitted = route.request().postDataJSON();
    await gate;
    await route.fulfill({ json: {
      enhancedPrompt: submitted?.userPrompt, imageUrl: `data:image/png;base64,${png}`, error: null,
      settings: submitted?.settings, provider: 'mflux', promptRefined: false,
      savedFile: '~/Desktop/lunar.png', filename: 'lunar.png',
    } });
  });
  await page.getByLabel('Describe your image').fill('An astronaut cat');
  await page.getByRole('button', { name: 'Landscape', exact: true }).click();
  await page.getByLabel('Steps', { exact: true }).fill('30');
  await page.getByLabel('Seed', { exact: true }).fill('7');
  await page.getByRole('combobox', { name: 'Quantization' }).click();
  await page.getByRole('option', { name: '6-bit', exact: true }).click();
  await page.getByRole('checkbox', { name: /Low-memory mode/ }).uncheck();
  await page.getByLabel('Output filename').fill('lunar.png');
  await page.locator('summary').filter({ hasText: 'Equivalent command' }).click();
  await expect(page.locator('.command-content pre')).toContainText('--width 768 --height 512');
  await expect(page.locator('.command-content pre')).toContainText('--steps 30 --seed 7');
  await expect(page.locator('.command-content pre')).not.toContainText('--low-ram');
  await page.getByRole('button', { name: 'Generate image', exact: true }).click();
  await expect.poll(() => submitted).toBeTruthy();
  expect(submitted?.settings).toEqual({ width: 768, height: 512, steps: 30, seed: 7, quantize: 6, lowRam: false, output: 'lunar.png' });
  await expect(page.locator('.prism-background-canvas')).toHaveCount(0);
  complete();
  await expect(page.getByRole('link', { name: 'Download image' })).toBeVisible();
  await expect(page.getByText('Saved to ~/Desktop/lunar.png')).toBeVisible();
});

test('reset, validation and reduced motion work on mobile', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByLabel('Width', { exact: true }).fill('513');
  await expect(page.locator('.settings-validation')).toContainText('multiples of 32');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.getByLabel('Width', { exact: true })).toHaveValue('512');
  await expect(page.getByLabel('Seed', { exact: true })).toHaveValue('42');
  await expect(page.locator('.prism-background-canvas')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/nocturne-studio-mobile.png', fullPage: true });
});
