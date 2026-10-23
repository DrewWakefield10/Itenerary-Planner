import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {optimizeApprovedPhoto,get} from './research-place-content.mjs';
import {today} from './photo-pass-tools.mjs';
export function validatePhotoDecision(entry){
 if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.placeId))throw Error('Invalid place ID');
 if(!entry.approved)return;
 if(entry.visuallyReviewed!==true||entry.licenseReviewed!==true||!entry.identityEvidence?.length)throw Error('Explicit visual, identity and license review is required');
 const p=entry.photo;
 if(!p?.creator?.trim()||!p.alt?.trim()||!p.attribution?.trim())throw Error('Missing attribution or alt text');
 for(const url of [p.sourcePage,p.originalUrl,p.licenseUrl,...entry.identityEvidence])if(new URL(url).protocol!=='https:')throw Error('Only HTTPS public evidence is accepted');
 const match=/^CC BY(-SA)? ([1-4]\.0)$/.exec(p.license);
 const expected=match?`https://creativecommons.org/licenses/by${match[1]?'-sa':''}/${match[2]}`:p.license==='CC0'?'https://creativecommons.org/publicdomain/zero/1.0':p.license==='Public domain'?null:undefined;
 if(expected===undefined||(expected&&p.licenseUrl.replace(/\/deed\.[a-z-]+\/?$/,'').replace(/\/$/,'')!==expected))throw Error('License and individual-image license URL require review');
 if(!['commons.wikimedia.org','www.flickr.com'].includes(new URL(p.sourcePage).hostname))throw Error('New source provider needs an explicit rights workflow');
 if(!['upload.wikimedia.org','thumb.wikimedia.org','live.staticflickr.com'].includes(new URL(entry.downloadUrl||p.originalUrl).hostname))throw Error('Unexpected image delivery host');
}
export async function publishPhotoBatch(decision){
 if(!/^photo-\d{3}$/.test(decision.batchId)||decision.mode!=='photos-only'||decision.entries.length<20||decision.entries.length>25)throw Error('Use a saved batch of 20–25 photo-only decisions');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(decision.checkedOn||'')||Number.isNaN(Date.parse(decision.checkedOn))||new Date(decision.checkedOn).toISOString().slice(0,10)!==decision.checkedOn||decision.checkedOn>today())throw Error('Record the actual valid source-review date');
 decision.entries.forEach(validatePhotoDecision);
 const read=async p=>JSON.parse(await readFile(p,'utf8')),save=(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
 const contentPath='lib/catalog/place-content.json',content=await read(contentPath),checkPath='docs/place-enrichment/photo-only/checklist.json',check=await read(checkPath);
 const progressPath='public/data/place-enrichment-progress.json',progress=await read(progressPath),outcomes=[];
 for(const entry of decision.entries){
  const row=content.find(c=>c.placeId===entry.placeId),record=check.records.find(r=>r.placeId===entry.placeId&&r.batch===decision.batchId);
  if(!row||!record)throw Error('Photo decision must belong to the original missing-photo checklist');
  const result={placeId:entry.placeId,checkedOn:decision.checkedOn,sourcesSearched:entry.sourcesSearched||[],rejections:entry.rejections||[],notes:entry.notes||[]};
  if(entry.approved){
   if(row.photo&&row.photo.sourcePage!==entry.photo.sourcePage)throw Error('Refusing to replace an existing valid photo');
   try{
    if(!row.photo){const data=Buffer.from(await(await get(entry.downloadUrl||entry.photo.originalUrl)).arrayBuffer());row.photo=await optimizeApprovedPhoto(entry.placeId,data,entry.photo);row.photo.checkedOn=decision.checkedOn;await save(contentPath,content);}
    result.status='added';result.photo=row.photo;
   }catch(e){result.status='download-blocked';result.blocker=e.message;}
  }else{result.status='needs-supplied-photo';result.reason=entry.reason||'No exact-place photograph with compatible, individually verified rights was found.';}
  Object.assign(record,result);
  const existing=progress.records.find(r=>r.placeId===entry.placeId);
  existing.photoResearch={batchId:decision.batchId,status:result.status,checkedOn:result.checkedOn,record:`docs/place-enrichment/photo-only/${decision.batchId}-decisions.json`};
  if(result.status==='added')existing.notes=existing.notes.filter(n=>!n.startsWith('Photo gap:'));
  outcomes.push(result);
  await save(checkPath,check);await save(progressPath,progress);
  console.log(`${entry.placeId}: ${result.status}`);
 }
 const report={batchId:decision.batchId,mode:'photos-only',checkedOn:today(),outcomes};
 await mkdir('docs/place-enrichment/completed-batches',{recursive:true});
 await save(`docs/place-enrichment/completed-batches/${decision.batchId}.json`,report);
 await save(`docs/place-enrichment/photo-only/${decision.batchId}-outcomes.json`,report);
}
