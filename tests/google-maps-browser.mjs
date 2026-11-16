import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { discoveryPlaces } from "../lib/discovery.ts";

const origin = process.env.LAKBAY_TEST_ORIGIN || "http://localhost:5197";
const enabled = process.env.LAKBAY_TEST_MAPS_EMBED === "true";
const places = discoveryPlaces.filter((place) => place.directory);
const missing = places.find(
  (place) =>
    !place.coordinates &&
    place.directory.destination_group === "Manila" &&
    place.directory.city_municipality !== "Manila",
);
const approximate = places.find(
  (place) =>
    place.coordinates && place.coordinates.source.status !== "verified",
);
const browser = await chromium.launch({ channel: "chrome", headless: true });
await mkdir("work/google-maps", { recursive: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    const errors = [],
      providerRequests = [];
    let providerStatus = 429;
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/account/session", (route) =>
      route.fulfill({ json: { enabled: false, user: null } }),
    );
    await page.route("**/api/discovery", (route) =>
      route.fulfill({
        status: 503,
        json: { error: "Unavailable in maps test" },
      }),
    );
    // This is an explicitly intercepted iframe fixture, NOT a Google API test.
    await page.route("https://www.google.com/maps/embed/**", (route) => {
      providerRequests.push(new URL(route.request().url()));
      return route.fulfill({
        status: providerStatus,
        contentType: "text/html",
        body: "<!doctype html><title>Intercepted provider error fixture</title><p>Browser failure fixture only.</p>",
      });
    });
    await page.goto(`${origin}/discover/${missing.id}`);
    const map = page.getByRole("region", { name: "A place on the map." });
    await expect(map).toContainText(
      "Search results are not a reviewed location match",
    );
    await expect(map).toContainText(missing.directory.city_municipality);
    await expect(map.locator("iframe")).toHaveCount(0);
    assert.equal(providerRequests.length, 0);
    const link = map.getByRole("link", { name: "Open in Google Maps" });
    const query = new URL(await link.getAttribute("href"));
    assert.equal(query.searchParams.get("api"), "1");
    assert.ok(query.searchParams.get("query").includes(missing.name));
    assert.ok(
      query.searchParams
        .get("query")
        .includes(missing.directory.city_municipality),
    );
    const directions = new URL(
      await map
        .getByRole("link", { name: "Get directions" })
        .getAttribute("href"),
    );
    assert.equal(
      directions.searchParams.get("destination"),
      query.searchParams.get("query"),
    );
    assert.equal(directions.searchParams.has("origin"), false);
    assert.equal(directions.searchParams.has("key"), false);
    if (enabled) {
      await page.clock.install();
      const load = map.getByRole("button", {
        name: "Load Google map",
        exact: true,
      });
      await load.focus();
      await load.press("Enter");
      const frame = map.locator("iframe");
      await expect(frame).toHaveCount(1);
      await frame.scrollIntoViewIfNeeded();
      await expect.poll(() => providerRequests.length).toBe(1);
      assert.equal(providerRequests[0].pathname, "/maps/embed/v1/search");
      assert.equal(
        providerRequests[0].searchParams.get("q"),
        query.searchParams.get("query"),
      );
      assert.equal(providerRequests[0].searchParams.has("center"), false);
      await expect(frame).toHaveAttribute("loading", "lazy");
      await expect(frame).toHaveAttribute(
        "referrerpolicy",
        "strict-origin-when-cross-origin",
      );
      await expect(frame).toHaveAttribute("allowfullscreen", "");
      const dimensions = await frame.boundingBox();
      assert.ok(dimensions.width >= 200 && dimensions.height >= 200);
      const styles = await frame.evaluate((el) => {
        const s = getComputedStyle(el);
        return {
          clipPath: s.clipPath,
          objectFit: s.objectFit,
          width: el.clientWidth,
        };
      });
      assert.equal(styles.clipPath, "none");
      await page.screenshot({
        path: `work/google-maps/requested-${width}.png`,
      });
      await page.clock.fastForward(13000);
      await expect(map.getByRole("status")).toContainText(
        "If the map is blank, blocked or shows an error",
      );
      // A quota/provider failure inside a cross-origin frame cannot be read.
      // Keep links and neutral recovery copy; never label onLoad a success.
      providerStatus = 503;
      await map.getByRole("button", { name: "Reload Google map" }).click();
      await expect.poll(() => providerRequests.length).toBe(2);
      await expect(link).toBeVisible();
      await expect(map.getByRole("status")).not.toContainText(
        /verified|success/i,
      );
      await page.clock.fastForward(13000);
      assert.equal(providerRequests.length, 2); // no automatic retry
      await frame.dispatchEvent("error");
      await page.clock.runFor(50);
      await expect(frame).toHaveCount(0);
      await expect(map.getByRole("status")).toContainText(
        "could not be loaded",
      );
      await expect(link).toBeVisible();
      await map.getByRole("button", { name: "Reload Google map" }).click();
      await expect.poll(() => providerRequests.length).toBe(3);
      await map.getByRole("button", { name: "Hide Google map" }).click();
      await expect(frame).toHaveCount(0);
      await expect(
        map.getByRole("button", { name: "Load Google map", exact: true }),
      ).toBeVisible();
      await expect(
        map.getByRole("button", { name: "Load Google map", exact: true }),
      ).toBeFocused();
    } else {
      await expect(
        map.getByRole("button", { name: "Load Google map", exact: true }),
      ).toHaveCount(0);
      await expect(map).toContainText("Use the Google Maps links");
      await map.scrollIntoViewIfNeeded();
      await page.screenshot({ path: `work/google-maps/links-${width}.png` });
    }
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.goto(`${origin}/discover/${approximate.id}`);
    const catalog = page.getByRole("region", { name: "A place on the map." });
    await expect(catalog).toContainText("Approximate catalog coordinates");
    await expect(catalog).toContainText(
      "not used for Google search centering or nearby distances",
    );
    // Preserve the existing Leaflet map, without fetching test tiles externally.
    await page.route("**.tile.openstreetmap.org/**", (route) =>
      route.fulfill({ status: 204 }),
    );
    await catalog.getByRole("button", { name: "Show location map" }).click();
    await expect(catalog.locator(".leaflet-container")).toBeVisible();
    await expect(catalog.locator(".leaflet-control-attribution")).toContainText(
      "OpenStreetMap",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(
    `Maps ${enabled ? "intercepted Embed fixture" : "missing-key"} browser checks passed at desktop/mobile: exact-location links, opt-in, no automatic requests, fallback, uncropped iframe attributes, approximate labels and retained Leaflet attribution. No live Google API requests.`,
  );
} finally {
  await browser.close();
}
