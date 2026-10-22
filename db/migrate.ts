import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import type {Client} from "@libsql/client/web";

export function accountMigrations(){
  const folder=new URL("../drizzle/",import.meta.url);
  const journal=JSON.parse(readFileSync(new URL("meta/_journal.json",folder),"utf8")) as {entries:{tag:string}[]};
  return journal.entries.map(({tag})=>{
    const sql=readFileSync(new URL(`${tag}.sql`,folder),"utf8");
    return {tag,hash:createHash("sha256").update(sql.replace(/\r\n/g,"\n")).digest("hex"),statements:sql.split("--> statement-breakpoint").map(s=>s.trim()).filter(Boolean)};
  });
}
export async function accountMigrationStatus(client:Client,migrations=accountMigrations()){
  // Read-only inspection also works on an entirely empty, newly provisioned DB.
  const ledger=await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='lakbay_migrations'");
  const rows=ledger.rows.length?(await client.execute("SELECT tag,hash FROM lakbay_migrations ORDER BY tag")).rows:[];
  const recorded=new Map(rows.map(row=>[String(row.tag),String(row.hash)]));
  return {
    ledgerPresent:ledger.rows.length>0,
    applied:migrations.filter(m=>recorded.get(m.tag)===m.hash).map(m=>m.tag),
    pending:migrations.filter(m=>!recorded.has(m.tag)).map(m=>m.tag),
    changed:migrations.filter(m=>recorded.has(m.tag)&&recorded.get(m.tag)!==m.hash).map(m=>m.tag),
    unrecognized:[...recorded.keys()].filter(tag=>!migrations.some(m=>m.tag===tag)),
  };
}
export async function applyAccountMigrations(client:Client,migrations=accountMigrations()){
  // Request handlers never create tables. This explicit command records immutable
  // migration hashes, and commits each schema change with its ledger entry.
  await client.execute("CREATE TABLE IF NOT EXISTS lakbay_migrations (tag TEXT PRIMARY KEY NOT NULL, hash TEXT NOT NULL, applied_at TEXT NOT NULL)");
  const applied:string[]=[];
  for(const migration of migrations){
    const tx=await client.transaction("write");
    try{
      const existing=await tx.execute({sql:"SELECT hash FROM lakbay_migrations WHERE tag=?",args:[migration.tag]});
      if(existing.rows.length){
        if(existing.rows[0].hash!==migration.hash)throw new Error(`Applied migration changed: ${migration.tag}. Restore the original migration; do not replay it.`);
      }else{
        for(const sql of migration.statements)await tx.execute(sql);
        await tx.execute({sql:"INSERT INTO lakbay_migrations(tag,hash,applied_at) VALUES(?,?,?)",args:[migration.tag,migration.hash,new Date().toISOString()]});
        applied.push(migration.tag);
      }
      await tx.commit();
    }catch(error){await tx.rollback();throw error;}finally{tx.close();}
  }
  return applied;
}
