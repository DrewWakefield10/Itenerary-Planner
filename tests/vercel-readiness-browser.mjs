import {chromium,expect} from "@playwright/test";
import assert from "node:assert/strict";

// Run against an intentionally unconfigured local native Next.js server.
// This checks the actual readiness endpoint, with no API response fixtures.
const origin=process.env.LAKBAY_TEST_ORIGIN||"http://localhost:5173";
const session=await fetch(origin+"/api/account/session"),data=await session.json();
assert.equal(session.status,200);assert.equal(data.enabled,false);assert.equal(data.user,null);
assert.ok(["auth_configuration_invalid","database_not_configured"].includes(data.readiness));
assert.equal(session.headers.get("Cache-Control"),"private, no-store");
const login=await fetch(origin+"/api/auth/sign-in/social",{method:"POST",headers:{origin,"Content-Type":"application/json"},body:JSON.stringify({provider:"google",callbackURL:"/my-trips"})});
assert.equal(login.status,503);
const browser=await chromium.launch({channel:"chrome",headless:true});
try{
  const page=await browser.newPage();
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:900});await page.goto(origin+"/account");
    await expect(page.getByText("Account saving is not available yet.",{exact:false})).toBeVisible();
    await expect(page.getByText("Lakbay is a standalone travel planner.",{exact:false})).toBeVisible();
    await expect(page.getByText(/Let.s Corp/)).toHaveCount(0);
    await expect(page.getByRole("button",{name:"Continue with Google",exact:true})).toHaveCount(0);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    await page.screenshot({path:`tests/vercel-account-unavailable-${width}.png`,fullPage:true});
    await page.getByRole("link",{name:"Continue planning as a guest",exact:true}).click();
    await expect(page.getByLabel("Number of days")).toBeVisible();
  }
  console.log("Native Next readiness: actual uncached endpoint and auth handler fail closed; desktop/mobile guest account copy and planning passed.");
}finally{await browser.close();}
