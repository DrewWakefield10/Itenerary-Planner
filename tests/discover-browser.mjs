import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const origin = "http://127.0.0.1:5173";
const directory = JSON.parse(
  await (await page.request.get(origin + "/data/lakbay-locations.json")).text(),
);
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const external = [];
page.on("request", (r) => {
  if (/wikimedia.org\/api|wikipedia.org\/w\/api/.test(r.url()))
    external.push(r.url());
});
try {
  await page.goto(origin);
  await expect(
    page.getByRole("link", { name: "Discover", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Discover places", exact: false }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Discover", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Good places. Little detours." }),
  ).toBeVisible();
  await expect(
    page.getByText("Current interest data is unavailable.", { exact: false }),
  ).toBeVisible();
  const spots = page.getByRole("region", { name: "Spots to discover." });
  await expect(spots.locator(".discovery-card")).toHaveCount(12);
  await expect(
    page.getByRole("heading", { name: "Explore Destinations." }),
  ).toBeVisible();
  await expect(page.locator(".directory-destination")).toHaveCount(11);
  await expect(spots.getByRole("status")).toContainText(
    `${directory.length} matching locations`,
  );
  const response = await page.request.get(origin + "/api/discovery");
  assert.match(response.headers()["cache-control"], /s-maxage=3600/);
  assert.equal(
    (await page.request.post(origin + "/api/discovery")).status(),
    405,
  );
  await page.getByLabel("Browsing destination").selectOption("Cebu");
  await expect(spots.getByRole("status")).toContainText(
    `${directory.filter(p=>p.destination_group==="Cebu").length} matching locations in Cebu`,
  );
  await page
    .getByLabel("Place category", { exact: true })
    .selectOption("Culture");
  const culture = directory.filter(
    (p) => p.destination_group === "Cebu" && p.category === "Culture",
  );
  await expect(spots.locator(".discovery-card")).toHaveCount(
    Math.min(12, culture.length),
  );
  await page.getByLabel("Search places", { exact: false }).fill("Casa Gorordo");
  await expect(spots.locator(".discovery-card")).toHaveCount(1);
  await expect(
    spots.getByRole("heading", { name: "Casa Gorordo Museum" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Browsing destination")).toHaveValue("Cebu");
  await expect(page.getByLabel("Search places", { exact: false })).toHaveValue(
    "Casa Gorordo",
  );
  await page.getByRole("button", { name: "Clear all filters" }).click();
  await page.getByLabel("Browsing destination").selectOption("Bohol");
  await page.getByLabel("Search places", { exact: false }).fill("Dauis");
  await expect(spots.locator(".discovery-card")).toHaveCount(
    directory.filter(
      (p) =>
        p.destination_group === "Bohol" &&
        [p.name, p.description, p.city_municipality, p.address]
          .join(" ")
          .toLowerCase()
          .includes("dauis"),
    ).length,
  );
  await page
    .getByLabel("Search places", { exact: false })
    .fill("nothing matches this");
  await expect(
    spots.getByText("No locations match these filters.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear all filters" }).click();
  const first = await spots.locator("h3").first().innerText();
  await page.getByRole("button", { name: "Next spots", exact: true }).click();
  await expect(spots.getByRole("status")).toContainText("Page 2");
  assert.notEqual(await spots.locator("h3").first().innerText(), first);
  await page.reload();
  await expect(spots.getByRole("status")).toContainText("Page 2");
  await page
    .getByRole("button", { name: "Previous spots", exact: true })
    .click();
  await page.getByLabel("Travel interest").selectOption("Food Hunter");
  assert.ok((await spots.locator(".discovery-card").count()) > 0);
  await page.getByRole("button", { name: "Clear all filters" }).click();
  const select = page.getByLabel("Browsing destination");
  await select.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Clear all filters" }).click();
  const nearby = page.getByRole("region", { name: "Explore nearby." });
  await expect(
    nearby.getByText("km straight-line distance", { exact: false }),
  ).toHaveCount(2);
  await page.getByLabel("Nearby overnight base").selectOption("cebu");
  await expect(
    nearby.getByText("No nearby spots with verified coordinates", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByLabel("Nearby overnight base").selectOption("baguio");
  for (const image of await page.locator(".discovery-card img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((i) => i.complete && i.naturalWidth > 0))
      .toBe(true);
  }
  await page.screenshot({ path: "tests/discover-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await spots.scrollIntoViewIfNeeded();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.screenshot({ path: "tests/discover-mobile.png" });
  await page.locator(".explore-destinations").scrollIntoViewIfNeeded();
  for (const button of await page.locator(".directory-destination").all()) {
    const box = await button.boundingBox();
    assert.ok(box.width >= 44 && box.height >= 44);
  }
  await page.screenshot({ path: "tests/directory-mobile.png" });
  const outside = directory.find(
    (p) => p.city_municipality === "San Vicente" && !p.itinerary_base_slug,
  );
  await page.goto(origin + "/discover/" + outside.id);
  await expect(
    page.getByText("City / municipality:", { exact: false }).locator(".."),
  ).toContainText("San Vicente");
  await expect(
    page.getByRole("button", { name: "Add to my trip", exact: true }),
  ).toHaveCount(0);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  const metro = directory.find((p) => p.city_municipality === "Makati City");
  await page.goto(origin + "/discover/" + metro.id);
  await expect(
    page.getByText("City / municipality:", { exact: false }).locator(".."),
  ).toContainText("Makati City");
  await expect(
    page.getByRole("link", { name: /Municipality: Checked/ }),
  ).toHaveAttribute("href", metro.sources.municipality.sourceUrl);
  await page.goto(origin + "/discover?page=999");
  await expect(spots.getByRole("status")).toContainText(`Page ${Math.ceil(directory.length/12)} of ${Math.ceil(directory.length/12)}`);
  await expect(spots.locator(".discovery-card")).toHaveCount(directory.length%12||12);
  await page.goto(origin + "/discover/baguio-wright-park");
  await expect(
    page.getByRole("heading", { name: "Wright Park", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".trip-map")).toHaveCount(0);
  await page.getByRole("button", { name: "Show location map" }).click();
  await expect(
    page.locator('.leaflet-marker-icon[title="Wright Park"]'),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Add to my trip", exact: true })
    .click();
  await expect(
    page.getByText("No saved trip has an eligible day", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close discovery addition" }).click();
  await expect(
    page.getByRole("link", { name: "Plan a trip here", exact: false }).first(),
  ).toHaveAttribute("href", "/planner?destinations=baguio");
  // One real generated saved trip; clear one day's activities to test additions
  // without making the planner move or replace generated activities for us.
  await page.goto(origin + "/planner?destinations=baguio&days=3");
  await expect(page.getByLabel("Number of days")).toHaveValue("3");
  for (let i = 0; i < 5; i++)
    await page.getByRole("button", { name: "Next chapter" }).click();
  await page.getByRole("button", { name: "Generate demo itinerary" }).click();
  await expect(
    page.getByRole("heading", {
      name: "Baguio — my island story",
      exact: true,
    }),
  ).toBeVisible();
  const before = await page.evaluate(() => {
    const trips = JSON.parse(localStorage.getItem("lakbay:trips"));
    trips[0].days[1].activities = [];
    localStorage.setItem("lakbay:trips", JSON.stringify(trips));
    return trips[0];
  });
  await page.goto(origin + "/discover/baguio-botanical-garden");
  await page
    .getByRole("button", { name: "Add to my trip", exact: true })
    .click();
  await expect(page.getByLabel("Choose saved trip")).toHaveValue(before.id);
  await page.getByLabel("Choose itinerary day").selectOption("1");
  await page.getByLabel("Visit start time").fill("10:00");
  const unchanged = await page.evaluate(() =>
    localStorage.getItem("lakbay:trips"),
  );
  await page
    .getByRole("button", { name: "Preview addition", exact: true })
    .click();
  await expect(
    page.getByRole("region", { name: "Addition preview" }),
  ).toBeVisible();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("lakbay:trips")),
    unchanged,
  );
  await page.getByRole("button", { name: "Keep itinerary unchanged" }).click();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("lakbay:trips")),
    unchanged,
  );
  await page
    .getByRole("button", { name: "Preview addition", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm & add", exact: true })
    .click();
  await expect(
    page.getByText("Added to your trip.", { exact: false }),
  ).toBeVisible();
  const after = await page.evaluate(
    () => JSON.parse(localStorage.getItem("lakbay:trips"))[0],
  );
  assert.deepEqual(after.request, before.request);
  assert.deepEqual(after.days[0], before.days[0]);
  assert.deepEqual(after.days[2], before.days[2]);
  const added = after.days[1].activities[0];
  assert.equal(added.name, "Baguio Botanical Garden");
  assert.equal(added.start, "10:00");
  assert.equal(added.sources.description.status, "verified");
  assert.equal(added.sources.price.status, "estimate");
  await page.getByRole("link", { name: "Open your updated trip" }).click();
  await page.getByRole("button", { name: "Day 2 Baguio", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Baguio Botanical Garden", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Baguio — my island story",
      exact: true,
    }),
  ).toBeVisible();
  // Test-only responses exercise successful and stale presentation. These
  // synthetic counts are never stored in the published snapshot or rankings.
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 1);
  const date = (n) =>
    new Date(end.getTime() + n * 86400000).toISOString().slice(0, 10);
  const data = {
    project: "en.wikipedia.org",
    agent: "user",
    access: "all-access",
    title: "Baguio",
    pageId: 162480,
    fetchedAt: new Date().toISOString(),
    start: date(-13),
    end: date(0),
    sourceUrl:
      "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/Baguio/daily/" +
      date(-13).replaceAll("-", "") +
      "00/" +
      date(0).replaceAll("-", "") +
      "00",
    days: [],
  };
  const fixture = {
    updatedAt: data.fetchedAt,
    lastAttemptAt: data.fetchedAt,
    retryAfter: null,
    thresholds: {
      baseline: 700,
      absoluteGrowth: 200,
      percentGrowth: 20,
      freshnessHours: 72,
    },
    requestedPeriod: { start: data.start, end: data.end },
    rows: [
      {
        placeId: "base-baguio",
        title: "Baguio",
        data,
        comparison: {
          previous: 700,
          latest: 980,
          increase: 280,
          percent: 40,
          qualifies: true,
          previousStart: date(-13),
          previousEnd: date(-7),
          latestStart: date(-6),
          latestEnd: date(0),
        },
        fresh: true,
        error: null,
        qualifies: true,
      },
    ],
  };
  await page.route("**/api/discovery", (route) =>
    route.fulfill({ json: fixture }),
  );
  await page.goto(origin + "/discover");
  const attention = page.getByRole("region", { name: "Gaining attention." });
  await expect(attention.locator(".discovery-card")).toHaveCount(1);
  await expect(
    attention.getByText("Wikipedia readership increased over this period.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    attention.getByText("+40% readership", { exact: true }),
  ).toBeVisible();
  await expect(
    attention.getByText("human-reader pageviews", { exact: false }),
  ).toBeVisible();
  assert.match(await attention.innerText(), /UTC/);
  fixture.rows[0].data.fetchedAt = new Date(
    Date.now() - 96 * 3600000,
  ).toISOString();
  await page.reload();
  await expect(
    attention.getByText("Current interest data is unavailable.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(attention.locator(".discovery-card")).toHaveCount(0);
  await page
    .getByText("Readership coverage, freshness & methodology", { exact: true })
    .click();
  await expect(
    page.getByText("Stale — excluded from rankings", { exact: false }),
  ).toBeVisible();
  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  console.log(
    "Discover browser: navigation/home teaser, search/filtering, honest unavailable readership, mobile layout, lazy map, exact-base add preview/dismiss/confirm, sources and persistence passed.",
  );
} finally {
  await browser.close();
}
