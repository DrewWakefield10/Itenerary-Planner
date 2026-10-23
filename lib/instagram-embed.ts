export const INSTAGRAM_SCRIPT='https://www.instagram.com/embed.js';
type InstagramWindow=Window&{instgrm?:{Embeds?:{process:()=>void}}};
let pending:Promise<void>|null=null;
/** Shared runtime is requested only by an explicit detail-page action. No API
 * token, oEmbed request, downloaded images or untrusted embed HTML is used. */
export function loadInstagramRuntime():Promise<void>{
 if((window as InstagramWindow).instgrm?.Embeds?.process)return Promise.resolve();
 if(pending)return pending;
 pending=new Promise<void>((resolve,reject)=>{
  let settled=false;
  const script=document.createElement('script');script.src=INSTAGRAM_SCRIPT;script.async=true;script.dataset.lakbayInstagram='true';
  const fail=()=>{if(settled)return;settled=true;clearTimeout(timer);script.remove();pending=null;reject(new Error('Instagram could not be loaded. Use the original post link or try again.'));};
  const timer=setTimeout(fail,12000);
  script.onerror=fail;
  script.onload=()=>{if(settled)return;clearTimeout(timer);if((window as InstagramWindow).instgrm?.Embeds?.process){settled=true;resolve();}else fail();};
  document.body.appendChild(script);
 });
 return pending;
}
export function processInstagramEmbeds(){(window as InstagramWindow).instgrm?.Embeds?.process();}
