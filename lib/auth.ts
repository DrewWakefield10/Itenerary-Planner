import {betterAuth} from "better-auth/minimal";
import {drizzleAdapter} from "@better-auth/drizzle-adapter";
import {drizzle} from "drizzle-orm/d1";
import * as schema from "../db/schema";
import {accountDatabase} from "./account-context";

export function authConfiguration(){
  const {GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET,BETTER_AUTH_SECRET,BETTER_AUTH_URL}=process.env;
  if(!GOOGLE_CLIENT_ID||!GOOGLE_CLIENT_SECRET||!BETTER_AUTH_SECRET||BETTER_AUTH_SECRET.length<32||!BETTER_AUTH_URL)return null;
  try{
    const url=new URL(BETTER_AUTH_URL);
    if(url.pathname!=="/"||url.search||url.hash||url.username||url.password)return null;
    if(url.protocol!=="https:"&&!(url.protocol==="http:"&&["localhost","127.0.0.1"].includes(url.hostname)))return null;
    return {clientId:GOOGLE_CLIENT_ID,clientSecret:GOOGLE_CLIENT_SECRET,secret:BETTER_AUTH_SECRET,origin:url.origin};
  }catch{return null;}
}
export function createGoogleAuth(DB:D1Database,config:NonNullable<ReturnType<typeof authConfiguration>>){
  return betterAuth({
    appName:"Lakbay",baseURL:config.origin,secret:config.secret,
    database:drizzleAdapter(drizzle(DB,{schema}),{provider:"sqlite",schema,transaction:false}),
    emailAndPassword:{enabled:false},
    socialProviders:{google:{clientId:config.clientId,clientSecret:config.clientSecret,prompt:"select_account"}},
    trustedOrigins:[config.origin],
    account:{encryptOAuthTokens:true,accountLinking:{enabled:false}},
    session:{expiresIn:60*60*24*30,updateAge:60*60*24,cookieCache:{enabled:false}},
    advanced:{cookiePrefix:"lakbay",useSecureCookies:config.origin.startsWith("https:"),ipAddress:{ipAddressHeaders:["cf-connecting-ip"]}},
    databaseHooks:{user:{create:{before:async user=>user.emailVerified?{data:user}:false}}},
    rateLimit:{enabled:true},
    logger:{level:"error",log:()=>console.error("Lakbay Google authentication failed; retry the sign-in flow.")},
  });
}
const instances=new WeakMap<D1Database,{config:string;auth:ReturnType<typeof createGoogleAuth>}>();
export function getAuth(){
  const config=authConfiguration(),DB=accountDatabase();
  if(!config||!DB)return null;
  const key=JSON.stringify(config),cached=instances.get(DB);
  if(cached?.config===key)return cached.auth;
  const auth=createGoogleAuth(DB,config);instances.set(DB,{config:key,auth});return auth;
}
export async function accountUser(request:Request){
  const auth=getAuth();
  if(!auth)return null;
  const session=await auth.api.getSession({headers:request.headers});
  return session?.user||null;
}
