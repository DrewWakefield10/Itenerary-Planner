import {chromium,expect} from '@playwright/test';
import {readFile,readdir,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const root='docs/place-enrichment/cover-completion',approved=[];
for(const file of await readdir(root))if(file.endsWith('-decisions.json'))approved.push(...(await read(root+'/'+file)).entries.filter(e=>e.approved));
const catalog=await read('public/data/lakbay-locations.json');
const origin=process.env.LAKBAY_TEST_ORIGIN||'http://localhost:5180';
await mkdir('work/cover-browser',{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/account/session',route=>route.fulfill({json:{enabled:false,user:null}}));
 await page.route('**/api/discovery',route=>route.fulfill({status:503,json:{error:'Unavailable in image test'}}));
 for(const entry of approved){
  const row=catalog.find(p=>p.id===entry.placeId),photo=row.image;
  await page.goto(origin+'/discover?q='+encodeURIComponent(row.name));
  const card=page.locator('.discovery-card').filter({has:page.locator(`a[href="/discover/${row.id}"]`)});
  await expect(card).toHaveCount(1);const image=card.getByRole('img',{name:photo.alt});await image.scrollIntoViewIfNeeded();
  await expect.poll(()=>image.evaluate(n=>n.complete&&n.naturalWidth>0)).toBe(true);
  await expect(image).toHaveAttribute('width',String(photo.width));await expect(image).toHaveAttribute('height',String(photo.height));
  await page.goto(origin+'/discover/'+row.id);
  const cover=page.locator('.discovery-detail-hero').getByRole('img',{name:photo.alt});
  await expect.poll(()=>cover.evaluate(n=>n.complete&&n.naturalWidth>0)).toBe(true);
  await expect(page.locator('.place-instagram-cover')).toHaveCount(0);
  await page.locator('#place-sources>summary').click();
  await expect(page.getByRole('link',{name:'Original image',exact:true})).toHaveAttribute('href',photo.originalUrl);
  await expect(page.getByRole('link',{name:photo.license,exact:true})).toHaveAttribute('href',photo.licenseUrl);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:`work/cover-browser/${row.id}-${width}.png`});
 }
 assert.deepEqual(errors,[]);await page.close();
}console.log(`${approved.length} new covers passed on cards/details at desktop/mobile: decoded local images, dimensions, attribution/source links, photo preference and no overflow.`);
}finally{await browser.close();}
