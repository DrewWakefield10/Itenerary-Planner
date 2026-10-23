import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {today,cached,commonsSearch,flickrSearch} from './photo-pass-tools.mjs';
const root='docs/place-enrichment/photo-only';await mkdir(root,{recursive:true});
const read=async p=>JSON.parse(await readFile(p,'utf8')),save=(p,v)=>writeFile(p,JSON.stringify(v,null,2)+'\n');
const p=await read('public/data/place-enrichment-progress.json'),content=await read('lib/catalog/place-content.json'),catalog=await read('public/data/lakbay-locations.json');
const hash=v=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
if(process.argv[2]==='init'){
 try{await read(`${root}/checklist.json`);throw Error('Checklist already exists; resume saved batches instead of resetting it.');}catch(e){if(e.code!=='ENOENT')throw e;}
 const groups=['Siargao','Boracay','Baguio','Davao','Bohol','Batanes','Palawan','Iloilo','Manila','Cebu','Sagada'];
 const gaps=p.records.filter(r=>r.image==='gap').sort((a,b)=>groups.indexOf(a.destination)-groups.indexOf(b.destination));
 const previous=[];for(const file of await readdir('docs/place-enrichment/research-batches'))if(file.endsWith('.json'))previous.push(...(await read('docs/place-enrichment/research-batches/'+file)).records);
 const records=gaps.map((r,i)=>{const c=catalog.find(c=>c.id===r.placeId),old=previous.find(o=>o.placeId===r.placeId);return {placeId:r.placeId,name:r.name,destination:r.destination,municipality:r.municipality,aliases:c.aliases||[],batch:`photo-${String(Math.floor(i/25)+1).padStart(3,'0')}`,status:'pending',previousNotes:r.notes,previousCandidates:[...(old?.commonsCandidates?.map?.(c=>c.url)||[]),...(old?.imageCandidate?[old.imageCandidate.sourcePage]:[])],identitySource:c.sources.identity.sourceUrl};});
 await save(`${root}/checklist.json`,{startedOn:today(),startingGaps:records.length,startingPhotoCoverage:catalog.length-records.length,catalogSize:catalog.length,records});
 const directoryHashes={};for(const n of (await readdir('lib/catalog')).filter(n=>/^directory-.*\.json$/.test(n)))directoryHashes[n]=hash(await readFile('lib/catalog/'+n,'utf8'));
 await save(`${root}/baseline.json`,{catalogSize:catalog.length,videosHash:hash(await readFile('lib/catalog/place-videos.json','utf8')),nonPhotoContentHash:hash(content.map(c=>Object.fromEntries(Object.entries(c).filter(([key])=>key!=='photo')))),photos:Object.fromEntries(content.filter(c=>c.photo).map(c=>[c.placeId,c.photo])),directoryHashes});
 console.log(`Saved ${records.length} gaps in ${new Set(records.map(r=>r.batch)).size} batches.`);
}else{
 const batchId=process.argv[2];if(!/^photo-\d{3}$/.test(batchId||''))throw Error('Use init or photo-NNN');
 const list=await read(`${root}/checklist.json`),records=list.records.filter(r=>r.batch===batchId),report={batchId,checkedOn:today(),status:'unapproved-research',records:[]};
 try{const old=await read(`${root}/${batchId}-research.json`);report.records=old.records;}catch{}
 const simplify=name=>name.split(/\s+[—–-]\s+/)[0].replace(/[’']/g,'').replace(/\s*\([^)]*\)/g,'').trim();
 for(const row of records){
  if(report.records.some(r=>r.placeId===row.placeId))continue;
  const name=simplify(row.name),group=row.destination==='Manila'?'Philippines':row.destination;
  const queries=[name,`${name.split(/\s+/).filter(w=>!['The','Restaurant','Beach','Park','and','&'].includes(w)).slice(0,3).join(' ')} ${group}`];
  const searches=[],candidates=[];
  for(const query of [...new Set(queries)])try{const result=await commonsSearch(query);searches.push({provider:'Commons',query,url:result.url,count:result.candidates.length});candidates.push(...result.candidates);}catch(e){searches.push({provider:'Commons',query,error:e.message});}
  try{const query=`${name} ${group}`,result=await flickrSearch(query);searches.push({provider:'Flickr',query,url:result.url,count:result.candidates.length});candidates.push(...result.candidates);}catch(e){searches.push({provider:'Flickr',error:e.message});}
  let wikidata;
  try{const url='https://www.wikidata.org/w/api.php?'+new URLSearchParams({action:'wbsearchentities',format:'json',language:'en',search:name,limit:'3'});const d=await cached(url);wikidata={url,candidates:d.search?.map(e=>({id:e.id,label:e.label,description:e.description,url:e.concepturi}))||[]};}catch(e){wikidata={error:e.message};}
  report.records.push({...row,searches,wikidata,candidates:[...new Map(candidates.filter(c=>c.sourcePage).map(c=>[c.sourcePage,c])).values()]});
  await save(`${root}/${batchId}-research.json`,report);
  console.log(JSON.stringify({id:row.placeId,candidates:report.records.at(-1).candidates.map(c=>({title:c.title,provider:c.provider,license:c.license||c.licenseCode,source:c.sourcePage})),wikidata:wikidata.candidates}));
 }
}
