import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {validatePhotoDecision} from './publish-place-photo-batch.mjs';
import {optimizeApprovedPhoto,get} from './research-place-content.mjs';
import {today} from './photo-pass-tools.mjs';
export async function publishFoodPhotos(file){
 const read=async p=>JSON.parse(await readFile(p,'utf8'));
 const decision=await read(file),rows=await read('lib/catalog/directory-food.json'),content=await read('lib/catalog/place-content.json');
 if(decision.mode!=='food-photos'||!/^\d{4}-\d{2}-\d{2}$/.test(decision.checkedOn)||Number.isNaN(Date.parse(decision.checkedOn))||new Date(decision.checkedOn).toISOString().slice(0,10)!==decision.checkedOn||decision.checkedOn>today())throw Error('A dated, reviewed food-photo decision is required');
 const ids=new Set(rows.map(p=>p.id));
 if(decision.entries.length!==ids.size||new Set(decision.entries.map(e=>e.placeId)).size!==ids.size)throw Error('Decisions must cover each new food identity exactly once');
 for(const entry of decision.entries){if(!ids.has(entry.placeId))throw Error('Outside reviewed food expansion');validatePhotoDecision(entry);if(!entry.sourcesSearched?.length||(!entry.approved&&!entry.reason))throw Error('Record source searches and gap reasons');}
 const outcomes=[];
 for(const e of decision.entries){const row=content.find(p=>p.placeId===e.placeId);if(!row)throw Error('Missing approved content');
  if(e.approved){
   if(row.photo&&row.photo.sourcePage!==e.photo.sourcePage)throw Error('Refusing to replace an existing photograph');
   if(!row.photo){const bytes=Buffer.from(await(await get(e.downloadUrl||e.photo.originalUrl)).arrayBuffer());row.photo=await optimizeApprovedPhoto(e.placeId,bytes,e.photo);row.photo.checkedOn=decision.checkedOn;}
  }
  outcomes.push({placeId:e.placeId,status:e.approved?'added':'needs-supplied-photo',reason:e.reason||null});
 }
 await writeFile('lib/catalog/place-content.json',JSON.stringify(content,null,2)+'\n');
 await mkdir('docs/food-directory/media',{recursive:true});await writeFile('docs/food-directory/media/outcomes.json',JSON.stringify({checkedOn:decision.checkedOn,outcomes},null,2)+'\n');
 console.log(`${outcomes.filter(r=>r.status==='added').length} approved photos; ${outcomes.filter(r=>r.status!=='added').length} documented gaps`);
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/publish-food-photos.mjs'))await publishFoodPhotos(process.argv[2]);
