import { chromium, expect } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
try {
  await page.goto("http://127.0.0.1:5173/planner?destinations=baguio&days=3");
  await expect(page.getByLabel("Departure city")).toHaveValue("Manila");
  await expect(page.getByLabel("Number of days")).toHaveValue("3");
  for (let i = 0; i < 5; i++)
    await page.getByRole("button", { name: "Next chapter" }).click();
  await page.getByRole("button", { name: "Generate demo itinerary" }).click();
  await expect(
    page.getByRole("heading", { name: "Baguio — my island story" }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByText("DEMO-GENERATED ITINERARY", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Day 2 Baguio" }).click();
  await expect(
    page.getByText("Baguio, at your own pace", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Baguio — my island story" }),
  ).toBeVisible();
  if (errors.length) throw new Error(errors.join("\n"));
  console.log(
    "Phase 2 browser: six-step questionnaire, demo API, itinerary days, and reload persistence passed.",
  );
} finally {
  await browser.close();
}
