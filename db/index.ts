import {accountDrizzle,readyAccountBackend} from "../lib/account-database";

export async function getDb() {
  const {status,backend}=await readyAccountBackend();
  if(!backend)throw new Error(`Account database unavailable: ${status}`);
  return accountDrizzle(backend);
}
