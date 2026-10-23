import {chromium, expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const browser = await chromium.launch({channel:'chrome', headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[]; page.on('pageerror',e=>errors.push(e.message));
const origin=process.env.LAKBAY_TEST_ORIGIN||'http://127.0.0.1:5173';
async function acceptRequestedBases(){
  const dialog=page.getByRole('dialog',{name:'Use these choices for your draft?'});
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Use the destinations from this link').check();
  const duration=dialog.getByRole('checkbox');if(await duration.count())await duration.check();
  await dialog.getByRole('button',{name:'Apply to planner draft',exact:true}).click();
  await expect(dialog).toHaveCount(0);
}
try {
  for (const [slug,name] of [['el-nido','El Nido'],['coron','Coron'],['puerto-princesa','Puerto Princesa']]) {
    await page.goto(`${origin}/planner?destinations=${slug}&days=8`);
    if(slug!=='el-nido')await acceptRequestedBases();
    await expect(page.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('.destination-choices [aria-pressed=true]')).toHaveCount(1);
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('lakbay:draft')||'null')?.destinations)).toEqual([slug]);
    await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('lakbay:draft')||'null')?.days)).toBe(8);
  }
  const palawan = page.getByRole('region',{name:'Palawan',exact:true});
  await expect(palawan.getByRole('heading',{name:'Palawan',exact:true})).toBeVisible();
  await expect(palawan.getByRole('button')).toHaveCount(3);
  await expect(page.getByRole('button',{name:'Palawan',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Puerto Princesa',exact:true}).click();
  const elNido=page.getByRole('button',{name:'El Nido',exact:true});
  await elNido.focus(); await page.keyboard.press('Enter');
  await expect(elNido).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Coron',exact:true}).click();
  await page.getByRole('button',{name:'Puerto Princesa',exact:true}).click();
  await expect(page.locator('.destination-choices [aria-pressed=true]')).toHaveCount(3);
  await expect.poll(()=>page.locator('.destination-choices img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0))).toBe(true);
  await page.screenshot({path:'tests/bases-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await palawan.scrollIntoViewIfNeeded();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  for (const b of await palawan.getByRole('button').all()) {
    const box=await b.boundingBox(); assert.ok(box.width>=44 && box.height>=44);
  }
  await page.screenshot({path:'tests/bases-mobile.png',fullPage:true});
  for(let i=0;i<5;i++) await page.getByRole('button',{name:'Next chapter'}).click();
  await page.getByRole('button',{name:'Generate demo itinerary'}).click();
  await expect(page.getByRole('heading',{name:'El Nido & Coron & Puerto Princesa — my island story',exact:true})).toBeVisible({timeout:15000});
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('lakbay:trips'))[0]);
  assert.deepEqual(saved.request.destinations,['el-nido','coron','puerto-princesa']);
  assert.equal(saved.days.filter(d=>d.transfer).length,2);
  for(const name of ['Coron','Puerto Princesa']) {
    const day=saved.days.findIndex(d=>!d.transfer && d.destination===(name==='Coron'?'coron':'puerto-princesa'));
    await page.getByRole('button',{name:`Day ${day+1} ${name}`,exact:true}).click();
    const pinned=saved.days[day].activities.filter(a=>a.lat!==null);
    assert.ok(pinned.length);
    await expect(page.locator('.leaflet-marker-icon[title]').first()).toHaveAttribute('title',pinned[0].name);
  }
  const downloadEvent=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export backup',exact:true}).click();
  const download=await downloadEvent;
  const exported=JSON.parse(await readFile(await download.path(),'utf8'));
  assert.deepEqual(exported.request.destinations,saved.request.destinations);
  assert.deepEqual(exported.destinationInfo,saved.destinationInfo);
  await page.goto(`${origin}/my-trips`);
  await expect(page.locator('.postcard')).toHaveCount(1);
  await page.getByLabel('Restore a Lakbay JSON backup').setInputFiles(await download.path());
  await expect(page.getByText('Backup restored as a new trip.')).toBeVisible();
  const legacy=structuredClone(exported);
  legacy.id='legacy-palawan-browser'; legacy.title='Original Palawan journey';
  legacy.request.destinations=['palawan']; delete legacy.destinationInfo;
  for(const day of legacy.days) {
    day.destination='palawan';
    for(const a of day.activities) {delete a.sources; delete a.disruptionSensitivities; delete a.openingHours;}
  }
  await page.getByLabel('Restore a Lakbay JSON backup').setInputFiles({name:'legacy-palawan.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
  await page.getByRole('link',{name:'Original Palawan journey (restored)',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Original Palawan journey (restored)',exact:true})).toBeVisible();
  const loaded=await page.evaluate(()=>JSON.parse(localStorage.getItem('lakbay:trips'))[0]);
  assert.deepEqual(loaded.request.destinations,['palawan']);
  assert.deepEqual(loaded.days.flatMap(d=>d.activities).map(a=>[a.lat,a.lng]),legacy.days.flatMap(d=>d.activities).map(a=>[a.lat,a.lng]));
  await page.goto(`${origin}/planner?destinations=palawan&days=5`);
  await acceptRequestedBases();
  await expect(page.getByRole('status')).toContainText('older');
  await page.getByRole('button',{name:'Next chapter'}).click();
  await expect(page.getByText('Choose an explicit overnight base to replace the legacy Palawan selection for this new trip.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Coron',exact:true}).click();
  await expect(page.getByRole('button',{name:'Coron',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('.legacy-base-note')).toHaveCount(0);
  await page.goto(`${origin}/explore`);
  await page.getByRole('searchbox',{name:'Search destinations'}).fill('Palawan');
  await expect(page.locator('.postcard')).toHaveCount(3);
  assert.deepEqual(errors,[]);
  console.log('Travel bases: independent selection, keyboard/mobile grouping, generation, map markers, export/import, and legacy preservation passed.');
} finally {await browser.close();}
