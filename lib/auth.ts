import {betterAuth} from "better-auth/minimal";
import {drizzleAdapter} from "@better-auth/drizzle-adapter";
import * as schema from "../db/schema";
import {accountDrizzle,readyAccountBackend,type AccountBackend} from "./account-database";

export function authConfiguration(){
  const {GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET,BETTER_AUTH_SECRET,BETTER_AUTH_URL}=process.env;
  if(!GOOGLE_CLIENT_ID||!GOOGLE_CLIENT_SECRET||!BETTER_AUTH_SECRET||BETTER_AUTH_SECRET.length<32||!BETTER_AUTH_URL)return null;
  try{
    const url=new URL(BETTER_AUTH_URL);
    if(url.pathname!=="/"||url.search||url.hash||url.username||url.password)return null;
    const vercel=process.env.VERCEL==="1"||process.env.VERCEL_ENV==="production";
    if(vercel&&(url.protocol!=="https:"||["localhost","127.0.0.1","[::1]"].includes(url.hostname)))return null;
    if(url.protocol!=="https:"&&!(url.protocol==="http:"&&["localhost","127.0.0.1"].includes(url.hostname)))return null;
    return {clientId:GOOGLE_CLIENT_ID,clientSecret:GOOGLE_CLIENT_SECRET,secret:BETTER_AUTH_SECRET,origin:url.origin};
  }catch{return null;}
}
export function createGoogleAuth(DB:D1Database|AccountBackend,config:NonNullable<ReturnType<typeof authConfiguration>>){
  const backend:AccountBackend="kind" in DB?DB:{kind:"d1",db:DB};
  return betterAuth({
    appName:"Lakbay",baseURL:config.origin,secret:config.secret,
    database:drizzleAdapter(accountDrizzle(backend),{provider:"sqlite",schema,transaction:backend.kind==="turso"}),
    emailAndPassword:{enabled:false},
    socialProviders:{google:{clientId:config.clientId,clientSecret:config.clientSecret,prompt:"select_account"}},
    trustedOrigins:[config.origin],
    account:{encryptOAuthTokens:true,accountLinking:{enabled:false}},
    session:{expiresIn:60*60*24*30,updateAge:60*60*24,cookieCache:{enabled:false}},
    advanced:{cookiePrefix:"lakbay",useSecureCookies:config.origin.startsWith("https:"),ipAddress:{ipAddressHeaders:backend.kind==="d1"?["cf-connecting-ip"]:["x-vercel-forwarded-for","x-forwarded-for"]}},
    databaseHooks:{user:{create:{before:async user=>user.emailVerified?{data:user}:false}}},
    rateLimit:{enabled:true},
    logger:{level:"error",log:()=>console.error("Lakbay Google authentication failed; retry the sign-in flow.")},
  });
}
const instances=new WeakMap<object,{config:string;auth:ReturnType<typeof createGoogleAuth>}>();
export async function accountReadiness(){
  const config=authConfiguration();
  if(!config)return {status:"auth_configuration_invalid" as const};
  const {status,backend}=await readyAccountBackend();
  if(!backend)return {status};
  const key=JSON.stringify(config),cached=instances.get(backend.db);
  const auth=cached?.config===key?cached.auth:createGoogleAuth(backend,config);
  instances.set(backend.db,{config:key,auth});
  return {status:"ready" as const,auth,db:backend.db};
}
export async function getAuth(){
  return (await accountReadiness()).auth??null;
}
export async function accountUser(request:Request){
  const auth=await getAuth();
  if(!auth)return null;
  const session=await auth.api.getSession({headers:request.headers});
  return session?.user||null;
}
