import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('empty input is rejected without an API call', async ({ page }) => {
  let calls = 0;
  page.on('request', req => { if (req.url().endsWith('/api/generate')) calls++; });
  await page.getByRole('button', { name: 'Generate image', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('1–2000 characters');
  expect(calls).toBe(0);
});

test('prompt flows through Vite proxy, Express, Ollama SDK and image adapter', async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByLabel('Describe your image').fill('An astronaut cat');
  await page.getByRole('button', { name: 'Generate image', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Generating…', exact: true })).toBeDisabled();
  const image = page.getByRole('img', { name: 'Generated image' });
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.getByLabel('Enhanced prompt')).toContainText('A cinematic scene of An astronaut cat');
  await page.getByRole('button', { name: 'Copy prompt' }).click();
  await expect(page.getByText('Prompt copied.')).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('An astronaut cat');
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download image' }).click();
  expect((await downloadEvent).suggestedFilename()).toBe('imagegen.png');
  expect(errors).toEqual([]);
});

test('upstream errors restore the form and allow retry', async ({ page }) => {
  await page.getByLabel('Describe your image').fill('fail upstream');
  await page.getByRole('button', { name: 'Generate image', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Ollama is unavailable');
  await expect(page.getByRole('button', { name: 'Generate image', exact: true })).toBeEnabled();
  await page.getByLabel('Describe your image').fill('A forest');
  await page.getByRole('button', { name: 'Generate image', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Download image' })).toBeVisible();
  await expect(page.getByRole('alert')).toBeEmpty();
});

test('cancel aborts an in-flight request and permits another generation', async ({ page }) => {
  await page.getByLabel('Describe your image').fill('cancel generation');
  await page.getByRole('button', { name: 'Generate image', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Generation cancelled.');
  await expect(page.getByRole('button', { name: 'Generate image', exact: true })).toBeEnabled();
  await page.getByLabel('Describe your image').fill('A lake');
  await page.getByRole('button', { name: 'Generate image', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Download image' })).toBeVisible();
});

test('regeneration replaces the image and releases its old Blob URL', async ({ page }) => {
  await page.getByLabel('Describe your image').fill('First image');
  await page.getByRole('button', { name: 'Generate image', exact: true }).click();
  const download = page.getByRole('link', { name: 'Download image' });
  await expect(download).toBeVisible();
  const oldUrl = await download.getAttribute('href');
  expect(oldUrl).toMatch(/^blob:/);
  await page.getByLabel('Describe your image').fill('Second image');
  await page.getByRole('button', { name: 'Generate image', exact: true }).click();
  await expect(download).toBeVisible();
  expect(await download.getAttribute('href')).not.toBe(oldUrl);
  expect(await page.evaluate(async url => {
    try { await fetch(url!); return false; } catch { return true; }
  }, oldUrl)).toBe(true);
});

test('refined prompt markup is displayed as text and clipboard denial is explained', async ({ page }) => {
  await page.getByLabel('Describe your image').fill('<em>an astronaut cat</em>');
  await page.getByRole('button', { name: 'Generate image', exact: true }).click();
  const prompt = page.getByLabel('Enhanced prompt');
  await expect(prompt).toContainText('<em>an astronaut cat</em>');
  await expect(prompt.locator('em')).toHaveCount(0);
  await page.evaluate(() => Object.defineProperty(navigator.clipboard, 'writeText', {
    value: async () => { throw new Error('Permission denied'); },
  }));
  await page.getByRole('button', { name: 'Copy prompt' }).click();
  await expect(page.getByText('Copy is unavailable.', { exact: false })).toBeVisible();
});

test('invalid API results do not leave the UI loading', async ({ page }) => {
  await page.route('**/api/generate', route => route.fulfill({
    json: { enhancedPrompt: 'cat', imageUrl: 'https://example.com/unexpected-image', error: null },
  }));
  await page.getByLabel('Describe your image').fill('cat');
  await page.getByRole('button', { name: 'Generate image', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('incomplete or invalid');
  await expect(page.getByRole('button', { name: 'Generate image', exact: true })).toBeEnabled();
});

test('mobile layout stays within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await expect(page.getByLabel('Describe your image')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/studio-mobile.png', fullPage: true });
});
