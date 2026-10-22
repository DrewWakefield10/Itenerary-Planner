import {readFile,writeFile} from "node:fs/promises";
import sharp from "sharp";
import {placeContents,placeVideos} from "../lib/catalog/place-content";
import {directoryListings} from "../lib/catalog/directory";
const batchIndex=process.argv.indexOf("--batch"),batchId=batchIndex>=0?process.argv[batchIndex+1]:null;
const batch=batchId?JSON.parse(await readFile(`docs/place-enrichment/completed-batches/${batchId}.json`,"utf8")) as {outcomes:{placeId:string}[]}:null;
const selected=placeContents.filter(p=>!batch||batch.outcomes.some(r=>r.placeId===p.placeId));
const ids=new Set<string>(),videoIds=new Set<string>();
for(const p of placeContents){
  if(ids.has(p.placeId)||!directoryListings.some(d=>d.id===p.placeId))throw new Error(`Duplicate or unknown content ID: ${p.placeId}`);ids.add(p.placeId);
  if(p.photo){
    const actual=await sharp("public"+p.photo.src).metadata();
    if(actual.width!==p.photo.width||actual.height!==p.photo.height)throw new Error(`Incorrect reserved dimensions: ${p.placeId}`);
    if(p.photo.srcSmall)await sharp("public"+p.photo.srcSmall).metadata();
  }
}
for(const v of placeVideos){const key=`${v.placeId}:${v.videoId}`;if(videoIds.has(key)||!directoryListings.some(p=>p.id===v.placeId))throw new Error(`Duplicate or unknown video association: ${key}`);videoIds.add(key);}
if(process.argv.includes("--links")){
  const urls=[...new Set(selected.flatMap(p=>[...p.sources.map(s=>s.url),...(p.photo?[p.photo.sourcePage,p.photo.originalUrl,p.photo.licenseUrl]:[])]))];
  const links=[];
  for(let n=0;n<urls.length;n+=4){
    links.push(...await Promise.all(urls.slice(n,n+4).map(async url=>{try{const r=await fetch(url,{signal:AbortSignal.timeout(8000),headers:{"User-Agent":"LakbayCatalogReview/1.0 (https://lakbay-itinerary-planner-psi.vercel.app)"}});await r.body?.cancel();return {url,status:r.status};}catch{return {url,status:null,error:"Network failure or timeout; retain the source for traceability and review manually"};}})));
  }
  await writeFile(`docs/place-enrichment/${batchId||"all"}-link-check.json`,JSON.stringify({checkedOn:new Date().toISOString().slice(0,10),scope:"Reachability only, not factual review",links},null,2)+"\n");
  console.log(`Links checked: ${links.length}; unreachable or blocked: ${links.filter(l=>l.status!==200&&l.status!==206).length}. See saved link report.`);
}
console.log(`Content valid: ${placeContents.length} stable IDs; ${placeContents.filter(p=>p.photo).length} documented photos; ${placeVideos.length} video associations. Batch selection: ${selected.length}. Image files decoded and reserved dimensions match.`);
