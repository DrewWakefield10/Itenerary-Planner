import {test} from "node:test";
import assert from "node:assert/strict";
import {createHmac} from "node:crypto";
import {unlinkSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {generateKeyPair,exportJWK,SignJWT} from "jose";
import {sqliteD1} from "./d1-fixture";
import {AccountStore} from "../lib/account-store";
import {generateDemo} from "../lib/engine";
import {defaultRequest} from "../lib/trip";
import {runWithAccountDatabase} from "../lib/account-context";
import {handleAccountRequest} from "../lib/account-api";
import {createGoogleAuth,authConfiguration} from "../lib/auth";
const trip=()=>generateDemo({...defaultRequest,startDate:"2026-12-10",randomSeed:"account-snapshot",destinations:["baguio"],days:3});
const config={clientId:"fixture.apps.googleusercontent.com",clientSecret:"fixture-secret",secret:"a-fixture-secret-longer-than-thirty-two-characters",origin:"http://localhost:5173"};
function configure(){const old={...process.env};Object.assign(process.env,{GOOGLE_CLIENT_ID:config.clientId,GOOGLE_CLIENT_SECRET:config.clientSecret,BETTER_AUTH_SECRET:config.secret,BETTER_AUTH_URL:config.origin});return()=>{for(const key of ["GOOGLE_CLIENT_ID","GOOGLE_CLIENT_SECRET","BETTER_AUTH_SECRET","BETTER_AUTH_URL"]){if(old[key]===undefined)delete process.env[key];else process.env[key]=old[key];}};}
function cookie(token:string){return `lakbay.session_token=${encodeURIComponent(token+"."+createHmac("sha256",config.secret).update(token).digest("base64"))}`;}
test("SQLite snapshots preserve exact trips, stop order, references, source metadata and idempotent saves",async()=>{
  const f=sqliteD1();try{f.user("alice");const store=new AccountStore(f.db,"alice"),t=trip(),mutation=crypto.randomUUID();const first=await store.save(t,0,mutation),retry=await store.save(t,0,mutation);assert.deepEqual(first,retry);assert.deepEqual((await store.find(t.id))!.trip,t);assert.equal((await store.list()).trips.length,1);
    const stops=f.sqlite.prepare("SELECT activity_id,location_id,name FROM itinerary_stops WHERE owner_id=? AND trip_id=? ORDER BY day_index,stop_index").all("alice",t.id);
    assert.deepEqual(stops.map(s=>s.activity_id),t.days.flatMap(d=>d.activities.map(a=>a.id)));
    const edited=structuredClone(t);edited.title="A personal saved name";edited.notes="Keep these exact notes";edited.days[1].activities.reverse();
    const updated=await store.save(edited,1,crypto.randomUUID());assert.equal(updated.revision,2);assert.equal(updated.createdAt,first.createdAt);assert.deepEqual(updated.trip,edited);
    assert.deepEqual((await store.find(t.id))!.trip.days[1].activities,edited.days[1].activities);
  }finally{f.sqlite.close();}
});
test("ownership covers read/list/update/delete/bookmarks and matching imported trip IDs cannot cross accounts",async()=>{
  const f=sqliteD1();try{f.user("alice");f.user("bob");const a=new AccountStore(f.db,"alice"),b=new AccountStore(f.db,"bob"),t=trip();await a.save(t,0,crypto.randomUUID());assert.equal(await b.find(t.id),null);assert.equal((await b.list()).trips.length,0);await assert.rejects(()=>b.remove(t.id,1),/not found/);
    const copy={...t,title:"Bob's independent snapshot"};await b.save(copy,0,crypto.randomUUID());assert.equal((await a.find(t.id))!.trip.title,t.title);assert.equal((await b.find(t.id))!.trip.title,copy.title);
    await a.bookmark("baguio-burnham-park");await a.bookmark("baguio-burnham-park");assert.equal((await a.bookmarks()).length,1);assert.equal((await b.bookmarks()).length,0);await b.unbookmark("baguio-burnham-park");assert.equal((await a.bookmarks()).length,1);
    await a.remove(t.id,1);assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM itinerary_stops WHERE owner_id='alice'").get()!.n,0);assert.ok(await b.find(t.id));
  }finally{f.sqlite.close();}
});
test("stale revisions and reuse of the last mutation ID cannot overwrite newer content or corrupt stop references",async()=>{
  const f=sqliteD1();try{f.user("alice");const store=new AccountStore(f.db,"alice"),t=trip();const initial=crypto.randomUUID();await store.save(t,0,initial);const newer={...t,title:"Newer from another device"};const latestMutation=crypto.randomUUID();await store.save(newer,1,latestMutation);
    await assert.rejects(()=>store.save({...t,title:"Stale"},1,crypto.randomUUID()),/another tab|device/);
    await assert.rejects(()=>store.save({...newer,title:"Reused ID"},2,latestMutation),/save ID/);
    assert.equal((await store.find(t.id))!.trip.title,newer.title);
    const count=f.sqlite.prepare("SELECT COUNT(*) n FROM itinerary_stops").get()!.n;assert.equal(count,t.days.flatMap(d=>d.activities).length);
    await assert.rejects(()=>store.remove(t.id,1),/changed/);
  }finally{f.sqlite.close();}
});
test("real session verification rejects missing/expired cookies, forged identity headers, CSRF and browser-supplied owner IDs",async()=>{
  const restore=configure(),f=sqliteD1();try{f.user("alice");f.user("bob");const now=Date.now();for(const [id,expires] of [["alice",now+86400000],["expired",now-1000]] as const)f.sqlite.prepare("INSERT INTO session(id,user_id,token,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?)").run(id,"alice",id,expires,now,now);
    const call=(path:string,init:RequestInit={})=>runWithAccountDatabase(f.db,()=>handleAccountRequest(new Request(config.origin+"/api/account/"+path,init)));
    const session=await call("session",{headers:{cookie:cookie("alice")}});assert.equal((await session.json() as {user:{id:string}}).user.id,"alice");
    assert.equal((await call("trips")).status,401);assert.equal((await call("trips",{headers:{"oai-authenticated-user-id":"alice","oai-authenticated-user-email":"alice@example.com"}})).status,401);assert.equal((await call("trips",{headers:{cookie:cookie("expired")}})).status,401);
    const t=trip(),payload={trip:t,revision:0,mutationId:crypto.randomUUID()};
    assert.equal((await call("trips/"+t.id,{method:"PUT",headers:{cookie:cookie("alice"),origin:"https://evil.example"},body:JSON.stringify(payload)})).status,403);
    assert.equal((await call("trips/"+t.id,{method:"PUT",headers:{cookie:cookie("alice"),origin:config.origin},body:JSON.stringify({...payload,ownerId:"bob"})})).status,400);
    assert.equal((await call("trips/"+t.id,{method:"PUT",headers:{cookie:cookie("alice"),origin:config.origin},body:JSON.stringify(payload)})).status,200);
  }finally{restore();f.sqlite.close();}
});
test("Google OAuth uses real state/PKCE validation, registers verified personal accounts, restores sessions and revokes on logout with network fixtures",async()=>{
  const f=sqliteD1(),originalFetch=globalThis.fetch;try{
    const {privateKey,publicKey}=await generateKeyPair("RS256");const jwk={...await exportJWK(publicKey),kid:"fixture-key",alg:"RS256",use:"sig"};
    const token=await new SignJWT({email:"personal@example.com",email_verified:true,name:"Personal Traveler"}).setProtectedHeader({alg:"RS256",kid:"fixture-key"}).setIssuer("https://accounts.google.com").setAudience(config.clientId).setSubject("google-personal-123").setIssuedAt().setExpirationTime("1h").sign(privateKey);
    globalThis.fetch=async(input)=>{const url=String(input instanceof Request?input.url:input);if(url==="https://www.googleapis.com/oauth2/v3/certs")return Response.json({keys:[jwk]});if(url==="https://oauth2.googleapis.com/token")return Response.json({access_token:"fixture-access",token_type:"Bearer",expires_in:3600,id_token:token});throw new Error("Unexpected external auth request: "+url);};
    const auth=createGoogleAuth(f.db,config);
    const start=await auth.handler(new Request(config.origin+"/api/auth/sign-in/social",{method:"POST",headers:{origin:config.origin,"Content-Type":"application/json"},body:JSON.stringify({provider:"google",callbackURL:"/my-trips"})}));
    assert.equal(start.status,200);const data=await start.json() as {url:string};const url=new URL(data.url);assert.equal(url.hostname,"accounts.google.com");assert.ok(url.searchParams.get("code_challenge"));assert.equal(url.searchParams.get("code_challenge_method"),"S256");assert.ok(url.searchParams.get("scope")!.includes("openid"));assert.equal(url.searchParams.has("hd"),false);
    const cookies=start.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
    const invalid=await auth.handler(new Request(config.origin+"/api/auth/callback/google?code=fixture&state=invalid",{headers:{cookie:cookies}}));assert.ok(invalid.status>=300);assert.equal(f.sqlite.prepare("SELECT COUNT(*) n FROM user").get()!.n,0);
    const callback=await auth.handler(new Request(config.origin+"/api/auth/callback/google?code=fixture&state="+encodeURIComponent(url.searchParams.get("state")!),{headers:{cookie:cookies}}));
    assert.equal(callback.status,302);assert.equal(new URL(callback.headers.get("location")!,config.origin).href,config.origin+"/my-trips");
    const loggedIn=callback.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
    const restored=await auth.handler(new Request(config.origin+"/api/auth/get-session",{headers:{cookie:loggedIn}}));const session=await restored.json() as {user:{email:string;emailVerified:boolean}};
    assert.equal(session.user.email,"personal@example.com");assert.equal(session.user.emailVerified,true);assert.equal(f.sqlite.prepare("SELECT provider_id FROM account").get()!.provider_id,"google");
    const logout=await auth.handler(new Request(config.origin+"/api/auth/sign-out",{method:"POST",headers:{cookie:loggedIn,origin:config.origin,"Content-Type":"application/json"},body:"{}"}));assert.equal(logout.status,200);
    const after=await auth.handler(new Request(config.origin+"/api/auth/get-session",{headers:{cookie:loggedIn}}));assert.equal(await after.json(),null);
  }finally{globalThis.fetch=originalFetch;f.sqlite.close();}
});
test("missing Google configuration fails closed without trusting platform identity",async()=>{
  const previous=process.env.GOOGLE_CLIENT_ID;delete process.env.GOOGLE_CLIENT_ID;
  try{assert.equal(authConfiguration(),null);const response=await handleAccountRequest(new Request(config.origin+"/api/account/session"));assert.deepEqual(await response.json(),{enabled:false,user:null,readiness:"auth_configuration_invalid"});assert.equal((await handleAccountRequest(new Request(config.origin+"/api/account/trips"))).status,503);}finally{if(previous!==undefined)process.env.GOOGLE_CLIENT_ID=previous;}
});
test("saved trips survive a new database connection and account-store session without regeneration",async()=>{
  const filename=join(tmpdir(),`lakbay-account-${crypto.randomUUID()}.sqlite`),t=trip();
  const first=sqliteD1(filename);first.user("alice");await new AccountStore(first.db,"alice").save(t,0,crypto.randomUUID());first.sqlite.close();
  const reopened=sqliteD1(filename);try{assert.deepEqual((await new AccountStore(reopened.db,"alice").find(t.id))!.trip,t);}finally{reopened.sqlite.close();unlinkSync(filename);}
});
