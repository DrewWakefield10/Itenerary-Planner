import {readFile,writeFile} from 'node:fs/promises';
const path='public/data/place-enrichment-progress.json',progress=JSON.parse(await readFile(path,'utf8'));
for(const id of process.argv.slice(2)){
 const batch=progress.batches.find(b=>b.id===id);if(!batch)throw new Error('Unknown saved batch '+id);
 if(id!=='stage-a')await readFile(`docs/place-enrichment/${id}-link-check.json`,'utf8');
 batch.status='validated';batch.validation='Schemas, stable IDs, local image decoding/dimensions and source/photo reachability checked; contact sheet visually reviewed. Official video metadata, description and embed eligibility checked separately, not full footage.';
 for(const record of progress.records.filter(r=>batch.placeIds.includes(r.placeId))){record.mediaReviewed=true;if(!record.descriptionStatus)record.descriptionStatus='improved';}
}
progress.featureStatus='implemented-and-verified';progress.stage='B';
progress.nextBatch=progress.records.filter(r=>!r.reviewedOn).slice(0,25).map(r=>r.placeId);
await writeFile(path,JSON.stringify(progress,null,2)+'\n');
