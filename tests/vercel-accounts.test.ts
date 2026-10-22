import {test} from "node:test";
import assert from "node:assert/strict";
import {createClient} from "@libsql/client";
import {createHmac} from "node:crypto";
import {mkdtempSync} from "node:fs";
import {rm} from "node:fs/promises";
import {join,resolve,sep} from "node:path";
import {tmpdir} from "node:os";
import {generateKeyPair,exportJWK,SignJWT} from "jose";
import {applyAccountMigrations,accountMigrations,accountMigrationStatus} from "../db/migrate";
import {libsqlAccountDatabase} from "../lib/account-sql";
import {probeAccountDatabase,tursoConfiguration} from "../lib/account-database";
import {AccountStore} from "../lib/account-store";
import {createGoogleAuth,authConfiguration} from "../lib/auth";
import {handleAccountRequest} from "../lib/account-api";
import {generateDemo} from "../lib/engine";
import {defaultRequest} from "../lib/trip";
import {sqliteD1} from "./d1-fixture";

const config={clientId:"fixture.apps.googleusercontent.com",clientSecret:"fixture-secret",secret:"a-fixture-secret-longer-than-thirty-two-characters",origin:"http://localhost:5173"};
const trip=()=>generateDemo({...defaultRequest,startDate:"2026-12-10",randomSeed:"vercel-storage",destinations:["baguio"],days:3});
const accountJson=async(response:Response)=>await response.json() as {readiness:string;user?:{id:string};trip?:ReturnType<typeof trip>};
const seedUser=(client:ReturnType<typeof createClient>,id:string)=>client.execute({sql:"INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,?,?)",args:[id,id,`${id}@example.com`,Date.now(),Date.now()]});

test("Vercel database configuration rejects ephemeral files, missing credentials and insecure URLs",()=>{
  for(const url of ["file:local.db","http://database.example","https://user:password@database.example","https://database.example/path"]){assert.equal(tursoConfiguration({TURSO_DATABASE_URL:url,TURSO_AUTH_TOKEN:"fixture"}).status,"database_configuration_invalid");}
  assert.equal(tursoConfiguration({}).status,"database_not_configured");
  assert.equal(tursoConfiguration({TURSO_DATABASE_URL:"libsql://database.turso.io",TURSO_AUTH_TOKEN:"fixture"}).status,"ready");
});

test("real libSQL readiness requires connectivity, full migrations and write access; migrations are atomic and idempotent",async()=>{
  const client=createClient({url:"file::memory:"}),db=libsqlAccountDatabase(client);
  try{
    assert.equal(await probeAccountDatabase(db),"database_schema_missing");
    assert.deepEqual(await accountMigrationStatus(client),{ledgerPresent:false,applied:[],pending:["0000_shiny_umar"],changed:[],unrecognized:[]});
    assert.equal((await client.execute("SELECT name FROM sqlite_master WHERE name='lakbay_migrations'")).rows.length,0,"status inspection never creates tables");
    assert.deepEqual(await applyAccountMigrations(client),["0000_shiny_umar"]);
    assert.deepEqual(await accountMigrationStatus(client),{ledgerPresent:true,applied:["0000_shiny_umar"],pending:[],changed:[],unrecognized:[]});
    assert.equal(await probeAccountDatabase(db),"ready");
    assert.deepEqual(await applyAccountMigrations(client),[]);
    await assert.rejects(()=>applyAccountMigrations(client,accountMigrations().map(m=>({...m,hash:"changed"}))),/Applied migration changed/);
    assert.deepEqual((await accountMigrationStatus(client,accountMigrations().map(m=>({...m,hash:"changed"})))).changed,["0000_shiny_umar"]);
    await assert.rejects(()=>applyAccountMigrations(client,[{tag:"broken",hash:"fixture",statements:["CREATE TABLE partial (id TEXT)","INVALID SQL"]}]));
    assert.equal((await client.execute("SELECT name FROM sqlite_master WHERE name='partial'")).rows.length,0);
    await client.execute("ALTER TABLE personal_trips RENAME COLUMN mutation_id TO missing_mutation");
    assert.equal(await probeAccountDatabase(db),"database_schema_missing");
    await client.execute("ALTER TABLE personal_trips RENAME COLUMN missing_mutation TO mutation_id");
    await client.execute("PRAGMA query_only=ON");
    assert.equal(await probeAccountDatabase(db),"database_write_unavailable");
  }finally{client.close();}
  assert.equal(await probeAccountDatabase(db),"database_unavailable");
});

