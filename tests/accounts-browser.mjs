import {chromium,expect} from "@playwright/test";
import assert from "node:assert/strict";
const browser=await chromium.launch({channel:"chrome",headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on("pageerror",e=>errors.push(e.message));
const origin="http://127.0.0.1:5173",records=new Map(),bookmarks=new Map();
let user=null,loginAs="alice",failSave=false,puts=0;
const visible=()=>[...records.values()].filter(r=>r.ownerId===user?.id);
const profile=id=>({id,displayName:id==="alice"?"Alice Traveler":"Bob Traveler",email:`${id}@example.com`});
await page.route("**/api/auth/**",async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith("sign-in/social")){user=profile(loginAs);const data=route.request().postDataJSON();return route.fulfill({json:{url:origin+data.callbackURL,redirect:!data.disableRedirect}});}
  if(path.endsWith("sign-out")){user=null;return route.fulfill({json:{success:true}});}
  if(path.endsWith("update-user")){user={...user,displayName:route.request().postDataJSON().name};return route.fulfill({json:{status:true}});}
  return route.fulfill({json:null});
});
await page.route("**/api/account/**",async route=>{
  const request=route.request(),url=new URL(request.url()),parts=url.pathname.split("/").slice(3),method=request.method();
  if(parts[0]==="session")return route.fulfill({json:{enabled:true,user}});
  if(!user)return route.fulfill({status:401,json:{error:"Session expired. Sign in again; edits are preserved."}});
  if(parts[0]==="bookmarks"){
    const key=`${user.id}:${parts[1]}`;
    if(method==="GET")return route.fulfill({json:{bookmarks:[...bookmarks.values()].filter(b=>b.ownerId===user.id)}});
    if(method==="PUT")bookmarks.set(key,{placeId:parts[1],ownerId:user.id,name:"Baguio Museum",description:"Saved museum description",municipality:"Baguio City",destination:"Baguio",createdAt:new Date().toISOString(),available:true});
    if(method==="DELETE")bookmarks.delete(key);
    return route.fulfill({json:{saved:method==="PUT"}});
  }
  const key=`${user.id}:${parts[1]}`;
  if(!parts[1])return route.fulfill({json:{trips:visible(),hasMore:false,nextOffset:20}});
  if(method==="GET")return records.has(key)?route.fulfill({json:records.get(key)}):route.fulfill({status:404,json:{error:"Trip not found in this account."}});
  if(method==="DELETE"){records.delete(key);return route.fulfill({json:{deleted:true}});}
  if(method==="PUT"){
    puts++;if(failSave){failSave=false;return route.fulfill({status:503,json:{error:"Storage unavailable. Your edits are preserved; retry."}});}
    const body=request.postDataJSON(),previous=records.get(key);
    if(previous&&previous.revision!==body.revision&&JSON.stringify(previous.trip)!==JSON.stringify(body.trip))return route.fulfill({status:409,json:{error:"Changed on another device. Your edits are preserved."}});
    const record={trip:body.trip,ownerId:user.id,revision:(previous?.revision||0)+1,createdAt:previous?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString()};records.set(key,record);return route.fulfill({json:record});
  }
});
try{
  await page.goto(origin+"/planner?destinations=baguio&days=3");await expect(page.getByLabel("Number of days")).toHaveValue("3");
  for(let i=0;i<5;i++)await page.getByRole("button",{name:"Next chapter"}).click();
  await page.getByRole("button",{name:"Generate demo itinerary"}).click();await expect(page.getByRole("heading",{name:"Baguio — my island story"})).toBeVisible();
  const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem("lakbay:trips"))[0]),tripUrl=origin+"/trips/"+draft.id;
  await expect(page.getByText("Browser draft · not saved to an account",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Save Trip",exact:true}).click();
  await expect(page.getByText("Saved to your account",{exact:true})).toBeVisible();
  assert.equal(puts,1);assert.equal(records.size,1);assert.deepEqual(records.get(`alice:${draft.id}`).trip,draft);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("lakbay:trips")).length),0);
  await expect(page.getByRole("button",{name:"Share snapshot"})).toHaveCount(0);
  await page.getByRole("button",{name:"Rename trip",exact:true}).click();await page.getByLabel("Trip name",{exact:true}).fill("Alice's personal itinerary");await page.getByRole("button",{name:"Update trip name",exact:true}).click();
  await expect(page.getByText("Unsaved changes",{exact:true})).toBeVisible();
  await page.getByRole("link",{name:"My travel journal",exact:true}).click();await expect(page.getByRole("heading",{name:"Leave with unsaved changes?"})).toBeVisible();await page.getByRole("button",{name:"Cancel",exact:true}).click();
  failSave=true;await page.getByRole("button",{name:"Save Changes",exact:true}).click();await expect(page.getByRole("alert")).toContainText("edits are preserved");await expect(page.getByRole("heading",{name:"Alice's personal itinerary"})).toBeVisible();
  await page.getByRole("button",{name:"Retry save",exact:true}).click();await expect(page.getByText("Saved to your account",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Update travel dates"}).click();await page.getByLabel("Trip start date",{exact:true}).fill("2026-12-20");await page.getByRole("button",{name:"Update dates",exact:true}).click();
  await page.getByRole("tab",{name:"Budget",exact:true}).click();await page.getByRole("button",{name:"Adjust budget",exact:true}).click();await page.getByLabel("Budget amount in pesos",{exact:true}).fill("");await page.getByRole("button",{name:"Update budget",exact:true}).click();await expect(page.getByText("Choose a whole-peso budget from 500 to 2,000,000.",{exact:true})).toBeVisible();await page.getByLabel("Budget amount in pesos",{exact:true}).fill("40000");await page.getByRole("button",{name:"Update budget",exact:true}).click();
  await page.getByRole("tab",{name:"Essentials",exact:true}).click();await page.getByLabel("Personal journal notes").fill("Private recovery note");
  user=null;await page.evaluate(()=>window.dispatchEvent(new Event("lakbay-session-expired")));
  await expect(page.getByRole("heading",{name:"Return to your trip."})).toBeVisible();await expect(page.getByText("Private recovery note")).toHaveCount(0);
  await page.getByRole("button",{name:"Continue with Google",exact:true}).click();await expect(page.getByText("Saved to your account",{exact:true})).toBeVisible();
  await page.getByRole("tab",{name:"Essentials",exact:true}).click();await expect(page.getByLabel("Personal journal notes")).toHaveValue("Private recovery note");
  assert.equal(records.get(`alice:${draft.id}`).trip.request.startDate,"2026-12-20");
  const saved=JSON.stringify(records.get(`alice:${draft.id}`).trip);await page.reload();await expect(page.getByRole("heading",{name:"Alice's personal itinerary"})).toBeVisible();assert.equal(JSON.stringify(records.get(`alice:${draft.id}`).trip),saved);
  await page.goto(origin+"/discover/baguio-baguio-museum");await page.getByRole("button",{name:"Save place Baguio Museum",exact:true}).click();await expect(page.getByRole("button",{name:"Remove saved place Baguio Museum",exact:true})).toBeVisible();
  await page.goto(origin+"/saved-places");await expect(page.getByRole("heading",{name:"Baguio Museum",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Add to a trip",exact:true})).toBeVisible();
  const current=records.get(`alice:${draft.id}`);current.trip.days[1].activities=[];current.revision++;
  await page.getByRole("button",{name:"Add to a trip",exact:true}).click();await expect(page.getByLabel("Choose saved trip")).toHaveValue(draft.id);await page.getByLabel("Choose itinerary day").selectOption("1");await page.getByLabel("Visit start time").fill("09:00");await page.getByRole("button",{name:"Preview addition",exact:true}).click();await expect(page.getByRole("region",{name:"Addition preview"})).toBeVisible();const before=JSON.stringify(current.trip);await page.getByRole("button",{name:"Keep itinerary unchanged",exact:true}).click();assert.equal(JSON.stringify(current.trip),before);await page.getByRole("button",{name:"Preview addition",exact:true}).click();await page.getByRole("button",{name:"Confirm & add",exact:true}).click();await expect(page.getByText("Added to your trip. Existing activities and overnight bases were preserved.",{exact:false})).toBeVisible();assert.equal(records.get(`alice:${draft.id}`).trip.days[1].activities[0].catalogStopId,"baguio-baguio-museum");await page.getByRole("dialog").getByRole("button",{name:/Close/}).click();
  await page.getByRole("button",{name:"Remove bookmark",exact:true}).click();await expect(page.getByRole("heading",{name:"A little room for your favorites."})).toBeVisible();
  await page.goto(origin+"/my-trips");await expect(page.locator(".postcard")).toHaveCount(1);await page.getByRole("button",{name:"Duplicate Alice's personal itinerary",exact:true}).click();await expect(page.locator(".postcard")).toHaveCount(2);
  await page.getByRole("button",{name:"Delete Alice's personal itinerary (copy)",exact:true}).click();await page.getByRole("button",{name:"Cancel",exact:true}).click();assert.equal(records.size,2);
  await page.getByRole("button",{name:"Delete Alice's personal itinerary (copy)",exact:true}).click();await page.getByRole("button",{name:"Delete",exact:true}).click();await expect(page.locator(".postcard")).toHaveCount(1);
  await page.screenshot({path:"tests/accounts-desktop.png",fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:"tests/accounts-mobile.png",fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.goto(origin+"/account");await expect(page.getByLabel("Email",{exact:true})).toHaveValue("alice@example.com");await page.getByRole("button",{name:"Log out",exact:true}).click();
  loginAs="bob";await page.getByRole("button",{name:"Continue with Google",exact:true}).click();await expect(page.getByRole("heading",{name:"Your next chapter is waiting."})).toBeVisible();await expect(page.getByText("Alice's personal itinerary",{exact:true})).toHaveCount(0);
  await page.goto(tripUrl);await expect(page.getByRole("heading",{name:"This trip is not available here."})).toBeVisible();await expect(page.getByText("Private recovery note")).toHaveCount(0);
  await page.goto(origin+"/account");await page.getByRole("button",{name:"Log out",exact:true}).click();await page.goto(origin+"/discover/baguio-baguio-museum");await page.getByRole("button",{name:"Save place",exact:true}).click();await expect(page.getByRole("button",{name:"Remove saved place Baguio Museum",exact:true})).toBeVisible();assert.ok(bookmarks.has("bob:baguio-baguio-museum"));
  assert.deepEqual(errors,[]);
  console.log("Accounts browser: guest-to-Google save, exact snapshots, edits/dates/notes, failure retry, session recovery, reload, bookmarks, duplicate/delete confirmation, private-account isolation and mobile passed (UI network fixtures).");
}finally{await browser.close();}
