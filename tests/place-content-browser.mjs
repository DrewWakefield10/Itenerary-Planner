import {chromium,expect} from "@playwright/test";
import assert from "node:assert/strict";
const browser=await chromium.launch({channel:"chrome",headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),origin=process.env.LAKBAY_TEST_ORIGIN||"http://127.0.0.1:5173",errors=[];
page.on("pageerror",e=>errors.push(e.message));
try{
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:1000});await page.goto(origin+"/discover?destination=Iloilo&q=Plaza");
    const spots=page.getByRole("region",{name:"Spots to discover."}),attention=page.getByRole("region",{name:"Gaining attention."});
    await expect(spots).toBeVisible();assert.equal(await spots.evaluate((el)=>!!(el.compareDocumentPosition(document.querySelector('[aria-labelledby="attention-title"]'))&Node.DOCUMENT_POSITION_FOLLOWING)),true);
    assert.ok((await spots.boundingBox()).y<(await attention.boundingBox()).y);
    await expect(spots.getByRole("status")).toContainText("matching locations in Iloilo");
    await spots.getByRole("link",{name:"View place",exact:true}).filter({hasText:"View place"}).first().click();
    await page.goto(origin+"/discover/iloilo-jaro-plaza-heritage-area");
    await expect(page.getByRole("heading",{name:"Jaro Plaza",exact:true})).toBeVisible();
    await expect(page.locator(".place-municipality")).toContainText("Iloilo City");
    await expect.poll(()=>page.locator(".discovery-detail-hero img").evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
    await expect(page.getByRole("heading",{name:"Highlights",exact:true})).toBeVisible();
    await expect(page.getByRole("heading",{name:"Watch before you visit."})).toBeVisible();
    const players=page.locator(".place-video-player iframe");assert.equal(await players.count(),2);
    for(const player of await players.all()){
      const src=await player.getAttribute("src");assert.match(src,/youtube-nocookie\.com\/embed\//);assert.equal(src.includes("autoplay"),false);
      await expect(player).toHaveAttribute("loading","lazy");await expect(player).toHaveAttribute("allowfullscreen","");
      const box=await player.boundingBox();assert.ok(Math.abs(box.width/box.height-16/9)<0.03);
    }
    await expect(page.getByRole("link",{name:"Open on YouTube",exact:false})).toHaveCount(2);
    await expect(page.getByText("Unknown. Check with the venue.",{exact:false}).first()).toBeVisible();
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:`tests/place-details-${width}.png`,fullPage:true});
    await page.locator("#place-sources>summary").click();await expect(page.getByRole("link",{name:"Original image",exact:true})).toBeVisible();
    await page.goto(origin+"/discover/iloilo-plaza-libertad");
    for(const src of await page.locator(".place-video-player iframe").evaluateAll(nodes=>nodes.map(n=>n.src)))assert.equal(/xd-zBaof0NY|RSw_SOxNuVM/.test(src),false);
  }
  // A known place without a video has no empty video section.
  await page.goto(origin+"/discover/cebu-turning-wheels-brewery");await expect(page.locator(".place-videos")).toHaveCount(0);
  const fallbackPage=await browser.newPage();
  await fallbackPage.route("**/images/places/**",route=>route.abort());
  await fallbackPage.goto(origin+"/discover/iloilo-jaro-plaza-heritage-area");await expect(fallbackPage.getByRole("img",{name:"Photograph unavailable for Jaro Plaza"})).toBeVisible();
  await fallbackPage.close();
  assert.deepEqual(errors,[]);
  console.log("Place content: DOM order, combined filters, licensed local photos/fallback, overviews, exact video IDs, 16:9 embeds, external/fullscreen controls and desktop/mobile passed.");
}finally{await browser.close();}
