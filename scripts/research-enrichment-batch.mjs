import {mkdir,readFile,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {wikiCandidate,videoSearchCandidates,get} from "./research-place-content.mjs";
const read=async path=>JSON.parse(await readFile(path,"utf8"));
const progress=await read("public/data/place-enrichment-progress.json"),catalog=await read("public/data/lakbay-locations.json");
await mkdir("docs/place-enrichment/research-batches",{recursive:true});
const offset=Number(process.argv[2]||0),limit=Number(process.argv[3]||25);
if(!Number.isInteger(offset)||!Number.isInteger(limit)||offset<0||limit<1||limit>25)throw new Error("Use a nonnegative offset and a batch size up to 25");
const stageA=new Set(progress.batches.find(b=>b.id==="stage-a")?.placeIds||[]);
const groups=["Iloilo","Baguio","Cebu","Manila","Palawan","Bohol","Batanes","Davao","Boracay","Siargao","Sagada"];
const remaining=catalog.filter(p=>!stageA.has(p.id)).sort((a,b)=>groups.indexOf(a.destination_group)-groups.indexOf(b.destination_group));
const records=[];
for(const p of remaining.slice(offset,offset+limit)){
  let wiki=null,videoSearch=null,sourceProbe=null,commonsSearch=null;
  try{wiki=await read(`work/place-research/${p.id}.json`);}catch{
    try{wiki=await wikiCandidate(p.id,p.name);}catch(error){wiki={error:error.message};}
  }
  if(!wiki.extract){
    const query=p.name.replace(/\s+[—–-]\s+.*$/,"");
    try{const data=await(await get(`https://en.wikipedia.org/w/api.php?action=query&format=json&list=search&srsearch=${encodeURIComponent(query+" "+p.destination_group+" Philippines")}&srlimit=2`)).json();wiki.searchCandidates=data.query?.search?.map(r=>({title:r.title,pageid:r.pageid}))||[];}catch(error){wiki.searchError=error.message;}
  }
  try{videoSearch=await read(`work/place-research/${p.id}-video-search.json`);}catch{try{videoSearch=await videoSearchCandidates(p.id,`${p.name} ${p.city_municipality} Philippines tour`);}catch(error){videoSearch={error:error.message,candidates:[]};}}
  const source=p.sources.identity.sourceUrl;
  try{const key=createHash("sha256").update(source).digest("hex");try{sourceProbe=await read(`work/place-research/source-${key}.json`);}catch{const r=await fetch(source,{signal:AbortSignal.timeout(12000),headers:{"User-Agent":"LakbayCatalogReview/1.0 (https://lakbay-itinerary-planner-psi.vercel.app)"}});sourceProbe={url:source,status:r.status,contentType:r.headers.get("content-type"),checkedOn:"2026-10-22"};const body=await r.text();if(r.ok&&r.headers.get("content-type")?.includes("text/html")){await writeFile(`work/place-research/source-${key}.html`,body);sourceProbe.title=body.match(/<title[^>]*>([^<]*)/i)?.[1]?.trim()||null;}await writeFile(`work/place-research/source-${key}.json`,JSON.stringify(sourceProbe));}}catch(error){sourceProbe={url:source,error:error.message};}
  // Retain failed attempts too: another place sharing an unavailable source
  // should not repeat the same timeout in the next saved batch.
  await writeFile(`work/place-research/source-${createHash("sha256").update(source).digest("hex")}.json`,JSON.stringify(sourceProbe));
  if(!wiki.photo){
    try{const r=await(await get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(p.name+" "+p.city_municipality)}&gsrlimit=3&prop=imageinfo&iiprop=url%7Cextmetadata`)).json();commonsSearch=Object.values(r.query?.pages||{}).map(page=>({title:page.title,photo:page.imageinfo?.[0]}));}catch(error){commonsSearch={error:error.message};}
  }
  const record={placeId:p.id,name:p.name,municipality:p.city_municipality,group:p.destination_group,existingDescription:p.description,identitySource:sourceProbe,wikipedia:wiki,commonsCandidates:commonsSearch,videoCandidates:videoSearch,checkedOn:"2026-10-22",decision:"pending-editorial-review"};
  records.push(record);
  await writeFile(`work/place-research/batch-${offset}.json`,JSON.stringify(records,null,2));
  console.log(JSON.stringify({id:p.id,name:p.name,city:p.city_municipality,source:sourceProbe.status||sourceProbe.error,wiki:wiki.title||wiki.searchCandidates||wiki.error,extract:wiki.extract?.slice(0,650),photo:wiki.photo?.descriptionurl||commonsSearch?.map?.(r=>r.title),videos:(videoSearch.candidates||[]).slice(0,3).map(v=>({id:v.videoId,title:v.title,creator:v.creator}))}));
}
const report={offset,size:records.length,checkedOn:"2026-10-22",status:"candidates-collected-not-automatically-published",records:records.map(r=>({placeId:r.placeId,name:r.name,municipality:r.municipality,identitySource:r.identitySource,wikipedia:r.wikipedia?.url||null,wikiSearchCandidates:r.wikipedia?.searchCandidates||[],imageCandidate:r.wikipedia?.photo?{sourcePage:r.wikipedia.photo.descriptionurl,originalUrl:r.wikipedia.photo.url}:null,commonsCandidates:Array.isArray(r.commonsCandidates)?r.commonsCandidates.map(c=>({title:c.title,url:c.photo?.descriptionurl})):r.commonsCandidates,videoCandidates:r.videoCandidates,decision:r.decision}))};
await writeFile(`docs/place-enrichment/research-batches/candidates-${String(offset).padStart(3,"0")}.json`,JSON.stringify(report,null,2)+"\n");
