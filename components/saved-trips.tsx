"use client";
import {useState,useEffect,useRef} from "react";
import Link from "next/link";
import {BookOpen,ArrowUpRight,Copy,Trash2} from "lucide-react";
import {tripSchema,type Trip} from "@/lib/trip";
import {readTrips,saveTrip,deleteTrip} from "@/lib/trip-storage";
import {budgetSummary,uid} from "@/lib/engine";
import {peso,destinationImage,destination} from "@/lib/destinations";
import {useAccount,GoogleSignIn} from "./account-provider";
import {listAccountTrips,saveAccountTrip,accountFetch} from "@/lib/account-client";
import type {AccountTrip} from "@/lib/account-contract";
import ConfirmDialog from "./confirm-dialog";
export default function SavedTrips(){
  const account=useAccount();
  const currentOwner=useRef(account.user?.id);currentOwner.current=account.user?.id;
  const [drafts,setDrafts]=useState<Trip[]>([]),[records,setRecords]=useState<AccountTrip[]>([]),[owner,setOwner]=useState(""),[more,setMore]=useState(false),[offset,setOffset]=useState(0),[loading,setLoading]=useState(false),[message,setMessage]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState(""),[remove,setRemove]=useState<{trip:Trip;record?:AccountTrip}|null>(null);
  useEffect(()=>setDrafts(readTrips()),[]);
  async function load(start=0){
    if(!account.user)return;setLoading(true);setError("");
    const userId=account.user.id;
    try{const page=await listAccountTrips(start);if(currentOwner.current!==userId)return;setRecords(r=>start?[...r,...page.trips]:page.trips);setOwner(userId);setMore(page.hasMore);setOffset(page.nextOffset);}catch(e){if(currentOwner.current===userId)setError(e instanceof Error?e.message:"Could not load trips.");}finally{setLoading(false);}
  }
  useEffect(()=>{setRecords([]);setOwner("");if(account.user)void load();},[account.user?.id]);
  const cloud=owner===account.user?.id?records:[];
  function cards(trips:{trip:Trip;record?:AccountTrip}[]){return <div className="destination-grid">{trips.map(({trip:t,record})=><article className="postcard" key={(record?"account-":"draft-")+t.id}>
    <Link href={`/trips/${t.id}`}><img src={destinationImage(t.request.destinations[0])} alt="Trip destination"/></Link><div className="postcard-body"><span className="eyebrow">{t.days.length} DAYS / {record?"PRIVATE ACCOUNT TRIP":"BROWSER DRAFT"}</span><Link href={`/trips/${t.id}`}><h3>{t.title}</h3></Link><p>{t.request.destinations.map(s=>destination(s)?.name||s).join(", ")}</p><p>{t.request.startDate} / {peso(budgetSummary(t).total)} estimated</p>{record&&<p className="fine-print">Updated {new Date(record.updatedAt).toLocaleString("en-PH",{dateStyle:"medium",timeStyle:"short"})}</p>}
    <div className="trip-card-actions"><Link className="text-link" href={`/trips/${t.id}`}>Open journal <ArrowUpRight size={15}/></Link><button className="icon-button" disabled={!!busy} aria-label={`Duplicate ${t.title}`} onClick={async()=>{if(busy)return;setBusy(t.id);const copy={...structuredClone(t),id:uid(),title:`${t.title.slice(0,145)} (copy)`,createdAt:new Date().toISOString()};try{if(record){await saveAccountTrip(copy,0,uid());await load();}else{if(!saveTrip(copy))throw new Error("Browser draft could not be saved.");setDrafts(readTrips());}setMessage("Trip duplicated. The itinerary was preserved.");}catch(e){setError(e instanceof Error?e.message:"Could not duplicate trip.");}finally{setBusy("");}}}><Copy size={16}/></button><button className="icon-button" disabled={!!busy} aria-label={`Delete ${t.title}`} onClick={()=>setRemove({trip:t,record})}><Trash2 size={16}/></button></div></div></article>)}</div>;}
  return <section className="page section"><span className="eyebrow">KEEP THE PLANS. COLLECT THE MEMORIES.</span><div className="section-heading account-trips-heading"><h1 className="page-title">Your travel <em>journal.</em></h1><Link href="/planner" className="button">Plan a Trip <ArrowUpRight size={17}/></Link></div>
    {account.user?<><p className="lede">Your private account trips. Opening a trip preserves every saved stop.</p>{loading&&<p role="status">Loading account trips...</p>}{cards(cloud.map(record=>({trip:record.trip,record})))}{more&&<button className="button secondary" disabled={loading} onClick={()=>load(offset)}>Load more trips</button>}{!loading&&!error&&!cloud.length&&<div className="empty"><BookOpen size={36}/><h2>Your next chapter is waiting.</h2><Link className="button" href="/planner">Plan a Trip</Link></div>}</>:<><p className="lede">Sign in to keep personal trips across devices. Browser drafts below are not saved to an account.</p><GoogleSignIn returnTo="/my-trips"/></>}
    {error&&<div className="notice error" role="alert">{error}<button className="button secondary small" onClick={()=>load()}>Retry</button></div>}{message&&<p className="notice" role="status">{message}</p>}
    <label className="backup-import">Restore a Lakbay JSON backup<input type="file" accept="application/json,.json" onChange={async e=>{const input=e.currentTarget,file=input.files?.[0];if(!file)return;try{if(file.size>1000000)throw new Error("Backup must be smaller than 1 MB.");const parsed=tripSchema.safeParse(JSON.parse(await file.text()));if(!parsed.success)throw new Error("This file is not a valid Lakbay itinerary.");const restored={...parsed.data,id:uid(),title:parsed.data.title.slice(0,145)+" (restored)"};if(!saveTrip(restored))throw new Error("Could not save the restored browser draft.");setDrafts(readTrips());setMessage("Backup restored as a new trip.");}catch(e){setError(e instanceof Error?e.message:"Backup could not be read.");}finally{input.value="";}}}/></label>
    <h2>Browser <em>drafts.</em></h2><p className="fine-print">Stored on this device only. Open a draft and select Save Trip to put it in your Google account.</p>{cards(drafts.map(trip=>({trip})))}{!drafts.length&&!account.user&&<div className="empty"><BookOpen size={36}/><h2>Every story starts with a blank page.</h2><Link className="button" href="/planner">Plan a Trip</Link></div>}
    {remove&&<ConfirmDialog title={`Delete ${remove.trip.title}?`} busy={!!busy} onClose={()=>setRemove(null)} onConfirm={async()=>{if(busy)return;setBusy(remove.trip.id);try{if(remove.record){await accountFetch(`/api/account/trips/${remove.trip.id}?revision=${remove.record.revision}`,{method:"DELETE"});await load();}else{if(!deleteTrip(remove.trip.id))throw new Error("Could not remove this browser draft.");setDrafts(readTrips());}setRemove(null);setMessage("Trip deleted.");}catch(e){setError(e instanceof Error?e.message:"Delete failed. Retry.");}finally{setBusy("");}}}><p>{remove.record?"This permanently deletes this private trip from your account on every device.":"This removes this browser draft from this device."} This cannot be undone.</p>{error&&<p role="alert">{error}</p>}</ConfirmDialog>}
  </section>;
}
