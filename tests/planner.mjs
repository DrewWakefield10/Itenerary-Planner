import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";

const origin = process.env.LAKBAY_TEST_ORIGIN || "http://127.0.0.1:5173";
const browser = await chromium.launch({ channel: "chrome", headless: true });
await mkdir("work/manual-planner", { recursive: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
      acceptDownloads: true,
    });
    const errors = [],
      requests = [];
    let providerFails = false;
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/account/session", (route) =>
      route.fulfill({ json: { enabled: false, user: null } }),
    );
    await page.route("**/api/generate", (route) => {
      const body = route.request().postDataJSON();
      requests.push(body);
      return route.fulfill(
        providerFails
          ? { status: 503, json: { error: "Fixture unavailable" } }
          : { json: { ids: body.ids, assisted: false } },
      );
    });
    async function note(kind, name, time = "", duration = "", cost = "") {
      await page
        .getByRole("button", { name: `Add ${kind}`, exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Activity name").fill(name);
      if (time) await dialog.getByLabel("Start time (optional)").fill(time);
      if (duration)
        await dialog.getByLabel("Visit length in minutes").fill(duration);
      if (cost) await dialog.getByLabel("Group cost (₱)").fill(cost);
      await dialog.getByRole("button", { name: "Save activity" }).click();
    }
    async function window(start, end, intent) {
      await page.getByRole("button", { name: "Add a time window" }).click();
      const modal = page.getByRole("dialog");
      await modal.getByLabel("Window start").fill(start);
      await modal.getByLabel("Window end").fill(end);
      await modal.getByLabel("Use this time for").selectOption(intent);
      await modal.getByRole("button", { name: "Save time window" }).click();
    }
    await page.goto(origin + "/planner?destinations=baguio&days=5");
    await expect(page.getByLabel("Number of days")).toHaveValue("5");
    await page.getByLabel("Start date").fill("2026-12-10");
    await page.getByRole("button", { name: "Next chapter" }).click();
    await expect(
      page.getByLabel("Itinerary day").locator("option"),
    ).toHaveCount(5);
    const catalog = page.locator(".manual-catalog");
    const destination = catalog.getByRole("combobox", {
      name: "Destination",
      exact: true,
    });
    const search = catalog.getByRole("searchbox", { name: "Search places" });
    const palawan = destination.locator('optgroup[label="Palawan"]');
    await expect(palawan.locator("option")).toHaveText([
      "All Palawan",
      "El Nido",
      "Coron",
      "Puerto Princesa",
    ]);
    const directory = await (
      await page.request.get(origin + "/data/lakbay-locations.json")
    ).json();
    for (const base of ["el-nido", "coron", "puerto-princesa"]) {
      await destination.selectOption(base);
      const matches = directory.filter(
        (place) => place.itinerary_base_slug === base,
      );
      await expect(catalog.getByRole("status")).toHaveText(
        `${matches.length} places`,
      );
    }
    await search.fill("Plaza Cuartel");
    await catalog
      .getByRole("combobox", { name: "Category", exact: true })
      .selectOption("Culture");
    await expect(
      catalog.getByRole("heading", { name: "Plaza Cuartel", exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(destination).toHaveValue("puerto-princesa");
    await expect(search).toHaveValue("Plaza Cuartel");
    await expect(
      catalog.getByRole("combobox", { name: "Category", exact: true }),
    ).toHaveValue("Culture");
    await destination.selectOption("el-nido");
    await expect(catalog.getByRole("status")).toHaveText("0 places");
    await catalog
      .getByRole("combobox", { name: "Category", exact: true })
      .selectOption("all");
    await destination.selectOption("Palawan");
    await search.fill("Port Barton Beach");
    await expect(
      catalog.getByRole("heading", { name: "Port Barton Beach", exact: true }),
    ).toBeVisible();
    await destination.selectOption("all");
    await search.fill("Burnham Park");
    await catalog.getByRole("button", { name: "Add to day…" }).first().click();
    let modal = page.getByRole("dialog");
    await expect(
      modal.getByRole("heading", { name: "Burnham Park", exact: true }),
    ).toBeVisible();
    await expect(modal.locator(".place-photo")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("searchbox", { name: "Search places" }),
    ).toHaveValue("Burnham Park");
    await catalog.getByRole("button", { name: "Add to day…" }).first().click();
    await page.getByRole("button", { name: "Set visit details" }).click();
    await page.getByRole("button", { name: "Save activity" }).click();
    await expect(page.locator(".manual-items")).toContainText("Burnham Park");
    await page.getByLabel("Itinerary day").selectOption("1");
    await note("reservation", "Dinner booking", "18:00", "90", "800");
    await expect(page.locator(".manual-items")).toContainText("Fixed");
    await page.getByLabel("Itinerary day").selectOption("2");
    await note("meal", "Lunch with friends", "", "60", "500");
    await page.getByLabel("Itinerary day").selectOption("3");
    await note("rest", "Hotel rest");
    await page.getByLabel("Itinerary day").selectOption("4");
    await note("personal activity", "Checkout", "10:00", "30", "0");
    await page
      .getByRole("button", { name: "The basics", exact: false })
      .first()
      .click();
    await page.getByLabel("Number of days").fill("4");
    await page.getByRole("button", { name: "Next chapter" }).click();
    await expect(page.locator(".manual-items")).toContainText("Checkout");
    await expect(
      page.getByText(/This day is outside your current duration/),
    ).toBeVisible();
    await page.getByLabel("Move Checkout to day").selectOption("3");
    await page
      .getByRole("button", { name: "The basics", exact: false })
      .first()
      .click();
    await page.getByLabel("Number of days").fill("5");
    await page.getByRole("button", { name: "Next chapter" }).click();
    await page.getByLabel("Itinerary day").selectOption("4");
    await note("personal activity", "Departure");
    await page.getByRole("button", { name: "Go to Ready to wander" }).click();
    await expect(page.locator(".manual-review li")).toHaveCount(5);
    await page.getByRole("button", { name: "Finish my itinerary" }).click();
    await expect(
      page.getByRole("heading", { name: "Baguio — my itinerary", exact: true }),
    ).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export backup" }).click();
    const backup = JSON.parse(
      await readFile(await (await download).path(), "utf8"),
    );
    assert.equal(backup.mode, "manual");
    assert.deepEqual(
      backup.days.map((day) => day.activities.map((a) => a.name)),
      [
        ["Burnham Park"],
        ["Dinner booking"],
        ["Lunch with friends"],
        ["Hotel rest", "Checkout"],
        ["Departure"],
      ],
    );
    assert.equal(requests.length, 0);
    await page.reload();
    await expect(
      page.getByLabel("Itinerary day").locator("option"),
    ).toHaveCount(5);
    await expect(page.locator(".manual-items")).toContainText("Burnham Park");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );

    // Resume the same draft and explicitly request work on one gap.
    await page.goto(origin + "/planner");
    await page.getByRole("button", { name: "Edit your itinerary" }).click();
    await page.getByLabel("Itinerary day").selectOption("0");
    await window("07:00", "08:00", "free");
    await window("09:00", "13:00", "open");
    assert.equal(requests.length, 0);
    await page
      .getByRole("button", { name: "Suggest a stop", exact: true })
      .click();
    modal = page.getByRole("dialog");
    await expect(
      modal.getByRole("button", { name: "Accept this stop" }).first(),
    ).toBeVisible();
    assert.equal(requests.length, 1);
    await modal
      .getByRole("button", { name: "Dismiss", exact: true })
      .first()
      .click();
    await modal
      .getByRole("button", { name: "Accept this stop" })
      .first()
      .click();
    await expect(modal.getByRole("status")).toContainText("Added 1 stop");
    await modal.getByRole("button", { name: "Undo additions" }).click();
    await expect(modal.getByRole("status")).toContainText(
      "Undid the last additions",
    );
    await modal.getByRole("button", { name: "Done" }).click();
    await expect(page.locator(".manual-items li")).toHaveCount(1);
    await expect(
      page.getByText("Keep free", { exact: false }).first(),
    ).toBeVisible();
    await page.screenshot({
      path: `work/manual-planner/itinerary-${width}.png`,
    });
    await page
      .getByRole("button", { name: "Your budget", exact: false })
      .first()
      .click();
    await page.getByLabel("Additional budget for suggestions (₱)").fill("0");
    await page
      .getByRole("button", { name: "Your itinerary", exact: false })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Suggest a stop", exact: true })
      .click();
    await expect(
      page.getByRole("dialog").getByText(/No stop fits comfortably/),
    ).toBeVisible();
    assert.equal(requests.length, 1);
    await page.getByRole("button", { name: "Done" }).click();
    await page
      .getByRole("button", { name: "Your budget", exact: false })
      .first()
      .click();
    await page.getByLabel("Additional budget for suggestions (₱)").fill("");
    await page
      .getByRole("button", { name: "Your itinerary", exact: false })
      .first()
      .click();
    providerFails = true;
    await page
      .getByRole("button", { name: "Suggest a stop", exact: true })
      .click();
    await expect(page.getByText(/AI ranking was unavailable/)).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();
    await page.getByRole("button", { name: "Go to Ready to wander" }).click();
    await page.locator(".manual-help-disclosure summary").click();
    await expect(
      page.getByRole("checkbox", { name: /09:00–13:00/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("checkbox", { name: /07:00–08:00/ }),
    ).toHaveCount(0);
    await page.getByRole("checkbox", { name: /09:00–13:00/ }).check();
    await page
      .getByRole("button", { name: "Suggest additions", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Accept this stop" }).first(),
    ).toBeVisible();
    assert.equal(requests.length, 3);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log(
    "Manual planner passed at desktop/mobile: five days, preview and filters, date/duration retention, save/export without AI, explicit gaps, protected time, budget limits, failure fallback and undo.",
  );
} finally {
  await browser.close();
}
