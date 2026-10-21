"use client";
import {useEffect,useState} from "react";
import Link from "next/link";
import {Heart} from "lucide-react";
import {useAccount,GoogleSignIn} from "./account-provider";
import {loadBookmarks,changeBookmark,pendingAction} from "@/lib/account-client";
import type {Bookmark} from "@/lib/account-contract";
import DiscoveryAddDialog from "./discovery-add-dialog";
import {discoveryPlace,discoveryStop} from "@/lib/discovery";
export function BookmarkButton({placeId,name}:{placeId:string;name:string}){
  const account=useAccount(),[busy,setBusy]=useState(false),[error,setError]=useState("");
  if(!account.enabled||account.loading)return null;
  if(!account.user)return <GoogleSignIn returnTo={`/discover/${placeId}`} before={()=>pendingAction({kind:"bookmark",id:placeId})}>Save place</GoogleSignIn>;
  const current=account.bookmarks.includes(placeId);
  return <div><button className="text-link plain-button" disabled={busy} aria-label={`${current?"Remove saved":"Save"} place ${name}`} aria-pressed={current} onClick={async()=>{if(busy)return;setBusy(true);setError("");try{await changeBookmark(placeId,!current);await account.refreshBookmarks();}catch(e){setError(e instanceof Error?e.message:"Could not save this place. Retry.");}finally{setBusy(false);}}}><Heart size={16} fill={current?"currentColor":"none"}/>{busy?"Updating…":current?"Saved place":"Save place"}</button>{error&&<p className="fine-print" role="alert">{error}</p>}</div>;
}
export default function SavedPlaces(){
  const account=useAccount(),[rows,setRows]=useState<Bookmark[]>([]),[owner,setOwner]=useState(""),[loading,setLoading]=useState(true),[error,setError]=useState(""),[busy,setBusy]=useState(""),[add,setAdd]=useState("");
  async function refresh(){setLoading(true);try{const data=await loadBookmarks();setRows(data.bookmarks);setOwner(account.user!.id);setError("");}catch(e){setError(e instanceof Error?e.message:"Could not load saved places.");}finally{setLoading(false);}}
  useEffect(()=>{setRows([]);setOwner("");if(account.user)void refresh();else setLoading(false);},[account.user?.id]);
  const visible=owner===account.user?.id?rows:[];
  return <section className="page section"><span className="eyebrow">LITTLE PLACES TO COME BACK TO.</span><h1 className="page-title">Saved <em>Places.</em></h1><p className="lede">Private bookmarks for your next itinerary.</p>
    {!account.user?<GoogleSignIn returnTo="/saved-places"/>:loading?<p role="status">Opening your saved places…</p>:<>
      {error&&<div className="notice error" role="alert">{error}<button className="button secondary" onClick={refresh}>Retry</button></div>}
      {!error&&!visible.length&&<div className="empty"><Heart size={36}/><h2>A little room for your favorites.</h2><Link className="button" href="/discover">Explore destinations</Link></div>}
      <div className="discovery-grid">{visible.map(row=>{const p=discoveryPlace(row.placeId),stop=p&&discoveryStop(p);return <article className="paper-note" key={row.placeId}><p className="eyebrow">{row.municipality||row.destination}</p><h2>{row.name}</h2><p>{row.description}</p>{!row.available&&<p className="notice">No longer in the current directory. This saved description is retained; confirm availability.</p>}<div className="trip-toolbar">{row.available&&<Link className="text-link" href={`/discover/${row.placeId}`}>View place</Link>}{stop&&<button className="button secondary small" onClick={()=>setAdd(row.placeId)}>Add to a trip</button>}<button className="text-link plain-button" disabled={!!busy} onClick={async()=>{setBusy(row.placeId);try{await changeBookmark(row.placeId,false);setRows(r=>r.filter(b=>b.placeId!==row.placeId));}catch(e){setError(e instanceof Error?e.message:"Remove failed.");}finally{setBusy("");}}}>{busy===row.placeId?"Removing…":"Remove bookmark"}</button></div></article>;})}</div>
    </>}{add&&<DiscoveryAddDialog placeId={add} onClose={()=>setAdd("")}/>}</section>;
}
