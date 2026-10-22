import {readFile,writeFile,readdir} from "node:fs/promises";
const json=async path=>JSON.parse(await readFile(path,"utf8"));
const catalog=await json("public/data/lakbay-locations.json"),content=await json("lib/catalog/place-content.json"),videos=await json("lib/catalog/place-videos.json");
let previous={};try{previous=await json("public/data/place-enrichment-progress.json");}catch{}
const sourceChecks=new Map();
for(const file of (await readdir("docs/place-enrichment")).filter(n=>n.endsWith("-link-check.json")).sort()){
  const report=await json(`docs/place-enrichment/${file}`);
  for(const link of report.links)sourceChecks.set(link.url,{...link,checkedOn:report.checkedOn,report:file});
}
const records=catalog.map(p=>{
  const c=content.find(c=>c.placeId===p.id),v=videos.filter(v=>v.placeId===p.id&&v.status==="available"),old=previous.records?.find(r=>r.placeId===p.id);
  return {placeId:p.id,name:p.name,destination:p.destination_group,municipality:p.city_municipality,
    description:c?(old?.descriptionStatus||"improved"):"pending",image:c?.photo?(previous.initialInventory?.photoPlaceIds?.includes(p.id)?"retained-existing":"added"):previous.initialInventory?.photoPlaceIds?.includes(p.id)?"retained-existing":"gap",videos:v.length?"metadata-reviewed":old?.mediaReviewed?"reviewed-gap":"pending",videoCount:v.length,
    descriptionStatus:old?.descriptionStatus||null,mediaReviewed:old?.mediaReviewed||false,
    existingSummaryWords:p.description.split(/\s+/).length,reviewedOn:old?.reviewedOn||null,
    summaryWords:c?.summary.split(/\s+/).length||0,overviewWords:c?.overview.join(" ").split(/\s+/).length||0,
    sourceUrls:c?.sources.map(s=>s.url)||[p.sources.identity.sourceUrl],
    sourceReachabilityIssues:(c?.sources||[]).map(s=>sourceChecks.get(s.url)).filter(l=>l&&l.status!==200&&l.status!==206),
    notes:old?.notes||[],
  };
});
const progress={...previous,catalogSize:catalog.length,initialInventory:previous.initialInventory||{photos:catalog.filter(p=>p.image).length,videos:0,weakSummaries:catalog.filter(p=>p.description.split(/\s+/).length<25).length},
  updatedOn:new Date().toISOString().slice(0,10),featureStatus:previous.featureStatus||"implementation-in-progress",stage:previous.stage||"A",
  totals:{reviewed:records.filter(r=>r.reviewedOn).length,descriptionsImproved:content.length,photographsAdded:records.filter(r=>r.image==="added").length,existingPhotographs:previous.initialInventory?.photos??catalog.filter(p=>p.image).length,photoGaps:records.filter(r=>r.image==="gap").length,locationsWithVideos:new Set(videos.filter(v=>v.status==="available").map(v=>v.placeId)).size,videos:videos.filter(v=>v.status==="available").length,videoGaps:records.filter(r=>!r.videoCount).length},
  batches:previous.batches||[],records,nextBatch:previous.nextBatch||["iloilo-jaro-plaza-heritage-area","iloilo-plaza-libertad","iloilo-molo-church-plaza","iloilo-miagao-church","baguio-burnham-park","baguio-botanical-garden","cebu-fort-san-pedro","cebu-casa-gorordo"],
  limitations:previous.limitations||["Descriptions and place-specific media are a separate display overlay; saved itinerary snapshots and stable IDs are unchanged.","Video metadata/description checks are not a full-footage review. Unavailable publication dates remain unknown."]};
await writeFile("public/data/place-enrichment-progress.json",JSON.stringify(progress,null,2)+"\n");
console.log(JSON.stringify({catalog:progress.catalogSize,...progress.totals}));
