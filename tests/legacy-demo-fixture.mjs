import { expect } from "@playwright/test";

// The previous demo API supplies snapshots for legacy editor and import tests.
export async function openLegacyDemo(page, overrides = {}) {
  await expect(page.getByText("Draft saved on this browser")).toBeVisible();
  const request = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("lakbay:draft")),
  );
  const origin = new URL(page.url()).origin;
  const response = await page.request.post(origin + "/api/generate", {
    data: { request: { ...request, ...overrides }, demo: true },
  });
  await expect(response).toBeOK();
  const { trip } = await response.json();
  await page.evaluate(
    (value) => localStorage.setItem("lakbay:trips", JSON.stringify([value])),
    trip,
  );
  await page.goto(origin + "/trips/" + trip.id);
  return trip;
}
