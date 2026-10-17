import {chromium,expect} from '@playwright/test';
import assert from 'node:assert/strict';

const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 let weatherMode='fresh';
 await page.route('**/api/weather?*',async route=>{
   const date=new URL(route.request().url()).searchParams.get('date');
   const payload=weatherMode==='missing'?{available:false,message:'Forecast unavailable in this fixture.'}:{available:true,date,rain:85,weatherCode:63,condition:'Rain',temperature:24,retrievedAt:new Date(Date.now()-(weatherMode==='stale'?7*60*60*1000:0)).toISOString()};
   await route.fulfill({json:payload});
 });
 await page.goto('http://127.0.0.1:5173/planner?destinations=baguio&days=3');
 await expect(page.getByLabel('Number of days')).toHaveValue('3');
 for(let i=0;i<5;i++)await page.getByRole('button',{name:'Next chapter'}).click();
 await page.getByRole('button',{name:'Generate demo itinerary'}).click();
 await expect(page.getByRole('heading',{name:'Baguio — my island story'})).toBeVisible();
 const tripURL=page.url();
 const button=()=>page.getByRole('button',{name:'Preview rain alternative for Burnham Park',exact:true});
 await expect(button()).toBeVisible();
 const original=await page.evaluate(()=>localStorage.getItem('lakbay:trips'));
 await page.getByRole('button',{name:'Dismiss rain suggestion for Burnham Park',exact:true}).click();
 await expect(button()).toHaveCount(0);
 assert.equal(await page.evaluate(()=>localStorage.getItem('lakbay:trips')),original);
 await page.getByRole('button',{name:'Refresh forecast',exact:true}).click();
 await button().click();
 await expect(page.getByRole('heading',{name:'Schedule & estimated cost difference'})).toBeVisible();
 await expect(page.locator('#plan-b-preview').getByText(/Opening hours are unverified/)).toBeVisible();
 assert.equal(await page.evaluate(()=>localStorage.getItem('lakbay:trips')),original);
 await page.getByRole('button',{name:'Keep original',exact:true}).click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('lakbay:trips')),original);
 await button().click();
 await page.screenshot({path:'tests/rain-preview-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByRole('button',{name:'Confirm & apply',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Session Road cafe break',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Burnham Park',exact:true})).toHaveCount(0);
 const accepted=await page.evaluate(()=>JSON.parse(localStorage.getItem('lakbay:trips'))[0]);
 assert.deepEqual(accepted.days.slice(1),JSON.parse(original)[0].days.slice(1));
 assert.equal(accepted.days[0].activities.find(a=>a.name==='Session Road cafe break').sources.price.status,'estimate');
 await page.reload();
 await expect(page.getByRole('heading',{name:'Session Road cafe break',exact:true})).toBeVisible();
 // Restore the original snapshot to isolate stale/missing/legacy compatibility.
 await page.evaluate(value=>localStorage.setItem('lakbay:trips',value),original);
 weatherMode='stale';await page.reload();
 await expect(page.getByText(/retrieved over six hours ago/)).toBeVisible();
 await expect(button()).toHaveCount(0);
 weatherMode='missing';await page.getByRole('button',{name:'Refresh forecast',exact:true}).click();
 await expect(page.locator('.weather-availability')).toContainText('No weather-based changes');
 await expect(button()).toHaveCount(0);
 const beforeManual=await page.evaluate(()=>localStorage.getItem('lakbay:trips'));
 await page.getByRole('button',{name:'Make a Plan B',exact:true}).click();
 await page.getByRole('button',{name:'Preview alternative',exact:true}).click();
 await expect(page.getByText('Based on your manual rain report. No forecast or official advisory has been inferred.')).toBeVisible();
 await expect(page.locator('#plan-b-preview').getByText('Session Road cafe break',{exact:false})).toBeVisible();
 assert.equal(await page.evaluate(()=>localStorage.getItem('lakbay:trips')),beforeManual);
 await page.getByRole('button',{name:'Keep original',exact:true}).click();
 const legacy=JSON.parse(original);for(const d of legacy[0].days)for(const a of d.activities){delete a.disruptionSensitivities;delete a.openingHours;}
 await page.evaluate(value=>localStorage.setItem('lakbay:trips',value),JSON.stringify(legacy));
 weatherMode='fresh';await page.goto(tripURL);
 await expect(page.getByText(/No activities on this day have a recorded rain sensitivity/)).toBeVisible();
 await expect(button()).toHaveCount(0);
 // A separate destination gets its own seed alternative and published-hours source.
 let date=accepted.request.startDate;
 if(new Date(date+'T12:00:00Z').getUTCDay()===0){const next=new Date(date+'T12:00:00Z');next.setUTCDate(next.getUTCDate()+1);date=next.toISOString().slice(0,10);}
 const response=await page.request.post('http://127.0.0.1:5173/api/generate',{data:{request:{...accepted.request,destinations:['cebu'],startDate:date}}});
 assert.equal(response.status(),200);
 const {trip}=await response.json();
 await page.evaluate(t=>localStorage.setItem('lakbay:trips',JSON.stringify([t])),trip);
 await page.goto('http://127.0.0.1:5173/trips/'+trip.id);
 await page.locator('.rain-suggestions').getByRole('button',{name:/Preview rain alternative for/}).first().click();
 await expect(page.locator('#plan-b-preview').getByText('Casa Gorordo Museum area',{exact:false})).toBeVisible();
 await expect(page.locator('#plan-b-preview').getByRole('link',{name:/Published opening hours: Checked/})).toHaveAttribute('href','https://www.casagorordomuseum.org/');
 await page.getByRole('button',{name:'Confirm & apply',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Casa Gorordo Museum area',exact:true})).toBeVisible();
 assert.deepEqual(errors,[]);
 console.log('Rain browser: Baguio/Cebu destination matching, mobile preview, dismissal, explicit acceptance, persistence, source links, stale/missing forecasts, and legacy tags passed.');
}finally{await browser.close();}
