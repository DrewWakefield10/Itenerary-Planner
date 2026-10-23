// Resumable research only. Individual source/identity/visual decisions are separate.
import {readFile,writeFile} from 'node:fs/promises';
import {commonsSearch,flickrSearch,today} from './photo-pass-tools.mjs';
const root='docs/place-enrichment/cover-completion';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const checklist=await read(root+'/checklist.json');
const batchIds=[...new Set(checklist.records.map(r=>r.batch))];
const overrides={
 'siargao-catangnan-bridge':'Cabitoonan bridge',
 'siargao-tayangban-cave-pool':'Tayangban',
 'siargao-maasin-river':'Maasin Siargao',
 'siargao-pacifico-beach':'Pacifico Siargao',
 'siargao-alegria-beach':'Alegria Siargao',
 'siargao-taktak-falls':'Taktak',
 'siargao-sohoton-cove':'Sohoton',
 'siargao-del-carmen-mangrove-viewdeck':'Del Carmen mangrove',
 'baguio-choco-late-batirol':'chocolate de batirol',
 'baguio-ili-likha':'Ili Likha',
 'baguio-bamboo-sanctuary':'Saint Francis Xavier bamboo',
 'boracay-dtalipapa-market':'Talipapa Boracay',
 'davao-bone-collector-museum':'Bone Collector Davao',
 'el-nido-cudugnon-cave':'Cudognon',
 'sagada-balangagan-cave':'Balangagan',
};
for(const batchId of batchIds){
 const path=`${root}/${batchId}-research.json`;
 let report={batchId,checkedOn:today(),status:'unapproved-research',records:[]};
 try{report=await read(path);}catch(e){if(e.code!=='ENOENT')throw e;}
 const queue=checklist.records.filter(r=>r.batch===batchId&&!report.records.some(old=>old.placeId===r.placeId));
 let writing=Promise.resolve();
 const save=()=>writing=writing.then(()=>writeFile(path,JSON.stringify(report,null,2)+'\n'));
 async function worker(){while(queue.length){
  const row=queue.shift(),name=row.name.split(/\s+[—–-]\s+/)[0].replace(/[’']/g,'').replace(/\s*\([^)]*\)/g,'').trim();
  const short=overrides[row.placeId]||`${name.split(/\s+/).filter(w=>!['The','Restaurant','Cafe','Café','and','&'].includes(w)).slice(0,3).join(' ')} ${row.destination==='Manila'?row.municipality:row.destination}`;
  const searches=[],candidates=[];
  for(const query of [...new Set([`${name} ${row.municipality}`,short])]){
   try{const result=await flickrSearch(query);searches.push({provider:'Flickr',query,url:result.url,count:result.candidates.length,scope:'Includes CC BY 4.0 and CC BY-SA 4.0 omitted by earlier search filters'});candidates.push(...result.candidates);}catch(e){searches.push({provider:'Flickr',query,error:e.message});}
  }
  if(!row.previousQueries.includes(`Commons: ${short}`))try{const result=await commonsSearch(short);searches.push({provider:'Commons',query:short,url:result.url,count:result.candidates.length});candidates.push(...result.candidates);}catch(e){searches.push({provider:'Commons',query:short,error:e.message});}
  const record={placeId:row.placeId,name:row.name,checkedOn:today(),previousReports:row.previousReports,searches,candidates:[...new Map(candidates.map(c=>[c.sourcePage,c])).values()]};
  report.records.push(record);
  await save();console.log(`${row.placeId}: ${record.candidates.length} candidates (not approved)`);
 }}
 await Promise.all([worker(),worker(),worker()]);await writing;
}
