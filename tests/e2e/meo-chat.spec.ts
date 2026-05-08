import { test, expect } from '@playwright/test';

test('FAB opens MeoChatPanel and sends a quick reply', async ({ page }) => {
  await page.route('**/api/chat', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: 'Câu trả lời e2e' }) })
  );
  await page.goto('/');
  await page.getByRole('button', { name: /AI Meo Meo/i }).click();
  await expect(page.getByRole('dialog', { name: /AI Meo Meo chat/i })).toBeVisible();
  await page.getByRole('button', { name: /What is ZhiDun\?|Máy ZhiDun là gì/i }).click();
  await expect(page.getByText('Câu trả lời e2e')).toBeVisible();
  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('dialog', { name: /AI Meo Meo chat/i })).not.toBeVisible();
});

test('reduced-motion is respected (no slide transform animation)', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('button', { name: /AI Meo Meo/i }).click();
  const dialog = page.getByRole('dialog', { name: /AI Meo Meo chat/i });
  const transition = await dialog.evaluate(el => getComputedStyle(el).transition);
  expect(transition).toContain('opacity');
  expect(transition).not.toContain('transform 220ms');
  await context.close();
});
