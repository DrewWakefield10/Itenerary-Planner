import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {createHmac} from "node:crypto";
import {generateDemo} from "../lib/engine";
import {defaultRequest} from "../lib/trip";
// Isolated local Worker integration only. Never enable fixture credentials in a
// hosted environment. There is no test-login route or production identity bypass.
const origin="http://127.0.0.1:5173",secret="local-fixture-only-secret-not-a-production-key-2026";
const ids=["worker_qa_alice","worker_qa_bob"];
const sql=(statement:string)=>execFileSync(process.execPath,["--import","./scripts/sites-env.mjs","./node_modules/wrangler/bin/wrangler.js","d1","execute","DB","--local","--config","dist/server/wrangler.json","--persist-to",".wrangler/state","--command",statement],{stdio:"pipe"});
const cookie=(id:string)=>`lakbay.session_token=${encodeURIComponent(id+"."+createHmac("sha256",secret).update(id).digest("base64"))}`;
async function call(path:string,owner:string,method="GET",body?:unknown){const response=await fetch(origin+"/api/account/"+path,{method,headers:{origin,cookie:cookie(owner),"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});return {status:response.status,data:await response.json() as Record<string,unknown>};}
const now=Date.now();
try{
  sql(ids.map(id=>`INSERT OR REPLACE INTO user(id,name,email,email_verified,created_at,updated_at) VALUES('${id}','Local QA','${id}@fixture.invalid',1,${now},${now}); INSERT OR REPLACE INTO session(id,user_id,token,expires_at,created_at,updated_at) VALUES('${id}','${id}','${id}',${now+3600000},${now},${now});`).join("\n"));
  assert.equal((await call("session",ids[0])).data.enabled,true);
  assert.equal(((await call("session",ids[0])).data.user as {id:string}).id,ids[0]);
  const trip=generateDemo({...defaultRequest,startDate:"2026-12-10",days:3,destinations:["baguio"]}),payload={trip,revision:0,mutationId:crypto.randomUUID()};
  const first=await call("trips/"+trip.id,ids[0],"PUT",payload);assert.equal(first.status,200,JSON.stringify(first.data));
  assert.deepEqual(first.data.trip,trip);assert.equal((await call("trips/"+trip.id,ids[0],"PUT",payload)).data.revision,1);
  assert.equal((await call("trips/"+trip.id,ids[1])).status,404);assert.equal((await call("trips/"+trip.id+"?revision=1",ids[1],"DELETE")).status,404);
  assert.equal((await call("trips/"+trip.id,ids[0],"PUT",{trip:{...trip,title:"Saved Worker edit"},revision:1,mutationId:crypto.randomUUID()})).data.revision,2);
  assert.equal((await call("trips/"+trip.id,ids[0],"PUT",{trip:{...trip,title:"Stale Worker edit"},revision:1,mutationId:crypto.randomUUID()})).status,409);
  assert.equal((await call("bookmarks/baguio-baguio-museum",ids[0],"PUT")).status,200);
  await call("bookmarks/baguio-baguio-museum",ids[0],"PUT");
  assert.equal(((await call("bookmarks",ids[0])).data.bookmarks as unknown[]).length,1);assert.equal(((await call("bookmarks",ids[1])).data.bookmarks as unknown[]).length,0);
  assert.equal((await call("trips/"+trip.id+"?revision=2",ids[0],"DELETE")).status,200);
  assert.equal((await call("trips/"+trip.id,ids[0])).status,404);
  console.log("Real local Worker/D1: Google session verification, exact snapshot save/retry/edit, owner isolation, stale revisions, unique bookmarks and deletion passed.");
}finally{sql("DELETE FROM user WHERE id IN ('worker_qa_alice','worker_qa_bob');");}
