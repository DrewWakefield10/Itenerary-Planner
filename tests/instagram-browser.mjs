import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'chrome',headless:true}),origin=process.env.LAKBAY_TEST_ORIGIN||'http://localhost:5190';
const script='https://www.instagram.com/embed.js',errors=[];
// Deliberately a network fixture: tests interaction/resilience, not real-post
// availability. Live embed results are recorded separately in the handoff.
const fixture=`window.instgrm={Embeds:{process(){document.querySelectorAll('blockquote.instagram-media').forEach(q=>{const f=document.createElement('iframe');f.className='instagram-media';f.title='Instagram fixture';f.src=q.dataset.instgrmPermalink+'embed/';f.style.width='100%';f.style.minWidth='326px';f.style.maxWidth='658px';f.style.height='480px';q.replaceWith(f);});}}};window.instgrm.Embeds.process();`;
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 const requests=[];page.on('request',r=>{if(/instagram\.com/.test(r.url()))requests.push(r.url());});
 await page.route('https://www.instagram.com/**',async route=>{if(route.request().url()===script)await route.fulfill({contentType:'text/javascript',body:fixture});else await route.fulfill({contentType:'text/html',body:'Fixture only'});});
 await page.goto(origin+'/discover?destination=Siargao');await expect(page.locator('.place-instagram')).toHaveCount(0);assert.equal(requests.length,0);
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.goto(origin+'/discover/baguio-wright-park');
  await expect(page.getByRole('heading',{name:'From Instagram.'})).toBeVisible();
  const before=requests.length;await expect(page.locator('.place-instagram iframe')).toHaveCount(0);
  await page.waitForTimeout(250);assert.equal(requests.length,before);
  const section=page.locator('.place-instagram');await expect(section.getByRole('link',{name:'View on Instagram',exact:false})).toHaveCount(1);
  await page.getByRole('button',{name:'Load Instagram posts',exact:true}).click();
  await expect(section.locator('iframe')).toHaveCount(1);await expect(section.getByRole('status')).toContainText('was requested');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  // Official SDK owns its frame DOM. Resize removes it without a React error.
  await page.setViewportSize({width:320,height:844});await expect(section.locator('iframe')).toHaveCount(0);
  await expect(section).toContainText('too narrow');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.setViewportSize({width:390,height:844});await expect(section.locator('iframe')).toHaveCount(1);
  await page.screenshot({path:`tests/instagram-${width}.png`,fullPage:true});
 }
 await page.goto(origin+'/discover/iloilo-jaro-plaza-heritage-area');await expect(page.locator('.place-instagram')).toHaveCount(0);
 await expect(page.locator('.place-videos iframe')).toHaveCount(2);
 // Two posts share one runtime request and keep the official controls visible.
 await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/discover/el-nido-piece-of-sky');
 const scriptsBefore=requests.filter(url=>url===script).length;
 await expect(page.locator('.place-instagram iframe')).toHaveCount(0);
 const cover=page.locator('.place-instagram-cover'),lower=page.locator('.place-instagram:not(.place-instagram-cover)');
 await cover.getByRole('button',{name:'Load Instagram preview',exact:true}).click();
 await expect(cover.locator('iframe')).toHaveCount(1);await expect(lower.locator('iframe')).toHaveCount(0);
 await lower.getByRole('button',{name:'Load Instagram posts',exact:true}).click();
 await expect(page.locator('.place-instagram iframe')).toHaveCount(2);
 assert.equal(requests.filter(url=>url===script).length,scriptsBefore+1);
 // React's streamed lazy section can briefly retain a hidden staging copy.
 // Wait for reconciliation instead of measuring that transient server markup.
 await expect(lower.locator('.place-instagram-grid')).toHaveCount(1);
 assert.equal(await lower.locator('.place-instagram-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),2);
 await page.setViewportSize({width:820,height:1000});
 for(const frame of await page.locator('.place-instagram iframe').all())assert.ok((await frame.boundingBox()).width<=658);
 await page.setViewportSize({width:390,height:844});
 assert.equal(await lower.locator('.place-instagram-grid').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),1);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 // Narrow screen never contacts Instagram, including after a failed width check.
 const narrow=await browser.newPage({viewport:{width:320,height:844}}),narrowRequests=[];
 narrow.on('request',r=>{if(/instagram\.com/.test(r.url()))narrowRequests.push(r.url());});
 await narrow.goto(origin+'/discover/baguio-wright-park');await narrow.getByRole('button',{name:'Load Instagram posts',exact:true}).click();
 await expect(narrow.locator('.place-instagram [role=status]')).toContainText('screen size');assert.deepEqual(narrowRequests,[]);await narrow.close();
 // Blocked SDK -> useful error + live source links; explicit retry can recover.
 const blocked=await browser.newPage({viewport:{width:390,height:844}});blocked.on('pageerror',e=>errors.push(e.message));let fail=true;
 await blocked.route('https://www.instagram.com/**',route=>fail?route.abort():route.fulfill({contentType:route.request().url()===script?'text/javascript':'text/html',body:route.request().url()===script?fixture:'Fixture only'}));
 await blocked.goto(origin+'/discover/baguio-wright-park');await blocked.getByRole('button',{name:'Load Instagram posts',exact:true}).click();
 await expect(blocked.locator('.place-instagram [role=status]')).toContainText('could not be loaded');
 await expect(blocked.getByRole('link',{name:'View on Instagram',exact:false})).toHaveAttribute('href',/instagram.com\/p\//);
 fail=false;await blocked.getByRole('button',{name:'Try Instagram again',exact:true}).click();await expect(blocked.locator('.place-instagram iframe')).toHaveCount(1);
 await blocked.close();assert.deepEqual(errors,[]);
 console.log('Instagram fixture checks passed: opt-in only, source fallbacks, retry, navigation, mobile resize/overflow, no-resource hiding and existing YouTube.');
}finally{await browser.close();}
