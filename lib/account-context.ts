import {AsyncLocalStorage} from "node:async_hooks";
// Trusted Worker bindings scoped to one request. Browser identity headers are
// never authentication for Google accounts. Without a binding, fail closed.
const storage=new AsyncLocalStorage<{DB?:D1Database}>();
export const runWithAccountDatabase=<T>(DB:D1Database|undefined,run:()=>T)=>storage.run({DB},run);
export const accountDatabase=()=>storage.getStore()?.DB;
