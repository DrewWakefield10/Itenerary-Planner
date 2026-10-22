import {existsSync} from "node:fs";
import {accountBackend,probeAccountDatabase} from "../lib/account-database";
import {applyAccountMigrations,accountMigrationStatus} from "../db/migrate";

const envIndex=process.argv.indexOf("--account-env"),envFile=envIndex<0?".env.local":process.argv[envIndex+1];
if(envIndex>=0&&(!envFile||envFile.startsWith("--")||!existsSync(envFile))){
  console.error("Supply an existing environment file: --account-env .env.production.local. No database operation was attempted.");
  process.exit(1);
}
if(existsSync(envFile))process.loadEnvFile(envFile);
const selected=accountBackend();
if(!selected.backend||selected.backend.kind!=="turso"){
  console.error(`Account database: ${selected.status}. Set TURSO_DATABASE_URL (libsql:// or https://) and TURSO_AUTH_TOKEN in .env.local or the shell environment.`);
  process.exitCode=1;
}else{
  const {backend}=selected;
  try{
    const before=await accountMigrationStatus(backend.client);
    if(before.changed.length||before.unrecognized.length){
      console.error("Migration history does not match this checkout. Restore the original migration files or update the checkout before proceeding. No schema changes were attempted.");
      process.exitCode=1;
    }else{
      if(process.argv.includes("--migrate")){
        const applied=await applyAccountMigrations(backend.client);
        console.log(applied.length?`Applied migrations: ${applied.join(", ")}`:"No pending migrations.");
      }
      const migrations=await accountMigrationStatus(backend.client);
      console.log(`Applied migrations: ${migrations.applied.join(", ")||"none"}`);
      console.log(`Pending migrations: ${migrations.pending.join(", ")||"none"}`);
      const status=await probeAccountDatabase(backend.db);
      console.log(`Account database: ${status}`);
      if(status!=="ready"||migrations.pending.length)process.exitCode=1;
    }
  }catch{
    console.error("Database operation failed. Check the database URL, read/write token and connectivity. If tables already exist without the migration ledger, do not drop or replay them; back up and reconcile the schema first. No credentials are logged.");
    process.exitCode=1;
  }finally{backend.client.close();}
}
