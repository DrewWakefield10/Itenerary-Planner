import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
/** Test-only D1 protocol adapter backed by real SQLite, not an in-memory record
 * mock. Runs the same committed SQL, bindings, constraints and transactions. */
export function sqliteD1(filename=":memory:"){
  const sqlite=new DatabaseSync(filename);sqlite.exec("PRAGMA foreign_keys=ON");
  if(!sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user'").get())sqlite.exec(readFileSync("drizzle/0000_shiny_umar.sql","utf8"));
  class Statement{
    args:unknown[]=[];
    constructor(public sql:string){}
    bind(...args:unknown[]){const next=new Statement(this.sql);next.args=args;return next;}
    execute(){const s=sqlite.prepare(this.sql);if(s.columns().length)return {results:s.all(...this.args as never[]),success:true,meta:{changes:0}};const r=s.run(...this.args as never[]);return {results:[],success:true,meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}};}
    async all(){return this.execute();}async run(){return this.execute();}
    async first(column?:string){const row=this.execute().results[0];return column?(row as Record<string,unknown>)?.[column]??null:row??null;}
    async raw(){return this.execute().results.map(row=>Object.values(row));}
  }
  const db={prepare:(sql:string)=>new Statement(sql),batch:async(statements:Statement[])=>{sqlite.exec("BEGIN");try{const rows=statements.map(s=>s.execute());sqlite.exec("COMMIT");return rows;}catch(e){sqlite.exec("ROLLBACK");throw e;}},exec:async(sql:string)=>{sqlite.exec(sql);return {count:0,duration:0};}} as unknown as D1Database;
  function user(id:string){const now=Date.now();sqlite.prepare("INSERT INTO user(id,name,email,email_verified,created_at,updated_at) VALUES(?,?,?,1,?,?)").run(id,id,`${id}@example.com`,now,now);}
  return {db,sqlite,user};
}
