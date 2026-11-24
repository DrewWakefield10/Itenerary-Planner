import { chromium, expect } from "@playwright/test";
import assert from "node:assert/strict";

const origin = process.env.LAKBAY_TEST_ORIGIN || "http://localhost:5173";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const width of [1440, 390, 320]) {
    const context = await browser.newContext({
      viewport: { width, height: 920 },
      hasTouch: width < 760,
      isMobile: width < 760,
    });
    const page = await context.newPage();
    const errors = [],
      requests = [];
    let fail = false;
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/account/session", (r) =>
      r.fulfill({ json: { enabled: false, user: null } }),
    );
    await page.route("**/api/discovery", (r) =>
      r.fulfill({ status: 503, json: {} }),
    );
    await page.route("https://www.instagram.com/**", async (route) => {
      requests.push(route.request().url());
      if (fail) return route.abort();
      if (route.request().url().endsWith("embed.js"))
        return route.fulfill({
          contentType: "text/javascript",
          body: 'window.instgrm={Embeds:{process(){for(const post of document.querySelectorAll("blockquote.instagram-media")){const frame=document.createElement("iframe");frame.title="Instagram fixture";frame.style="width:100%;height:735px;border:0;display:block";frame.srcdoc="<p>Test widget</p>";post.replaceWith(frame);}}}};',
        });
      return route.abort();
    });
    await page.goto(origin + "/discover/baguio-burnham-park");
    const gallery = page.getByRole("region", {
      name: "More photos from Instagram",
    });
    const cover = page.locator(".discovery-detail-hero figure");
    const overview = page.getByRole("region", { name: "A little closer." });
    await expect(gallery).toBeVisible();
    await expect(cover.locator(".place-photo")).toBeVisible();
    await expect(
      cover.getByRole("link", { name: "Photo source and reuse license" }),
    ).toBeVisible();
    const g = await gallery.boundingBox(),
      c = await cover.boundingBox(),
      o = await overview.boundingBox();
    assert.ok(Math.abs(c.x - g.x) < 2 && Math.abs(c.width - g.width) < 2);
    assert.ok(g.y >= c.y + c.height - 1);
    if (width >= 760) {
      assert.ok(o.x < g.x && Math.abs(o.y - g.y) < 2);
    } else assert.ok(o.y >= g.y + g.height - 1);
    assert.deepEqual(requests, []);
    await expect(gallery.getByRole("status")).toHaveText("1 of 2");
    const track = gallery.getByRole("group", { name: "Instagram posts" });
    if (width === 390) {
      await track.scrollIntoViewIfNeeded();
      const box = await track.boundingBox();
      const session = await context.newCDPSession(page);
      const y = Math.floor(box.y + Math.min(box.height / 2, 60)),
        start = Math.floor(box.x + box.width * 0.85);
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [{ x: start, y }],
      });
      for (let i = 1; i <= 7; i++)
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove",
          touchPoints: [{ x: start - i * 35, y }],
        });
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } else {
      await track.focus();
      await track.press("ArrowRight");
    }
    await expect(gallery.getByRole("status")).toHaveText("2 of 2");
    await gallery
      .getByRole("button", { name: "Previous Instagram post" })
      .click();
    await expect(gallery.getByRole("status")).toHaveText("1 of 2");
    await gallery.getByRole("button", { name: "Load Instagram posts" }).click();
    if (width >= 390) {
      const frame = gallery.locator("iframe").first();
      await expect(frame).toBeVisible();
      assert.equal((await frame.boundingBox()).height, 735);
      assert.ok((await frame.boundingBox()).width >= 326);
    } else {
      await expect(gallery.getByText(/at this screen width/)).toBeVisible();
      await expect(gallery.locator("iframe")).toHaveCount(0);
    }
    await expect(
      gallery.getByRole("link", { name: /View on Instagram/ }).first(),
    ).toBeVisible();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    await page.goto(origin + "/discover/siargao-spotted-pig-catangnan");
    await expect(gallery).toBeVisible();
    await expect(
      page.locator(".discovery-detail-hero .place-photo-fallback"),
    ).toBeVisible();
    await expect(
      gallery.getByRole("button", { name: "Next Instagram post" }),
    ).toHaveCount(0);
    await page.goto(origin + "/discover/el-nido-corong-corong-beach");
    await expect(
      page.getByRole("heading", { name: "Corong Corong Beach", exact: false }),
    ).toBeVisible();
    await expect(gallery).toHaveCount(0);
    await page.goto(origin + "/discover?destination=Siargao&q=Spotted%20Pig");
    await expect(page.getByLabel("Browsing destination")).toHaveValue(
      "Siargao",
    );
    await expect(
      page.getByRole("searchbox", { name: "Search places" }),
    ).toHaveValue("Spotted Pig");
    const gridLink = page
      .getByRole("link", { name: "See more photos", exact: true })
      .first();
    await expect(gridLink).toHaveAttribute(
      "href",
      "/discover/siargao-spotted-pig-catangnan#instagram-photos",
    );
    await expect(page.locator("iframe")).toHaveCount(0);
    fail = true;
    await gridLink.click();
    await expect(gallery).toBeVisible();
    await gallery.getByRole("button", { name: "Load Instagram posts" }).click();
    await expect(
      gallery.getByText(/Instagram could not load here/),
    ).toBeVisible();
    await expect(
      gallery.getByRole("link", { name: /View on Instagram/ }),
    ).toBeVisible();
    assert.deepEqual(errors, []);
    await context.close();
  }
  console.log(
    "Instagram gallery passed 1440/390/320 px: cover alignment, mobile stack, swipe, keyboard, one/empty states, opt-in, tall widget, blocked script links and filtered Discover.",
  );
} finally {
  await browser.close();
}
