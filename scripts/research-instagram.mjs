// Public publisher references only. No Instagram sign-in, private content,
// image extraction or automatic approval. Shared source pages are fetched once.
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root='docs/place-enrichment/instagram',cache='work/instagram/sources';
await mkdir(root,{recursive:true});await mkdir(cache,{recursive:true});
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const rows=await read('public/data/lakbay-locations.json');
const readme='A publisher reference is a research candidate, not proof of identity, account ownership, public visibility, or embed permission.';
let checklist;try{checklist=await read(root+'/checklist.json');}catch(e){if(e.code!=='ENOENT')throw e;
 const ordered=[...rows].sort((a,b)=>Number(!!a.image)-Number(!!b.image)||Number(!!a.videos?.length)-Number(!!b.videos?.length));
 checklist={startedOn:new Date().toISOString().slice(0,10),catalogSize:rows.length,startingApprovedPhotos:rows.filter(p=>p.image).length,startingPhotoGaps:rows.filter(p=>!p.image).length,records:ordered.map((p,i)=>({placeId:p.id,name:p.name,destination:p.destination_group,municipality:p.city_municipality,category:p.display_category||p.category,hasApprovedPhoto:!!p.image,batchId:`instagram-${String(Math.floor(i/20)+1).padStart(3,'0')}`,status:'pending'}))};
 await writeFile(root+'/checklist.json',JSON.stringify(checklist,null,2)+'\n');
}
const inflight=new Map(),blockedHosts=new Set();
export async function publisherReferences(url){
 if(inflight.has(url))return inflight.get(url);
 const job=(async()=>{
  const hash=createHash('sha256').update(url).digest('hex'),path=cache+'/'+hash+'.json';
  try{return await read(path);}catch{}
  const hostname=new URL(url).hostname;
  if(['instagram.com','www.instagram.com'].includes(hostname))return{url,status:null,limitation:'Instagram source needs an individual public-post review, not automated collection.',candidates:[]};
  if(blockedHosts.has(hostname))return{url,status:429,limitation:'Publisher host rate-limited earlier in this run; no retry attempted.',candidates:[]};
  let result;
  try{
   const response=await fetch(url,{signal:AbortSignal.timeout(12000)});
   if(response.status===429)blockedHosts.add(hostname);
   const html=response.ok?(await response.text()).slice(0,2500000):'';
   const clean=s=>s.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replaceAll('&amp;','&').replaceAll('&#8217;',"'").replace(/\s+/g,' ').trim();
   const found=[];
   for(const m of html.matchAll(/https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel)\/[A-Za-z0-9_-]{5,64}\/[^\s"'<>\\]*/g)){
    const post=m[0].replace(/^http:/,'https:').split(/[?#]/)[0];
    const context=html.slice(Math.max(0,m.index-1800),m.index+2600);
    const blockStart=html.lastIndexOf('<blockquote',m.index),blockEnd=html.indexOf('</blockquote>',m.index);
    const block=blockStart>=0&&m.index-blockStart<15000&&blockEnd>=0?html.slice(blockStart,blockEnd):context;
    const account=/@([A-Za-z0-9._]{1,30})\)/.exec(clean(block))?.[1]||null;
    const excerpt=clean(context).slice(-2100);
    found.push({url:post,account,context:/cdninstagram|fbcdn/.test(excerpt)?'Publisher contains individual post links; embedded asset metadata omitted. Review the original publisher for place context.':excerpt,manualMarkup:/instagram-media/.test(block)});
   }
   result={url,finalUrl:response.url,status:response.status,title:clean(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]||''),candidates:[...new Map(found.map(p=>[p.url,p])).values()],limitation:readme};
  }catch(e){result={url,status:null,error:e.message,candidates:[],limitation:'Inaccessible publisher source; no private content or authentication workaround attempted.'};}
  await writeFile(path,JSON.stringify(result,null,2)+'\n');return result;
 })();inflight.set(url,job);return job;
}
const batch=process.argv[2];
if(batch&&batch!=='init'){
 const entries=checklist.records.filter(r=>r.batchId===batch);if(!entries.length)throw Error('Unknown batch');
 const path=root+'/'+batch+'-research.json';let report={batchId:batch,checkedOn:new Date().toISOString().slice(0,10),mode:'unapproved-research',records:[]};
 try{report=await read(path);}catch(e){if(e.code!=='ENOENT')throw e;}
 for(const entry of entries){if(report.records.some(r=>r.placeId===entry.placeId))continue;
  const p=rows.find(p=>p.id===entry.placeId),urls=[...new Set([p.sources.identity.sourceUrl,p.food?.officialUrl,...p.content_sources?.map(s=>s.url)||[]].filter(Boolean))].slice(0,4);
  const sources=[];for(const url of urls)sources.push(await publisherReferences(url));
  report.records.push({...entry,sources,status:sources.some(s=>s.candidates.length)?'candidates-awaiting-review':'publisher-search-complete-post-search-pending'});
  await writeFile(path+'.tmp',JSON.stringify(report,null,2)+'\n');await rename(path+'.tmp',path);
  console.log(`${entry.placeId}: ${sources.reduce((n,s)=>n+s.candidates.length,0)} unapproved publisher references`);
 }
}
