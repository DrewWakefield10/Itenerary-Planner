"use client";
import {useState,useEffect} from "react";
import Link from "next/link";
import {useAccount,GoogleSignIn} from "./account-provider";
import {createAuthClient} from "better-auth/react";
import {pendingAction} from "@/lib/account-client";
export default function AccountPage(){
  const account=useAccount(),[name,setName]=useState<string|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
  useEffect(()=>{if(new URLSearchParams(location.search).get("error"))setMessage("Google sign-in did not finish. Your draft is preserved. You can try again.");},[]);
  if(account.loading)return <section className="page section" role="status">Opening your account…</section>;
  return <section className="page section account-page"><span className="eyebrow">YOUR PLANS. YOUR OWN LITTLE CORNER.</span><h1 className="page-title">Your <em>account.</em></h1>
    {account.user?<>
      <p>Signed in with Google. Trips and saved places are private to your account.</p>
      <form noValidate className="paper-note" onSubmit={async e=>{e.preventDefault();if(busy)return;const value=(name??account.user!.displayName).trim();if(!value||value.length>100){setMessage("Enter a display name from 1 to 100 characters.");return;}setBusy(true);try{const r=await createAuthClient().updateUser({name:value});if(r.error)throw new Error("Profile could not be saved. Retry.");await account.refresh();setMessage("Profile saved.");}catch(e){setMessage(e instanceof Error?e.message:"Profile could not be saved.");}finally{setBusy(false);}}}>
        <label>Display name<input required maxLength={100} value={name??account.user.displayName} onChange={e=>setName(e.target.value)}/></label><label>Email<input readOnly value={account.user.email}/></label>
        <p className="fine-print">Email and account security are managed by Google. No Lakbay password is required.</p><button className="button" disabled={busy}>{busy?"Saving…":"Save profile"}</button>
      </form><div className="trip-toolbar"><Link className="button secondary" href="/my-trips">My Trips</Link><Link className="button secondary" href="/saved-places">Saved Places</Link><button className="text-link plain-button" disabled={busy} onClick={async()=>{setBusy(true);try{await account.signOut();setName(null);setMessage("Signed out of Lakbay.");}catch{setMessage("Sign-out failed. Retry.");}finally{setBusy(false);}}}>Log out</button></div>
    </>:<><p>Use your personal Google account to save trips across devices. New visitors get a Lakbay profile on their first Google sign-in.</p><GoogleSignIn returnTo={pendingAction()?.kind==="trip"?`/trips/${pendingAction()!.id}`:pendingAction()?.kind==="bookmark"?`/discover/${pendingAction()!.id}`:"/my-trips"}/><p className="fine-print">Lakbay is a standalone travel planner. Google handles account verification and recovery; no separate password is needed.</p><Link className="text-link" href="/planner">Continue planning as a guest</Link></>}
    {(message||account.error)&&<p className="notice" role="status">{message||account.error}</p>}
  </section>;
}
