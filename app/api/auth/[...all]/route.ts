import {getAuth} from "@/lib/auth";
export const dynamic="force-dynamic";
async function handle(request:Request){
  const auth=getAuth();
  if(!auth)return Response.json({error:"Google sign-in is not configured yet. Your browser drafts remain available."},{status:503,headers:{"Cache-Control":"no-store"}});
  try{const response=await auth.handler(request);response.headers.set("Cache-Control","no-store");response.headers.set("Referrer-Policy","no-referrer");return response;}catch{return Response.json({error:"Sign-in is temporarily unavailable. Try again; your draft is preserved."},{status:503,headers:{"Cache-Control":"no-store"}});}
}
export const GET=handle;
export const POST=handle;
