import {readFile,writeFile,readdir} from "node:fs/promises";
const json=async path=>JSON.parse(await readFile(path,"utf8"));
const catalog=await json("public/data/lakbay-locations.json"),content=await json("lib/catalog/place-content.json"),videos=await json("lib/catalog/place-videos.json");
const instagram=await json('lib/catalog/place-instagram.json');
const foodDecisions=[];
try{for(const file of (await readdir('docs/food-directory/batches')).filter(n=>n.endsWith('.json'))){const batch=await json('docs/food-directory/batches/'+file);for(const e of batch.entries)foodDecisions.push({placeId:e.record.id,batchId:batch.id,checkedOn:batch.checkedOn,photo:e.photoResearch});}}catch(e){if(e.code!=='ENOENT')throw e;}
let previous={};try{previous=await json("public/data/place-enrichment-progress.json");}catch{}
const sourceChecks=new Map();
for(const file of (await readdir("docs/place-enrichment")).filter(n=>n.endsWith("-link-check.json")).sort()){
  const report=await json(`docs/place-enrichment/${file}`);
  for(const link of report.links)sourceChecks.set(link.url,{...link,checkedOn:report.checkedOn,report:file});
}
const records=catalog.map(p=>{
  const c=content.find(c=>c.placeId===p.id),v=videos.filter(v=>v.placeId===p.id&&v.status==="available"),old=previous.records?.find(r=>r.placeId===p.id);
  const food=foodDecisions.find(f=>f.placeId===p.id);
  return {placeId:p.id,name:p.name,destination:p.destination_group,municipality:p.city_municipality,
    description:c?(old?.descriptionStatus||"improved"):"pending",image:c?.photo?(previous.initialInventory?.photoPlaceIds?.includes(p.id)?"retained-existing":"added"):previous.initialInventory?.photoPlaceIds?.includes(p.id)?"retained-existing":"gap",videos:v.length?"metadata-reviewed":old?.mediaReviewed?"reviewed-gap":"pending",videoCount:v.length,
    instagramResources:instagram.filter(r=>r.placeId===p.id).length,
    instagramConfirmedEmbeds:instagram.filter(r=>r.placeId===p.id&&r.embedCheck.status==='confirmed').length,
    descriptionStatus:old?.descriptionStatus||null,mediaReviewed:old?.mediaReviewed||false,
    ...(old?.photoResearch?{photoResearch:old.photoResearch}:{}),
    ...(food?{foodResearch:{batchId:food.batchId,description:'reviewed',photo:food.photo,video:'not-researched; no new association published'}}:{}),
    existingSummaryWords:p.description.split(/\s+/).length,reviewedOn:old?.reviewedOn||food?.checkedOn||null,
    summaryWords:c?.summary.split(/\s+/).length||0,overviewWords:c?.overview.join(" ").split(/\s+/).length||0,
    sourceUrls:c?.sources.map(s=>s.url)||[p.sources.identity.sourceUrl],
    sourceReachabilityIssues:(c?.sources||[]).map(s=>sourceChecks.get(s.url)).filter(l=>l&&l.status!==200&&l.status!==206),
    notes:old?.notes||[],
  };
});
const progress={...previous,catalogSize:catalog.length,initialInventory:previous.initialInventory||{photos:catalog.filter(p=>p.image).length,videos:0,weakSummaries:catalog.filter(p=>p.description.split(/\s+/).length<25).length},
  updatedOn:new Date().toISOString().slice(0,10),featureStatus:previous.featureStatus||"implementation-in-progress",stage:previous.stage||"A",
  totals:{reviewed:records.filter(r=>r.reviewedOn).length,descriptionsImproved:content.length,photographsAdded:records.filter(r=>r.image==="added").length,existingPhotographs:previous.initialInventory?.photos??catalog.filter(p=>p.image).length,photoGaps:records.filter(r=>r.image==="gap").length,locationsWithVideos:new Set(videos.filter(v=>v.status==="available").map(v=>v.placeId)).size,videos:videos.filter(v=>v.status==="available").length,videoGaps:records.filter(r=>!r.videoCount).length},
  instagramCoverage:{resources:instagram.length,locations:new Set(instagram.map(r=>r.placeId)).size,confirmedEmbeds:instagram.filter(r=>r.embedCheck.status==='confirmed').length,linkOnly:instagram.filter(r=>r.presentation==='link-only').length,progress:'public/data/instagram-progress.json',photoCoverageIndependent:true},
  batches:previous.batches||[],records,nextBatch:previous.nextBatch||["iloilo-jaro-plaza-heritage-area","iloilo-plaza-libertad","iloilo-molo-church-plaza","iloilo-miagao-church","baguio-burnham-park","baguio-botanical-garden","cebu-fort-san-pedro","cebu-casa-gorordo"],
  limitations:previous.limitations||["Descriptions and place-specific media are a separate display overlay; saved itinerary snapshots and stable IDs are unchanged.","Video metadata/description checks are not a full-footage review. Unavailable publication dates remain unknown."]};
await writeFile("public/data/place-enrichment-progress.json",JSON.stringify(progress,null,2)+"\n");
// Keep the current combined gap export separate from the historical 148-place
// photo-only checklist; later additions must not inflate that pass's outcomes.
try{
 const path='docs/place-enrichment/remaining-gaps.json',gaps=await json(path);
 gaps.photoUpdatedOn=progress.updatedOn;
 gaps.photoGaps=records.filter(r=>r.image==='gap').map(r=>({placeId:r.placeId,name:r.name,destination:r.destination,notes:r.notes,photoResearch:r.photoResearch||r.foodResearch?.photo}));
 gaps.foodExpansion={records:foodDecisions.length,record:'docs/food-directory/README.md',photoDecisions:'docs/food-directory/media/decisions.json'};
 await writeFile(path,JSON.stringify(gaps,null,2)+'\n');
}catch(e){if(e.code!=='ENOENT')throw e;}
console.log(JSON.stringify({catalog:progress.catalogSize,...progress.totals}));
