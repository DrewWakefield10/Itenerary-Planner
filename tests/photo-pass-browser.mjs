import {chromium,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const check=JSON.parse(await readFile('docs/place-enrichment/photo-only/checklist.json','utf8'));
const content=JSON.parse(await readFile('lib/catalog/place-content.json','utf8'));
const added=check.records.filter(r=>r.status==='added');assert.ok(added.length>0);
const origin=process.env.LAKBAY_TEST_ORIGIN||'http://localhost:5180',browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
// Photo verification needs no live account/database access or successful storage fixture.
await page.route('**/api/account/session',route=>route.fulfill({json:{enabled:false,user:null,reason:'Photo-only browser test'}}));
try{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  for(const row of added){
   const photo=content.find(p=>p.placeId===row.placeId).photo;
   await page.goto(`${origin}/discover?destination=${encodeURIComponent(row.destination)}&q=${encodeURIComponent(row.name)}`,{waitUntil:'domcontentloaded'});
   const card=page.locator('.discovery-card').filter({has:page.locator(`a[href="/discover/${row.placeId}"]`)});
   const image=card.locator('img');await expect(card).toHaveCount(1);await image.scrollIntoViewIfNeeded();
   await expect.poll(()=>image.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
   await expect(image).toHaveAttribute('src',photo.src);await expect(image).toHaveAttribute('alt',photo.alt);await expect(image).toHaveAttribute('loading','lazy');
   await page.goto(`${origin}/discover/${row.placeId}`,{waitUntil:'domcontentloaded'});
   const hero=page.locator('.discovery-detail-hero img');
   await expect.poll(()=>hero.evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
   await expect(hero).toHaveAttribute('src',photo.src);await expect(hero).toHaveAttribute('width',String(photo.width));await expect(hero).toHaveAttribute('height',String(photo.height));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.locator('#place-sources>summary').click();await expect(page.getByRole('link',{name:'Original image',exact:true})).toHaveAttribute('href',photo.originalUrl);
   if(['siargao-daku-island','baguio-mirador-hill','manila-ateneo-art-gallery','cebu-tingko-beach'].includes(row.placeId))await page.screenshot({path:`work/photo-pass/${row.placeId}-${width}.png`,fullPage:true});
  }
 }
 assert.deepEqual(errors,[]);console.log(`Photo pass: all ${added.length} new photographs load on cards and details at 1440/390 px, with source credits, local delivery, reserved dimensions and no horizontal overflow.`);
}finally{await browser.close();}
