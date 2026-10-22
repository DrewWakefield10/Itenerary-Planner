// Publishes explicit editorial decisions, never unreviewed search results.
import {mkdir,readFile,writeFile} from "node:fs/promises";
import sharp from "sharp";
import {downloadApprovedPhoto,videoCandidate,get} from "./research-place-content.mjs";
const read=async p=>JSON.parse(await readFile(p,"utf8"));
const decision=await read(process.argv[2]),catalog=await read("public/data/lakbay-locations.json");
const content=await read("lib/catalog/place-content.json"),videos=await read("lib/catalog/place-videos.json"),progress=await read("public/data/place-enrichment-progress.json");
const outcomes=[];
for(const entry of decision.entries){
  const p=catalog.find(p=>p.id===entry.placeId);if(!p)throw new Error(`Unknown stable ID: ${entry.placeId}`);
  let candidate=null;try{candidate=await read(`work/place-research/${p.id}.json`);}catch{}
  const freshWiki=entry.useWiki&&candidate?.extract&&!candidate.extract.includes("may refer to:")&&candidate.url;
  if(entry.useWiki&&!freshWiki)throw new Error(`No reviewed article candidate: ${p.id}`);
  const sources=entry.sources||[{name:freshWiki?`Wikipedia — ${candidate.title}`:p.sources.identity.sourceName,url:freshWiki?candidate.url:p.sources.identity.sourceUrl,checkedOn:freshWiki?decision.checkedOn:p.sources.identity.dateChecked,supports:freshWiki?"Reviewed place identity, municipality and the specific descriptive facts in this overview.":"Existing accepted catalog facts retained; no new claim about present-day operation, prices or access."}];
  let photo=content.find(c=>c.placeId===p.id)?.photo||null,photoGap=entry.photoGap||null;
  if(entry.photo==="wiki"){
    try{photo=await downloadApprovedPhoto(p.id,entry.photoAlt||`${p.name} in ${p.city_municipality}`);}catch(error){photoGap=error.message;}
  }else if(entry.photoFile){
    const file=await(await get(`https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url%7Cextmetadata%7Csize&titles=${encodeURIComponent("File:"+entry.photoFile)}`)).json();
    const metadata=Object.values(file.query.pages)[0]?.imageinfo?.[0];
    if(metadata){await writeFile(`work/place-research/${p.id}.json`,JSON.stringify({...candidate,placeId:p.id,photo:metadata},null,2));try{photo=await downloadApprovedPhoto(p.id,entry.photoAlt||`${p.name} in ${p.city_municipality}`);}catch(error){photoGap=error.message;}}
  }
  if(photo||progress.initialInventory?.photoPlaceIds?.includes(p.id))photoGap=null;
  const row={placeId:p.id,summary:entry.summary,overview:entry.overview,highlights:(entry.highlights||[]).map(text=>({text,sourceUrls:[sources[0].url]})),tips:(entry.tips||[]).map(text=>({text,sourceUrls:[sources[0].url]})),sources,...(photo?{photo}:{})};
  const previous=content.findIndex(c=>c.placeId===p.id);if(previous>=0)content[previous]=row;else content.push(row);
  const acceptedVideos=[];const rejectedVideos=[];
  for(const choice of entry.videos||[]){
    try{
      let r;try{r=await read(`work/place-research/${p.id}-video-${choice.id}.json`);}catch{r=await videoCandidate(p.id,choice.id);}
      if(r.playability!=="OK"||r.embeddable!==true||!r.description)throw new Error("Official source does not currently confirm a playable, embeddable video with an accessible description");
      if(r.publishedOn?.slice(0,10)>decision.checkedOn)throw new Error("Future publication date needs review");
      const video={placeId:p.id,platform:"YouTube",videoId:choice.id,url:r.url,title:r.metadata.title,creator:r.metadata.author_name,creatorUrl:r.metadata.author_url,publishedOn:r.publishedOn?.slice(0,10)||null,checkedOn:decision.checkedOn,relevance:choice.relevance,review:"metadata-and-description",limitation:"Official YouTube metadata, description and embed eligibility checked; full footage not reviewed. Recorded conditions and practical information may have changed.",status:"available",...(choice.startSeconds!==undefined?{startSeconds:choice.startSeconds}:{})};
      const old=videos.findIndex(v=>v.placeId===p.id&&v.videoId===choice.id);if(old>=0)videos[old]=video;else videos.push(video);acceptedVideos.push(video.url);
    }catch(error){rejectedVideos.push({videoId:choice.id,reason:error.message});}
  }
  const notes=[...(entry.notes||[]),...(photoGap?[`Photo gap: ${photoGap}`]:[]),...(entry.videoGap?[`Video gap: ${entry.videoGap}`]:[]),...rejectedVideos.map(r=>`Video ${r.videoId}: ${r.reason}`)];
  const record=progress.records.find(r=>r.placeId===p.id);record.reviewedOn=decision.checkedOn;record.notes=notes;record.descriptionStatus=entry.contentStatus||'improved';record.mediaReviewed=true;
  outcomes.push({placeId:p.id,description:entry.contentStatus||"improved",sources,photo:photo?{sourcePage:photo.sourcePage,originalUrl:photo.originalUrl,creator:photo.creator,license:photo.license}:null,photoGap,videos:acceptedVideos,rejectedVideos,notes});
  console.log(JSON.stringify({id:p.id,photo:!!photo,videos:acceptedVideos.length,gaps:notes}));
  // Save each completed record so an interrupted batch can resume idempotently.
  await writeFile("lib/catalog/place-content.json",JSON.stringify(content,null,2)+"\n");
  await writeFile("lib/catalog/place-videos.json",JSON.stringify(videos,null,2)+"\n");
  await writeFile("public/data/place-enrichment-progress.json",JSON.stringify(progress,null,2)+"\n");
}
await mkdir("docs/place-enrichment/completed-batches",{recursive:true});
await writeFile(`docs/place-enrichment/completed-batches/${decision.batchId}.json`,JSON.stringify({batchId:decision.batchId,checkedOn:decision.checkedOn,places:outcomes.length,outcomes},null,2)+"\n");
const pictures=outcomes.map(o=>content.find(c=>c.placeId===o.placeId)?.photo).filter(Boolean);
if(pictures.length){
  const cols=4,cellW=320,cellH=260;
  const layers=await Promise.all(pictures.flatMap((photo,i)=>[
    sharp("public"+photo.src).resize(cellW,220,{fit:"contain",background:"#ffffff"}).toBuffer().then(input=>({input,left:(i%cols)*cellW,top:Math.floor(i/cols)*cellH})),
    Promise.resolve({input:Buffer.from(`<svg width="320" height="40"><rect width="320" height="40" fill="white"/><text x="6" y="24" font-size="12">${photo.placeId.replaceAll("&","&amp;").replaceAll("<","&lt;")}</text></svg>`),left:(i%cols)*cellW,top:Math.floor(i/cols)*cellH+220}),
  ]));
  await sharp({create:{width:cols*cellW,height:Math.ceil(pictures.length/cols)*cellH,channels:3,background:"#ffffff"}}).composite(layers).jpeg().toFile(`work/place-research/${decision.batchId}-photos.jpg`);
}
const ids=decision.entries.map(e=>e.placeId),oldBatch=progress.batches.find(b=>b.id===decision.batchId);
const batch={id:decision.batchId,placeIds:ids,status:"content-saved-awaiting-focused-validation",checkedOn:decision.checkedOn};
if(oldBatch)Object.assign(oldBatch,batch);else progress.batches.push(batch);
await writeFile("public/data/place-enrichment-progress.json",JSON.stringify(progress,null,2)+"\n");
