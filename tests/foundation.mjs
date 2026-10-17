import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:5173/");
await page
  .getByRole("heading", { name: "Every Island Has a Story." })
  .waitFor();
await page.screenshot({ path: "tests/home-desktop.png", fullPage: true });
await page.getByRole("link", { name: "Explore", exact: true }).click();
await page.getByRole("textbox", { name: "Search destinations" }).fill("Baguio");
await page.getByRole("heading", { name: "Baguio", exact: true }).waitFor();
await expect(page.locator(".postcard")).toHaveCount(1);
await page.getByRole("link", { name: "Baguio", exact: true }).click();
await page.getByRole("heading", { name: /Baguio/, level: 1 }).waitFor();
await page.setViewportSize({ width: 390, height: 844 });
await page.goto("http://127.0.0.1:5173/");
await page.getByRole("button", { name: "Toggle navigation" }).click();
await page.getByRole("link", { name: "Explore", exact: true }).click();
await page.getByRole("button", { name: "Mountains", exact: true }).click();
await expect(page.locator(".postcard")).toHaveCount(3);
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  false,
);
await page.screenshot({ path: "tests/explore-mobile.png", fullPage: true });
assert.deepEqual(errors, []);
await browser.close();
console.log(
  "Phase 1: desktop navigation, search, details, mobile navigation/filter/layout passed.",
);
