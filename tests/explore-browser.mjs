import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { defaultRequest } from "../lib/trip.ts";
import { generateDemo } from "../lib/engine.ts";

const origin = process.env.LAKBAY_TEST_ORIGIN || "http://localhost:5173";
const draft = {
  ...defaultRequest,
  startDate: "2026-12-12",
  destinations: ["cebu"],
  days: 12,
  budget: 76543,
  pace: "Chill",
  diet: "Vegetarian",
  must: "Keep my note",
};
const trip = generateDemo({ ...draft, days: 4 });
const browser = await chromium.launch({ channel: "chrome", headless: true });
await mkdir("work/explore-merge", { recursive: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({
        viewport: { width, height: 1000 },
        reducedMotion: "reduce",
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/account/session", (route) =>
      route.fulfill({ json: { enabled: false, user: null } }),
    );
    await page.route("**/api/discovery", (route) =>
      route.fulfill({
        status: 503,
        json: { error: "Readership unavailable in Explore test" },
      }),
    );
    await page.addInitScript(
      ({ draft, trip }) => {
        if (!sessionStorage.getItem("explore-seeded")) {
          localStorage.setItem("lakbay:draft", JSON.stringify(draft));
          localStorage.setItem("lakbay:trips", JSON.stringify([trip]));
          sessionStorage.setItem("explore-seeded", "1");
        }
      },
      { draft, trip },
    );
    await page.goto(origin + "/explore?category=Food&q=Baguio");
    const mainNav = page.getByRole("navigation", { name: "Main navigation" }),
      views = page.getByRole("navigation", { name: "Explore views" });
    if (width === 390)
      await page.getByRole("button", { name: "Toggle navigation" }).click();
    assert.deepEqual(
      (await mainNav.getByRole("link").allTextContents()).slice(0, 5),
      ["Discover", "Explore", "Plan a Trip", "My Trips", "Saved Places"],
    );
    await expect(
      mainNav.getByRole("link", { name: "Travel Guides", exact: true }),
    ).toHaveCount(0);
    if (width === 390)
      await page.getByRole("button", { name: "Toggle navigation" }).click();
    await expect(page.locator(".postcard")).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Food & cafés", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await views
      .getByRole("link", { name: "Travel advice", exact: true })
      .click();
    await expect(page).toHaveURL(/\/explore\/advice/);
    await expect(page).toHaveTitle("Travel advice — Lakbay");
    await expect(page.locator(".explore-starter-grid article")).toHaveCount(8);
    await page.getByRole("link", { name: "Getting between places" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Getting between places" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", {
        name: "PAGASA tropical cyclone bulletin page ↗",
        exact: true,
      }),
    ).toBeVisible();
    await page.goBack();
    await expect(
      views.getByRole("link", { name: "Travel advice", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page.goBack();
    await expect(page.getByLabel("Search destinations")).toHaveValue("Baguio");
    await expect(page.locator(".postcard")).toHaveCount(1);
    await page.goForward();
    await expect(page.locator(".explore-starter-grid article")).toHaveCount(8);
    await page.screenshot({ path: `work/explore-merge/advice-${width}.png` });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await views
      .getByRole("link", { name: "Destinations", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Clear destination search" })
      .click();
    await expect(page.getByLabel("Search destinations")).toBeFocused();
    await page
      .getByLabel("Search destinations")
      .pressSequentially("Palawan", { delay: 35 });
    await expect(page.locator(".postcard")).toHaveCount(3);
    await expect(page).toHaveURL(/q=Palawan/);
    await expect(
      page.getByRole("region", { name: "Palawan Choose an overnight base" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Device favorites", exact: true })
      .click();
    await expect(page.locator(".postcard")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Reset filters", exact: true })
      .click();
    await expect(page.locator(".postcard")).toHaveCount(13);
    await page.screenshot({
      path: `work/explore-merge/destinations-${width}.png`,
    });
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.goto(origin + "/destinations/baguio");
    await expect(
      page.getByRole("heading", { level: 1, name: /Baguio/ }),
    ).toBeVisible();
    await expect(page.locator(".guide-highlights .discovery-card")).toHaveCount(
      3,
    );
    await expect(
      page.getByRole("link", { name: "See all places", exact: true }),
    ).toHaveAttribute("href", "/discover?destination=Baguio");
    await page
      .getByRole("link", { name: "See all places", exact: true })
      .click();
    await expect(page.getByLabel("Browsing destination")).toHaveValue("Baguio");
    await page.goBack();
    await expect(
      page.getByRole("heading", { level: 1, name: /Baguio/ }),
    ).toBeVisible();
    const before = await page.evaluate(() =>
      localStorage.getItem("lakbay:draft"),
    );
    await page
      .locator(".detail-hero")
      .getByRole("link", { name: "Plan a trip here", exact: true })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Use these choices for your draft?",
    });
    await expect(dialog).toBeVisible();
    assert.equal(
      await page.evaluate(() => localStorage.getItem("lakbay:draft")),
      before,
    );
    await expect(
      dialog.getByRole("button", { name: "Keep my draft", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Cebu", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    assert.deepEqual(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("lakbay:draft")),
      ),
      draft,
    );
    await page.goto(origin + "/destinations/coron");
    await page
      .locator(".detail-hero")
      .getByRole("link", { name: "Plan a trip here", exact: true })
      .click();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Add to my existing destinations").check();
    await dialog
      .getByRole("button", { name: "Apply to planner draft", exact: true })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem("lakbay:draft")).destinations,
        ),
      )
      .toEqual(["cebu", "coron"]);
    assert.deepEqual(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("lakbay:draft")),
      ),
      { ...draft, destinations: ["cebu", "coron"] },
    );
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Coron", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(dialog).toHaveCount(0);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("lakbay:trips")),
      JSON.stringify([trip]),
    );
    const threeBases = { ...draft, destinations: ["cebu", "bohol", "baguio"] };
    await page.evaluate(
      (value) => localStorage.setItem("lakbay:draft", JSON.stringify(value)),
      threeBases,
    );
    await page.goto(origin + "/planner?destinations=coron");
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Add to my existing destinations").check();
    await dialog
      .getByRole("button", { name: "Apply to planner draft" })
      .click();
    await expect(dialog.getByRole("alert")).toContainText("3");
    assert.deepEqual(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("lakbay:draft")),
      ),
      threeBases,
    );
    await dialog.getByRole("button", { name: "Keep my draft" }).click();
    await expect(dialog).toHaveCount(0);
    await page.evaluate(() =>
      localStorage.setItem("lakbay:draft", "{invalid saved draft"),
    );
    await page.goto(origin + "/planner?destinations=baguio");
    await expect(
      page.getByRole("button", {
        name: "Start a new planner draft",
        exact: true,
      }),
    ).toBeVisible();
    assert.equal(
      await page.evaluate(() => localStorage.getItem("lakbay:draft")),
      "{invalid saved draft",
    );
    await page
      .getByRole("button", { name: "Start a new planner draft", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Baguio", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect
      .poll(() =>
        page.evaluate(
          () => JSON.parse(localStorage.getItem("lakbay:draft")).destinations,
        ),
      )
      .toEqual(["baguio"]);
    assert.equal(
      await page.evaluate(() => localStorage.getItem("lakbay:trips")),
      JSON.stringify([trip]),
    );
    await page.evaluate(() => localStorage.removeItem("lakbay:draft"));
    await page.goto(origin + "/explore?view=advice");
    const starter = page.locator(".explore-starter-grid article").filter({
      has: page.getByRole("heading", {
        name: "Baguio Weekend Escape",
        exact: true,
      }),
    });
    await starter
      .getByRole("link", { name: "Customize in Plan a Trip" })
      .click();
    await expect(page.getByLabel("Number of days")).toHaveValue("3");
    await expect(
      page.getByRole("button", { name: "Baguio", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(dialog).toHaveCount(0);
    // Destination association and legacy province pages remain explicit.
    await page.goto(origin + "/destinations/palawan");
    await expect(page.locator(".guide-base-links a")).toHaveCount(3);
    await expect(
      page
        .locator(".detail-hero")
        .getByRole("link", { name: "Choose a Palawan base" }),
    ).toHaveAttribute("href", "#travel-bases");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    const response = await page.request.get(
      origin +
        "/templates?destinations=cebu&days=4&category=Food&tag=one&tag=two",
      { maxRedirects: 0 },
    );
    assert.equal(response.status(), 308);
    const target = new URL(response.headers().location, origin);
    assert.equal(target.pathname, "/explore/advice");
    assert.equal(target.searchParams.get("view"), null);
    assert.deepEqual(target.searchParams.getAll("tag"), ["one", "two"]);
    assert.equal(target.searchParams.get("destinations"), "cebu");
    await page.goto(origin + "/templates?category=Food#starters-title");
    await expect(page).toHaveURL(/\/explore\/advice\?.*#starters-title/);
    await expect(page.locator(".explore-starter-grid article")).toHaveCount(8);
    await page.goto(origin + "/explore/advice/unknown");
    await expect(
      page.getByRole("heading", { name: "Travel advice not found." }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Browse travel advice" }),
    ).toHaveAttribute("href", "/explore/advice");
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(
    "Explore merge passed at desktop/mobile: navigation, interests/search/favorites, advice/articles/starters, filtered Discover, draft preview/Escape/acceptance/reload, exact saved-trip preservation, malformed recovery, Palawan bases, permanent redirect/query/hash and Back/Forward.",
  );
} finally {
  await browser.close();
}