test("libSQL trip snapshots persist after reconnect, retain metadata, isolate owners, enforce revisions and roll back failed batches",async()=>{
  const folder=mkdtempSync(join(tmpdir(),"lakbay-libsql-")),url=`file:${join(folder,"accounts.db").replaceAll("\\","/")}`;
  let client=createClient({url});
  try{
    await applyAccountMigrations(client);await seedUser(client,"alice");await seedUser(client,"bob");
    const db=libsqlAccountDatabase(client),a=new AccountStore(db,"alice"),b=new AccountStore(db,"bob"),t=trip(),mutation=crypto.randomUUID();
    const first=await a.save(t,0,mutation);assert.deepEqual(await a.save(t,0,mutation),first);
    assert.equal(await b.find(t.id),null);assert.equal((await b.list()).trips.length,0);await assert.rejects(()=>b.remove(t.id,1));
    await a.bookmark("baguio-burnham-park");await a.bookmark("baguio-burnham-park");assert.equal((await a.bookmarks()).length,1);assert.equal((await b.bookmarks()).length,0);
    const edited={...t,title:"Saved on another device"};await a.save(edited,1,crypto.randomUUID());
    await assert.rejects(()=>a.save({...t,title:"Stale edit"},1,crypto.randomUUID()),/another tab/);
    const invalid=structuredClone(edited);invalid.title="This transaction must roll back";invalid.days[0].activities.push(structuredClone(invalid.days[0].activities[0]));
    await assert.rejects(()=>a.save(invalid,2,crypto.randomUUID()));assert.equal((await a.find(t.id))!.trip.title,edited.title);
    client.close();client=createClient({url});
    const reopened=new AccountStore(libsqlAccountDatabase(client),"alice");assert.deepEqual((await reopened.find(t.id))!.trip,edited);
    const stops=await client.execute({sql:"SELECT activity_id FROM itinerary_stops WHERE owner_id=? AND trip_id=? ORDER BY day_index,stop_index",args:["alice",t.id]});
    assert.deepEqual(stops.rows.map(r=>r.activity_id),edited.days.flatMap(d=>d.activities.map(a=>a.id)));
    await reopened.remove(t.id,2);assert.equal((await client.execute("SELECT COUNT(*) n FROM itinerary_stops")).rows[0].n,0);
  }finally{client.close();assert.ok(resolve(folder).startsWith(resolve(tmpdir())+sep));await rm(folder,{recursive:true,force:true,maxRetries:10,retryDelay:100});}
});

test("Google OAuth and database sessions work through the native libSQL Drizzle adapter",async()=>{
  const client=createClient({url:"file::memory:"}),originalFetch=globalThis.fetch;
  try{
    await applyAccountMigrations(client);
    const {privateKey,publicKey}=await generateKeyPair("RS256"),jwk={...await exportJWK(publicKey),kid:"libsql-fixture",alg:"RS256",use:"sig"};
    const token=await new SignJWT({email:"personal@example.com",email_verified:true,name:"Personal Traveler"}).setProtectedHeader({alg:"RS256",kid:"libsql-fixture"}).setIssuer("https://accounts.google.com").setAudience(config.clientId).setSubject("google-libsql-personal").setIssuedAt().setExpirationTime("1h").sign(privateKey);
    globalThis.fetch=async(input)=>{const url=String(input instanceof Request?input.url:input);if(url==="https://www.googleapis.com/oauth2/v3/certs")return Response.json({keys:[jwk]});if(url==="https://oauth2.googleapis.com/token")return Response.json({access_token:"fixture",token_type:"Bearer",expires_in:3600,id_token:token});throw new Error("Unexpected auth request");};
    const backend={kind:"turso" as const,client,db:libsqlAccountDatabase(client)},auth=createGoogleAuth(backend,config);
    const start=await auth.handler(new Request(config.origin+"/api/auth/sign-in/social",{method:"POST",headers:{origin:config.origin,"Content-Type":"application/json"},body:JSON.stringify({provider:"google",callbackURL:"/my-trips"})}));
    assert.equal(start.status,200);const url=new URL((await start.json() as {url:string}).url);assert.equal(url.hostname,"accounts.google.com");assert.equal(url.searchParams.has("hd"),false);assert.equal(url.searchParams.get("code_challenge_method"),"S256");
    const stateCookies=start.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
    const callback=await auth.handler(new Request(config.origin+"/api/auth/callback/google?code=fixture&state="+encodeURIComponent(url.searchParams.get("state")!),{headers:{cookie:stateCookies}}));
    assert.equal(callback.status,302);const cookie=callback.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
    // A new auth instance restores the persisted session, without a cached user.
    const reloaded=createGoogleAuth(backend,config),session=await reloaded.api.getSession({headers:new Headers({cookie})});
    assert.equal(session?.user.email,"personal@example.com");assert.equal(session?.user.emailVerified,true);
    const saved=trip();await new AccountStore(backend.db,session!.user.id).save(saved,0,crypto.randomUUID());assert.deepEqual((await new AccountStore(backend.db,session!.user.id).find(saved.id))!.trip,saved);
    await new AccountStore(backend.db,session!.user.id).bookmark("baguio-burnham-park");
    await reloaded.handler(new Request(config.origin+"/api/auth/sign-out",{method:"POST",headers:{cookie,origin:config.origin,"Content-Type":"application/json"},body:"{}"}));
    assert.equal(await reloaded.api.getSession({headers:new Headers({cookie})}),null);
    const again=await reloaded.handler(new Request(config.origin+"/api/auth/sign-in/social",{method:"POST",headers:{origin:config.origin,"Content-Type":"application/json"},body:JSON.stringify({provider:"google",callbackURL:"/my-trips"})}));
    const againUrl=new URL((await again.json() as {url:string}).url),againCookies=again.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");
    const againCallback=await reloaded.handler(new Request(config.origin+"/api/auth/callback/google?code=fixture-again&state="+encodeURIComponent(againUrl.searchParams.get("state")!),{headers:{cookie:againCookies}}));
    assert.equal(againCallback.status,302);
    const nextCookie=againCallback.headers.getSetCookie().map(c=>c.split(";")[0]).join("; "),signedInAgain=await createGoogleAuth(backend,config).api.getSession({headers:new Headers({cookie:nextCookie})});
    assert.equal(signedInAgain?.user.id,session!.user.id);
    assert.equal((await client.execute("SELECT COUNT(*) n FROM user")).rows[0].n,1);
    const restoredStore=new AccountStore(backend.db,signedInAgain!.user.id);
    assert.deepEqual((await restoredStore.find(saved.id))!.trip,saved);
    assert.equal((await restoredStore.bookmarks())[0].placeId,"baguio-burnham-park");
  }finally{globalThis.fetch=originalFetch;client.close();}
});

