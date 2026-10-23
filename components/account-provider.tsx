"use client";
import {createContext,useContext,useEffect,useState,useCallback,useRef,type ReactNode} from "react";
import {createAuthClient} from "better-auth/react";
import Link from 'next/link';
import {accountFetch,changeBookmark,pendingAction,clearPrivateDrafts,loadBookmarks} from "@/lib/account-client";
type User={id:string;displayName:string;email:string};
type Session={enabled:boolean;user:User|null};
const authClient=createAuthClient();
type Context=Session&{loading:boolean;error:string;bookmarks:string[];refresh:()=>Promise<void>;refreshBookmarks:()=>Promise<void>;signIn:(returnTo:string)=>Promise<void>;signOut:()=>Promise<void>};
const AccountContext=createContext<Context>({enabled:false,user:null,loading:true,error:"",bookmarks:[],refresh:async()=>{},refreshBookmarks:async()=>{},signIn:async()=>{},signOut:async()=>{}});
export const useAccount=()=>useContext(AccountContext);
export default function AccountProvider({children}:{children:ReactNode}){
  const [session,setSession]=useState<Session>({enabled:false,user:null}),[loading,setLoading]=useState(true),[error,setError]=useState("");
  const sessionRequest=useRef(0),userRef=useRef(session.user?.id);userRef.current=session.user?.id;
  const [savedPlaces,setSavedPlaces]=useState<{owner:string;ids:string[]}>({owner:"",ids:[]});
  const refreshBookmarks=useCallback(async()=>{if(!session.user)return;const owner=session.user.id,result=await loadBookmarks();if(userRef.current===owner)setSavedPlaces({owner,ids:result.bookmarks.map(b=>b.placeId)});},[session.user?.id]);
  useEffect(()=>{setSavedPlaces({owner:"",ids:[]});const update=()=>{void refreshBookmarks().catch(()=>{});};update();window.addEventListener("lakbay-bookmarks-changed",update);return()=>window.removeEventListener("lakbay-bookmarks-changed",update);},[refreshBookmarks]);
  const refresh=useCallback(async()=>{
    const requestId=++sessionRequest.current;
    try{
      const result=await accountFetch<Session>("/api/account/session");
      if(requestId!==sessionRequest.current)return;
      try{const previous=sessionStorage.getItem("lakbay:last-account");
        if(result.user){
          if(previous&&previous!==result.user.id){clearPrivateDrafts();const action=pendingAction();if(action?.ownerId&&action.ownerId!==result.user.id)pendingAction(null);}
          sessionStorage.setItem("lakbay:last-account",result.user.id);
        }
      }catch{/* Backend sessions remain usable when optional recovery storage is blocked. */}
      setSession(result);setError("");
    }catch{if(requestId===sessionRequest.current)setError("Account connection unavailable. Your work is preserved. Retry when connected.");}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{
    void refresh();
    const expired=()=>{sessionRequest.current++;setSession(s=>({...s,user:null}));setError("Your session expired. Sign in with the same Google account to recover your edits.");};
    const visible=()=>{if(document.visibilityState==="visible")void refresh();};
    const changed=(e:StorageEvent)=>{if(e.key==="lakbay:account-change")void refresh();};
    window.addEventListener("focus",refresh);document.addEventListener("visibilitychange",visible);window.addEventListener("storage",changed);window.addEventListener("lakbay-session-expired",expired);
    return()=>{window.removeEventListener("focus",refresh);document.removeEventListener("visibilitychange",visible);window.removeEventListener("storage",changed);window.removeEventListener("lakbay-session-expired",expired);};
  },[refresh]);
  useEffect(()=>{
    const action=pendingAction();
    if(!session.user||action?.kind!=="bookmark")return;
    let cancelled=false;
    void changeBookmark(action.id,true).then(()=>{if(!cancelled){pendingAction(null);window.dispatchEvent(new Event("lakbay-bookmarks-changed"));}}).catch(e=>{if(!cancelled)setError(e.message);});
    return()=>{cancelled=true;};
  },[session.user]);
  async function signIn(returnTo:string){
    if(!session.enabled)return;
    setError("");
    try{
      const safe=returnTo.startsWith("/")&&!returnTo.startsWith("//")?returnTo:"/my-trips";
      const result=await authClient.signIn.social({provider:"google",callbackURL:safe,errorCallbackURL:"/account?error=signin",disableRedirect:true});
      if(result.error)throw new Error("Google sign-in could not start. Retry; your draft is preserved.");
      if(!result.data?.url)throw new Error("Google sign-in did not return a destination. Retry.");
      window.open(result.data.url,"_top");
    }catch(e){setError(e instanceof Error?e.message:"Sign-in unavailable. Retry.");throw e;}
  }
  async function signOut(){
    const result=await authClient.signOut();
    if(result.error)throw new Error("Sign-out failed. Please retry.");
    sessionRequest.current++;
    try{clearPrivateDrafts();pendingAction(null);sessionStorage.removeItem("lakbay:last-account");localStorage.setItem("lakbay:account-change",crypto.randomUUID());}catch{}
    setSession(s=>({...s,user:null}));
  }
  return <AccountContext.Provider value={{...session,loading,error,refresh,signIn,signOut,refreshBookmarks,bookmarks:savedPlaces.owner===session.user?.id?savedPlaces.ids:[]}}>{children}</AccountContext.Provider>;
}
export function GoogleSignIn({returnTo,children="Continue with Google",before}:{returnTo:string;children?:ReactNode;before?:()=>void}){
  const account=useAccount(),[busy,setBusy]=useState(false),[localError,setLocalError]=useState("");
  if(account.loading)return <span role="status">Checking account…</span>;
  if(!account.enabled)return <p className="fine-print">Account saving is not available yet. You can plan, edit and export a browser draft.</p>;
  return <div><button className="button google-sign-in" disabled={busy} aria-busy={busy} onClick={async()=>{if(busy)return;setBusy(true);setLocalError("");try{before?.();await account.signIn(returnTo);}catch(e){setLocalError(e instanceof Error?e.message:"Sign-in could not start. Retry.");setBusy(false);}}}>{busy?"Opening Google…":children}</button>{(localError||account.error)&&<p role="alert" className="notice error">{localError||account.error}</p>}</div>;
}
export function AccountMenu(){const account=useAccount();return <Link className="account-entry" href="/account">{account.user?account.user.displayName:account.enabled?"Sign in with Google":"Account"}</Link>;}
