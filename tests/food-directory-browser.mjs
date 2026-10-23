import {chromium,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const content=await read('lib/catalog/place-content.json'),decisions=await read('docs/food-directory/media/decisions.json');
const approved=decisions.entries.filter(e=>e.approved),origin=process.env.LAKBAY_TEST_ORIGIN||'http://localhost:5180';
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
// Read-only catalog checks need no live account, successful storage simulation,
// database or Google account. Account lifecycle has its separate fixture suite.
await page.route('**/api/account/session',route=>route.fulfill({json:{enabled:false,user:null,reason:'Food-directory browser test'}}));
await page.route('**/api/discovery',route=>route.fulfill({status:503,json:{error:'Readership unavailable in catalog test'}}));
try{
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});
  await page.goto(origin+'/discover?destination=Iloilo&food=cafe&q=Mandurriao');
  const spots=page.getByRole('region',{name:'Spots to discover.'});
  await expect(page.getByLabel('Food type',{exact:true})).toHaveValue('cafe');
  await expect(page.getByLabel('Browsing destination')).toHaveValue('Iloilo');
  await expect(spots.getByRole('status')).toContainText('4 matching locations in Iloilo');
  await page.getByLabel('Place category',{exact:true}).selectOption('Food & drink');
  await expect(spots.locator('.discovery-card')).toHaveCount(4);
  await expect(page).toHaveURL(/food=cafe/);await page.reload();
  await expect(page.getByLabel('Search places')).toHaveValue('Mandurriao');
  await expect(page.getByLabel('Place category',{exact:true})).toHaveValue('Food & drink');
  await page.goto(origin+'/discover?food=cafe');
  await expect(spots.locator('.discovery-card')).toHaveCount(12);
  const first=await spots.locator('.discovery-card h3').allTextContents();
  await page.getByRole('button',{name:'Next spots',exact:true}).click();
  await expect(spots.getByRole('status')).toContainText('Page 2');
  assert.ok(!(await spots.locator('.discovery-card h3').allTextContents()).some(n=>first.includes(n)));
  await page.reload();await expect(spots.getByRole('status')).toContainText('Page 2');
  await page.getByLabel('Food type',{exact:true}).selectOption('market');
  await expect(spots.getByRole('status')).toContainText('3 matching locations');
  await expect(spots.getByRole('status')).toContainText('Page 1');
  await page.getByLabel('Browsing destination').selectOption('Baguio');
  await expect(spots.locator('.discovery-card')).toHaveCount(0);
  await page.getByRole('button',{name:'Clear all filters',exact:true}).click();
  await expect(page.getByLabel('Food type',{exact:true})).toHaveValue('all');
  await expect(spots.getByRole('status')).toContainText('426 matching locations');
  for(const e of approved){
   const c=content.find(p=>p.placeId===e.placeId),photo=c.photo;
   await page.goto(origin+`/discover?q=${encodeURIComponent(e.placeId==='baguio-foam-legarda'?'Foam Coffee':e.placeId==='cebu-cafe-laguna-ayala'?'Café Laguna':e.placeId==='iloilo-robertos-jm-basa'?'Roberto’s':e.placeId==='sagada-yoghurt-house'?'Yoghurt House':'Vietville')}`);
   const card=page.locator('.discovery-card').filter({has:page.locator(`a[href="/discover/${e.placeId}"]`)});
   await expect(card).toHaveCount(1);const img=card.locator('img');await img.scrollIntoViewIfNeeded();
   await expect.poll(()=>img.evaluate(n=>n.complete&&n.naturalWidth>0)).toBe(true);await expect(img).toHaveAttribute('alt',photo.alt);
   await page.goto(origin+'/discover/'+e.placeId);await expect(page.getByRole('region',{name:'Food and coffee'})).toBeVisible();
   const hero=page.locator('.discovery-detail-hero img');await expect.poll(()=>hero.evaluate(n=>n.complete&&n.naturalWidth>0)).toBe(true);
   await expect(hero).toHaveAttribute('width',String(photo.width));await expect(hero).toHaveAttribute('height',String(photo.height));
   await page.locator('#place-sources>summary').click();await expect(page.getByRole('link',{name:'Original image',exact:true})).toHaveAttribute('href',photo.originalUrl);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  }
  await page.goto(origin+'/discover/davao-purge-tulip');
  await expect(page.getByRole('img',{name:'Photograph unavailable for Purge Coffee Roaster — Tulip Drive'})).toBeVisible();
  await expect(page.locator('.place-municipality')).toContainText('Davao City');
  await expect(page.getByRole('region',{name:'Food and coffee'})).toContainText('coffee roasting');
  await expect(page.locator('.place-videos')).toHaveCount(0);
  await page.screenshot({path:`tests/food-detail-${width}.png`,fullPage:true});
  await page.goto(origin+'/discover/puerto-princesa-jeju-island-cafe');
  await expect(page.getByRole('region',{name:'Food and coffee'})).toContainText('Specific drinks and meal suitability have not been verified.');
  await page.goto(origin+'/discover/iloilo-netongs-la-paz');
  await expect(page.getByRole('region',{name:'Food and coffee'})).toContainText('15 April 2026');
  await expect(page.getByRole('region',{name:'Food and coffee'})).toContainText('not a current quote');
  await page.goto(origin+'/discover?destination=Iloilo&food=cafe');
  await page.screenshot({path:`tests/food-directory-${width}.png`,fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
 assert.deepEqual(errors,[]);
 console.log('Food directory passed at 1440/390 px: combined filters, URL restore, pagination, zero/reset states, 5 licensed photos on cards/details, source links, dimensions, honest no-photo/no-video fallback and no horizontal overflow.');
}finally{await browser.close();}