test("native account API uses the remote HTTP backend without any D1 binding and reports setup failures honestly",async()=>{
  const previous={...process.env},originalFetch=globalThis.fetch,f=sqliteD1();
  const env={GOOGLE_CLIENT_ID:config.clientId,GOOGLE_CLIENT_SECRET:config.clientSecret,BETTER_AUTH_SECRET:config.secret,BETTER_AUTH_URL:config.origin};
  const call=(path:string,init?:RequestInit)=>handleAccountRequest(new Request(config.origin+"/api/account/"+path,init));
  try{
    Object.assign(process.env,env);delete process.env.TURSO_DATABASE_URL;delete process.env.TURSO_AUTH_TOKEN;
    process.env.VERCEL="1";process.env.VERCEL_ENV="production";
    assert.equal(authConfiguration(),null,"Vercel rejects localhost auth origins");
    process.env.BETTER_AUTH_URL="https://lakbay-itinerary-planner-psi.vercel.app";
    assert.equal((await accountJson(await call("session"))).readiness,"database_not_configured");
    delete process.env.VERCEL;delete process.env.VERCEL_ENV;process.env.BETTER_AUTH_URL=config.origin;
    process.env.TURSO_DATABASE_URL="https://fixture-db.invalid";process.env.TURSO_AUTH_TOKEN="fixture-only";
    globalThis.fetch=async()=>{throw new Error("Fixture network outage");};
    assert.deepEqual(await (await call("session")).json(),{enabled:false,user:null,readiness:"database_unavailable"});
    assert.equal((await call("trips")).status,503);
    // Test-only SQL-over-HTTP fixture: actual @libsql/client/web requests execute
    // against SQLite. No production fallback, fixture route or login is shipped.
    const value=(v:unknown):unknown=>v===null?{type:"null"}:typeof v==="number"?{type:Number.isInteger(v)?"integer":"float",value:Number.isInteger(v)?String(v):v}:{type:"text",value:String(v)};
    globalThis.fetch=async(input,init)=>{
      type Stmt={sql?:string;sql_id?:number;args:{type:string;value?:string|number}[]};
      type Condition={type:string;step?:number;cond?:Condition;conds?:Condition[]};
      const req=new Request(input,init),body=await req.json() as {requests:{type:string;sql?:string;sql_id?:number;stmt?:Stmt;batch?:{steps:{stmt:Stmt;condition?:Condition}[]}}[]},stored=new Map<number,string>();
      const execute=(query:Stmt)=>{
        const stmt=f.sqlite.prepare(query.sql??stored.get(query.sql_id!)!),args=(query.args||[]).map(a=>a.type==="null"?null:a.type==="integer"||a.type==="float"?Number(a.value):a.value),cols=stmt.columns();
        const rows=cols.length?stmt.all(...args as never[]):[];
        const changes=cols.length?0:Number(stmt.run(...args as never[]).changes);
        return {cols:cols.map(c=>({name:c.name,decltype:c.type})),rows:rows.map(r=>cols.map(c=>value(r[c.name]))),affected_row_count:changes,last_insert_rowid:null};
      };
      const results=body.requests.map(item=>{
        if(item.type==="close")return {type:"ok",response:{type:"close"}};
        if(item.type==="store_sql"){stored.set(item.sql_id!,item.sql!);return {type:"ok",response:{type:"store_sql"}};}
        try{
          if(item.type==="batch"){
            const step_results:(ReturnType<typeof execute>|null)[]=[],step_errors:({message:string;code:string}|null)[]=[];
            const matches=(c?:Condition):boolean=>!c?true:c.type==="ok"?!!step_results[c.step!]:c.type==="error"?!!step_errors[c.step!]:c.type==="not"?!matches(c.cond):c.type==="and"?c.conds!.every(matches):c.type==="or"?c.conds!.some(matches):false;
            for(const step of item.batch!.steps){
              if(!matches(step.condition)){step_results.push(null);step_errors.push(null);continue;}
              try{step_results.push(execute(step.stmt));step_errors.push(null);}catch{step_results.push(null);step_errors.push({message:"Fixture SQLite statement failed",code:"SQLITE_ERROR"});}
            }
            return {type:"ok",response:{type:"batch",result:{step_results,step_errors}}};
          }
          return {type:"ok",response:{type:"execute",result:execute(item.stmt!)}};
        }catch{return {type:"error",error:{message:"Fixture SQLite statement failed",code:"SQLITE_ERROR"}};}
      });
      return Response.json({baton:null,base_url:null,results});
    };
    f.user("alice");f.user("bob");const now=Date.now();
    f.sqlite.prepare("INSERT INTO session(id,user_id,token,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?)").run("session-a","alice","token-a",now+3600000,now,now);
    f.sqlite.prepare("INSERT INTO session(id,user_id,token,expires_at,created_at,updated_at) VALUES(?,?,?,?,?,?)").run("session-b","bob","token-b",now+3600000,now,now);
    const signedCookie=(token:string)=>`lakbay.session_token=${encodeURIComponent(token+"."+createHmac("sha256",config.secret).update(token).digest("base64"))}`;
    const cookie=signedCookie("token-a"),bobCookie=signedCookie("token-b");
    const ready=await accountJson(await call("session",{headers:{cookie}}));assert.equal(ready.readiness,"ready");assert.equal(ready.user?.id,"alice");
    const t=trip(),response=await call("trips/"+t.id,{method:"PUT",headers:{cookie,origin:config.origin,"Content-Type":"application/json"},body:JSON.stringify({trip:t,revision:0,mutationId:crypto.randomUUID()})});
    assert.equal(response.status,200);assert.deepEqual((await accountJson(response)).trip,t);
    assert.equal((await call("trips/"+t.id)).status,401);
    const restored=await call("trips/"+t.id,{headers:{cookie}});assert.equal(restored.status,200);assert.deepEqual((await accountJson(restored)).trip,t);
    assert.equal(restored.headers.get("Cache-Control"),"private, no-store");
    assert.equal((await call("trips/"+t.id,{headers:{cookie:bobCookie}})).status,404);
    assert.equal((await call("trips/"+t.id+"?revision=1",{method:"DELETE",headers:{cookie:bobCookie,origin:config.origin}})).status,404);
    assert.deepEqual(await (await call("trips",{headers:{cookie:bobCookie}})).json(),{trips:[],hasMore:false,nextOffset:20});
    const place="baguio-burnham-park";
    assert.equal((await call("bookmarks/"+place,{method:"PUT",headers:{cookie,origin:config.origin}})).status,200);
    assert.deepEqual(await (await call("bookmarks",{headers:{cookie:bobCookie}})).json(),{bookmarks:[]});
    const ownBookmarks=await (await call("bookmarks",{headers:{cookie}})).json() as {bookmarks:{placeId:string}[]};
    assert.equal(ownBookmarks.bookmarks[0].placeId,place);
  }finally{
    globalThis.fetch=originalFetch;f.sqlite.close();for(const key of [...Object.keys(env),"TURSO_DATABASE_URL","TURSO_AUTH_TOKEN","VERCEL","VERCEL_ENV"]){if(previous[key]===undefined)delete process.env[key];else process.env[key]=previous[key];}
  }
});
