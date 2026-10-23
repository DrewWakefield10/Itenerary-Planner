import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const origin=process.env.LAKBAY_TEST_ORIGIN||'http://localhost:5190',browser=await chromium.launch({channel:'chrome',headless:true});
const script='https://www.instagram.com/embed.js';
// Test the host layout against an intentionally tall official-widget-shaped
// frame. This fixture is not evidence of real Instagram post availability.
const fixture=`window.instgrm={Embeds:{process(){document.querySelectorAll('blockquote.instagram-media').forEach(q=>{const f=document.createElement('iframe');f.className='instagram-media';f.title='Instagram fixture with full controls';f.src=q.dataset.instgrmPermalink+'embed/';f.style.cssText='width:100%;min-width:326px;max-width:658px;height:1100px';q.replaceWith(f);});}}};window.instgrm.Embeds.process();`;
try{
 for(const width of [1440,820,390,320]){
  const page=await browser.newPage({viewport:{width,height:1000}}),requests=[],errors=[];
  page.on('request',r=>{if(/instagram\.com/.test(r.url()))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://www.instagram.com/**',route=>route.fulfill({contentType:route.request().url()===script?'text/javascript':'text/html',body:route.request().url()===script?fixture:'Official-widget layout fixture only'}));
  await page.goto(origin+'/discover/siargao-spotted-pig-catangnan');
  const hero=page.locator('.discovery-detail-hero'),cover=hero.locator('.place-instagram-cover');
  await expect(cover).toBeVisible();await expect(cover.locator('iframe')).toHaveCount(0);assert.deepEqual(requests,[]);
  await expect(page.locator('.place-instagram:not(.place-instagram-cover)')).toHaveCount(0);
  await expect(cover.getByRole('link',{name:'View original on Instagram',exact:false})).toHaveAttribute('href','https://www.instagram.com/p/CQr9d2jjvGv/');
  await expect(hero.locator('.place-photo')).toHaveCount(0);
  const button=cover.getByRole('button',{name:'Load Instagram preview',exact:true});
  await expect(button).toBeEnabled();
  await button.focus();await expect(button).toBeFocused();await page.keyboard.press('Enter');
  if(width===320){await expect(cover.getByRole('status')).toContainText('screen size');assert.deepEqual(requests,[]);}
  else{
   const frame=cover.locator('iframe');
   await expect(frame).toHaveCount(1);
   const box=await frame.boundingBox();assert.equal(box.height,1100);assert.ok(box.width>=326&&box.width<=658);
   // Neither the cover slot nor any page wrapper may clip or mask the widget.
   const ancestors=await frame.evaluate(el=>{const out=[];for(let e=el.parentElement;e;e=e.parentElement){const s=getComputedStyle(e);out.push({overflowX:s.overflowX,overflowY:s.overflowY,clip:s.clipPath,mask:s.maskImage});}return out;});
   for(const style of ancestors){assert.ok(!['hidden','clip'].includes(style.overflowX));assert.ok(!['hidden','clip'].includes(style.overflowY));assert.equal(style.clip,'none');assert.equal(style.mask,'none');}
   const linkBox=await cover.getByRole('link',{name:'View original on Instagram',exact:false}).boundingBox();assert.ok(linkBox.y>=box.y+box.height);
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
  await page.screenshot({path:`tests/instagram-cover-${width}.png`,fullPage:true});await page.close();
 }
 const page=await browser.newPage({viewport:{width:390,height:844}});
 // Approved photos remain preferred even if the image request fails.
 await page.route('**/*',route=>route.request().resourceType()==='image'?route.abort():route.continue());
 await page.goto(origin+'/discover/baguio-wright-park');await expect(page.locator('.discovery-detail-hero .place-instagram-cover')).toHaveCount(0);
 await expect(page.getByRole('img',{name:'Photograph unavailable for Wright Park'})).toBeVisible();
 // A place with neither licensed photo nor reviewed post keeps the existing art.
 await page.goto(origin+'/discover/cebu-turning-wheels-brewery');await expect(page.locator('.place-instagram-cover')).toHaveCount(0);
 await expect(page.locator('.discovery-detail-hero .place-photo-fallback')).toBeVisible();
 // Script failure is recoverable, without hiding the original source link.
 await page.route('https://www.instagram.com/**',route=>route.abort());
 await page.goto(origin+'/discover/baguio-ili-likha');
 const cover=page.locator('.place-instagram-cover');await cover.getByRole('button',{name:'Load Instagram preview',exact:true}).click();
 await expect(cover.getByRole('status')).toContainText('could not be loaded');await expect(cover.getByRole('link',{name:'View original on Instagram',exact:false})).toBeVisible();
 await expect(cover.getByRole('button',{name:'Try Instagram preview again',exact:true})).toBeEnabled();
 await page.close();
 console.log('Instagram covers passed: opt-in/keyboard, photo preference, tall unclipped widgets, mobile/narrow layouts, no duplicate post, missing-resource fallback and script failure.');
}finally{await browser.close();}
