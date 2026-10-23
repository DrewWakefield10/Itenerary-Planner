// Research only. Publication still requires an individual license, identity and
// visual decision through the existing reviewed photograph pipeline.
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {commonsSearch,flickrSearch,today} from './photo-pass-tools.mjs';
const read=async p=>JSON.parse(await readFile(p,'utf8'));
const rows=await read('lib/catalog/directory-food.json');
const root='docs/food-directory/media';await mkdir(root,{recursive:true});
const path=root+'/research.json';let report={checkedOn:today(),mode:'unapproved-research',records:[]};
try{report=await read(path);}catch(e){if(e.code!=='ENOENT')throw e;}
const queue=rows.filter(p=>!report.records.some(r=>r.placeId===p.id));
let saving=Promise.resolve();
function checkpoint(){saving=saving.then(async()=>{await writeFile(path+'.tmp',JSON.stringify(report,null,2)+'\n');await rename(path+'.tmp',path);});return saving;}
async function worker(){while(queue.length){const p=queue.shift(),name=p.name.split(/\s+—\s+/)[0],searches=[],candidates=[];
 for(const [provider,search,query]of [['Commons',commonsSearch,`${name} ${p.city_municipality}`],['Commons',commonsSearch,name],['Flickr',flickrSearch,`${name} ${p.city_municipality}`]]){
  try{const result=await search(query);searches.push({provider,query,url:result.url,count:result.candidates.length});candidates.push(...result.candidates);}catch(e){searches.push({provider,query,error:e.message});}
 }
 const record={placeId:p.id,name:p.name,destination:p.destination_group,municipality:p.city_municipality,checkedOn:today(),searches,candidates:[...new Map(candidates.map(c=>[c.sourcePage,c])).values()],status:'awaiting-review'};
 report.records.push(record);await checkpoint();console.log(`${p.id}: ${record.candidates.length} unreviewed candidates`);
}}
// Fetch concurrently, serialize atomic checkpoints; no acceptance inferred.
await Promise.all([worker(),worker(),worker()]);
await checkpoint();
