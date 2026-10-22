import {createClient,type Client} from "@libsql/client/web";
import {getTableColumns,getTableName} from "drizzle-orm";
import {drizzle as d1Drizzle} from "drizzle-orm/d1";
import {drizzle as libsqlDrizzle} from "drizzle-orm/libsql/web";
import * as schema from "../db/schema";
import {accountDatabase} from "./account-context";
import {libsqlAccountDatabase,type AccountDatabase} from "./account-sql";

export type AccountBackend={kind:"d1";db:D1Database}|{kind:"turso";db:AccountDatabase;client:Client};
export type DatabaseStatus="ready"|"database_not_configured"|"database_configuration_invalid"|"database_unavailable"|"database_schema_missing"|"database_write_unavailable";
export function tursoConfiguration(env:Record<string,string|undefined>=process.env){
  const url=env.TURSO_DATABASE_URL,authToken=env.TURSO_AUTH_TOKEN;
  if(!url||!authToken)return {status:"database_not_configured" as const};
  try{
    const parsed=new URL(url);
    // No files, embedded replicas, insecure HTTP or instance-local storage in production.
    if(!["libsql:","https:"].includes(parsed.protocol)||!parsed.hostname||parsed.username||parsed.password||parsed.search||parsed.hash||!["","/"].includes(parsed.pathname))throw new Error("Invalid database URL");
    return {status:"ready" as const,url,authToken};
  }catch{return {status:"database_configuration_invalid" as const};}
}
let remote:{key:string;backend:AccountBackend}|undefined;
export function accountBackend():{status:DatabaseStatus;backend?:AccountBackend}{
  const binding=accountDatabase();
  if(binding)return {status:"ready",backend:{kind:"d1",db:binding}};
  const config=tursoConfiguration();
  if(config.status!=="ready")return {status:config.status};
  const key=JSON.stringify([config.url,config.authToken]);
  if(remote?.key!==key){
    if(remote?.backend.kind==="turso")remote.backend.client.close();
    const client=createClient({url:config.url,authToken:config.authToken,intMode:"number",fetch:(input:RequestInfo|URL,init?:RequestInit)=>fetch(input,{...init,signal:AbortSignal.timeout(8000)})});
    remote={key,backend:{kind:"turso",client,db:libsqlAccountDatabase(client)}};
  }
  return {status:"ready",backend:remote.backend};
}
export function accountDrizzle(backend:AccountBackend){
  return backend.kind==="d1"?d1Drizzle(backend.db,{schema}):libsqlDrizzle(backend.client,{schema});
}
export async function probeAccountDatabase(db:AccountDatabase):Promise<DatabaseStatus>{
  try{await db.prepare("SELECT 1 AS connected").first();}catch{return "database_unavailable";}
  try{
    // Check every expected column, including partially applied schema changes.
    for(const table of Object.values(schema)){
      const columns=Object.values(getTableColumns(table)).map(c=>`t."${c.name}"`).join(",");
      await db.prepare(`SELECT ${columns} FROM "${getTableName(table)}" t LIMIT 0`).all();
    }
    const fk=await db.prepare("PRAGMA foreign_keys").first<{foreign_keys:number}>();
    if(fk?.foreign_keys!==1)return "database_schema_missing";
  }catch(error){
    return /no such (table|column)|has no column named/i.test(String(error))?"database_schema_missing":"database_unavailable";
  }
  try{
    // A read-only token must not enable a login that cannot persist a session.
    // These statements change no rows and create no schema or demo data.
    await db.batch(["verification","personal_trips","bookmarks"].map(table=>db.prepare(`DELETE FROM "${table}" WHERE 0`)));
    return "ready";
  }catch{return "database_write_unavailable";}
}
const health=new WeakMap<AccountDatabase,{expires:number;pending:Promise<DatabaseStatus>}>();
export async function readyAccountBackend(){
  const selected=accountBackend();
  if(!selected.backend)return selected;
  const {backend}=selected,now=Date.now();
  let cached=health.get(backend.db);
  if(!cached||cached.expires<=now){
    const entry={expires:now+15000,pending:probeAccountDatabase(backend.db)};
    health.set(backend.db,entry);cached=entry;
    // An outage or unapplied migration can be retried immediately.
    void entry.pending.then(status=>{if(status!=="ready")entry.expires=0;});
  }
  const status=await cached.pending;
  return {status,backend:status==="ready"?backend:undefined};
}
