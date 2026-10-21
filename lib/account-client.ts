import type {Trip} from "./trip";
import type {AccountTrip,Bookmark} from "./account-contract";
export class AccountClientError extends Error{constructor(public status:number,message:string){super(message);}}
export async function accountFetch<T>(path:string,options:RequestInit={}):Promise<T>{
  let response:Response;
  try{response=await fetch(path,{...options,credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json",...options.headers},signal:AbortSignal.timeout(20000)});}
  catch{throw new AccountClientError(0,"Could not reach your account. Your edits are preserved. Check your connection and retry.");}
  let data:T&{error?:string};
  try{data=await response.json() as T&{error?:string};}catch{throw new AccountClientError(response.status||503,"The account service returned an unreadable response. Your edits are preserved; retry shortly.");}
  if(!response.ok){if(response.status===401)window.dispatchEvent(new Event("lakbay-session-expired"));throw new AccountClientError(response.status,data.error||"Account request failed. Your edits are preserved.");}
  return data;
}
export const loadAccountTrip=(id:string)=>accountFetch<AccountTrip>(`/api/account/trips/${encodeURIComponent(id)}`);
export const saveAccountTrip=(trip:Trip,revision:number,mutationId:string)=>accountFetch<AccountTrip>(`/api/account/trips/${trip.id}`,{method:"PUT",body:JSON.stringify({trip,revision,mutationId})});
export const listAccountTrips=(offset=0)=>accountFetch<{trips:AccountTrip[];hasMore:boolean;nextOffset:number}>(`/api/account/trips?offset=${offset}`);
export async function allAccountTrips(){const trips:AccountTrip[]=[];let offset=0;for(;;){const page=await listAccountTrips(offset);trips.push(...page.trips);if(!page.hasMore)return trips;offset=page.nextOffset;}}
export const loadBookmarks=()=>accountFetch<{bookmarks:Bookmark[]}>("/api/account/bookmarks");
export const changeBookmark=(id:string,saved:boolean)=>accountFetch(`/api/account/bookmarks/${encodeURIComponent(id)}`,{method:saved?"PUT":"DELETE"});
export type PendingAction={kind:"trip"|"bookmark";id:string;ownerId?:string};
export function pendingAction(value?:PendingAction|null):PendingAction|null{
  try{if(value===null)sessionStorage.removeItem("lakbay:pending-account-action");else if(value)sessionStorage.setItem("lakbay:pending-account-action",JSON.stringify(value));return JSON.parse(sessionStorage.getItem("lakbay:pending-account-action")||"null");}catch{if(value)throw new Error("This browser could not preserve your sign-in action. Enable browser storage or export a backup before continuing.");return null;}
}
export const privateDraftKey=(owner:string,id:string)=>`lakbay:private-draft:${owner}:${id}`;
export function clearPrivateDrafts(){for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i);if(key?.startsWith("lakbay:private-draft:"))sessionStorage.removeItem(key);}}
