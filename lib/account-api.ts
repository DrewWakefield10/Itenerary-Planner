import {accountReadiness} from "./auth";
import {AccountStore} from "./account-store";
import {AccountError,accountIdSchema,saveAccountTripSchema} from "./account-contract";
const reply=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"private, no-store","Vary":"Cookie"}});
export async function handleAccountRequest(request:Request){
  try{
    const url=new URL(request.url),parts=url.pathname.slice("/api/account/".length).split("/");
    if(request.method!=="GET"&&(request.headers.get("origin")!==url.origin||request.headers.get("sec-fetch-site")==="cross-site"))throw new AccountError(403,"This action must come from Lakbay.");
    if(parts[0]==="session"&&request.method==="GET"){
      const readiness=await accountReadiness(),auth=readiness.auth,enabled=!!auth;
      const response=auth?await auth.handler(new Request(new URL("/api/auth/get-session",request.url),{headers:request.headers})):null;
      const data=response?await response.json() as {user?:{id:string;name:string;email:string}}|null:null;
      const user=data?.user;
      if(response&&!response.ok)return reply({enabled:false,user:null,readiness:"database_unavailable"},503);
      const result=reply({enabled,readiness:readiness.status,user:user?{id:user.id,displayName:user.name,email:user.email}:null});
      for(const cookie of response?.headers.getSetCookie()||[])result.headers.append("Set-Cookie",cookie);
      return result;
    }
    const {auth,db}=await accountReadiness();
    if(!auth||!db)throw new AccountError(503,"Google account saving is unavailable. Your browser draft is preserved.");
    const user=(await auth.api.getSession({headers:request.headers}))?.user;
    if(!user)throw new AccountError(401,"Your session expired or you are signed out. Sign in with Google again; your edits are preserved.");
    const store=new AccountStore(db,user.id);
    if(parts[0]==="trips"){
      if(!parts[1]&&request.method==="GET"){
        const offset=Number(url.searchParams.get("offset")||0);
        if(!Number.isInteger(offset)||offset<0||offset>100000)throw new AccountError(400,"Invalid page.");
        return reply(await store.list(offset));
      }
      const id=accountIdSchema.parse(parts[1]);
      if(request.method==="GET"){
        const trip=await store.find(id);if(!trip)throw new AccountError(404,"Trip not found in this account.");return reply(trip);
      }
      if(request.method==="PUT"){
        const text=await request.text();if(text.length>1000000)throw new AccountError(413,"This trip is too large to save (1 MB limit).");
        const data=saveAccountTripSchema.parse(JSON.parse(text));
        if(data.trip.id!==id)throw new AccountError(400,"Trip ID does not match the request.");
        return reply(await store.save(data.trip,data.revision,data.mutationId));
      }
      if(request.method==="DELETE"){
        const revision=Number(url.searchParams.get("revision"));
        if(!Number.isInteger(revision)||revision<1)throw new AccountError(400,"A saved revision is required.");
        await store.remove(id,revision);return reply({deleted:true});
      }
    }
    if(parts[0]==="bookmarks"){
      if(!parts[1]&&request.method==="GET")return reply({bookmarks:await store.bookmarks()});
      const id=accountIdSchema.parse(parts[1]);
      if(request.method==="PUT"){await store.bookmark(id);return reply({saved:true});}
      if(request.method==="DELETE"){await store.unbookmark(id);return reply({deleted:true});}
    }
    return reply({error:"Account action not found."},404);
  }catch(error){
    if(error instanceof AccountError)return reply({error:error.message},error.status);
    if(error instanceof SyntaxError||(error as {name?:string})?.name==="ZodError")return reply({error:"Invalid trip or request. Check dates, text lengths and amounts."},400);
    return reply({error:"Account storage is temporarily unavailable. Your edits have not been discarded; retry shortly."},503);
  }
}
