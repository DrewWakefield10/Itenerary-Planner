import {AsyncLocalStorage} from "node:async_hooks";
// Trusted Worker bindings scoped to one request. Browser identity headers are
// never authentication for Google accounts. Native Next/Vercel uses the remote
// backend in account-database.ts when this optional Worker binding is absent.
const storage=new AsyncLocalStorage<{DB?:D1Database}>();
export const runWithAccountDatabase=<T>(DB:D1Database|undefined,run:()=>T)=>storage.run({DB},run);
export const accountDatabase=()=>storage.getStore()?.DB;
