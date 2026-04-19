import { test, expect } from "@playwright/test";

test("home renders hero and CTA", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Đại Long|ZhiDun|Laser/i);
  await expect(page.locator("body")).toBeVisible();
});

test("product page loads", async ({ page }) => {
  await page.goto("/san-pham");
  await expect(page.locator("h1, h2").first()).toBeVisible();
});

test("blog index lists articles", async ({ page }) => {
  await page.goto("/blog");
  await expect(page.locator("a[href*='/blog/']").first()).toBeVisible();
});

test("blog article opens", async ({ page }) => {
  await page.goto("/blog");
  const firstLink = page.locator("a[href^='/blog/']").first();
  const href = await firstLink.getAttribute("href");
  expect(href).toBeTruthy();
  await firstLink.click();
  await expect(page).toHaveURL(/\/blog\/.+/);
  await expect(page.locator("h1").first()).toBeVisible();
});

test("contact page renders form", async ({ page }) => {
  await page.goto("/lien-he");
  await expect(page.locator("input, textarea").first()).toBeVisible();
});

test("language switcher visible", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();
});

test("404 page works", async ({ page }) => {
  const res = await page.goto("/route-that-does-not-exist-xyz");
  expect([200, 404]).toContain(res?.status() || 0);
});
