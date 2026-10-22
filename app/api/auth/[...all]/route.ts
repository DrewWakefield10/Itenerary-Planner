import {getAuth} from "@/lib/auth";
export const dynamic="force-dynamic";
export const runtime="nodejs";
async function handle(request:Request){
  try{
    const auth=await getAuth();
    if(!auth)return Response.json({error:"Google sign-in is unavailable. Your browser drafts remain available."},{status:503,headers:{"Cache-Control":"no-store"}});
    const response=await auth.handler(request);response.headers.set("Cache-Control","no-store");response.headers.set("Referrer-Policy","no-referrer");return response;
  }catch{return Response.json({error:"Sign-in is temporarily unavailable. Try again; your draft is preserved."},{status:503,headers:{"Cache-Control":"no-store"}});}
}
export const GET=handle;
export const POST=handle;
