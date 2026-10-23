import {readFile,writeFile,mkdir,rename} from "node:fs/promises";
import {directoryCandidates} from "../lib/catalog/directory";
import {importDirectoryBatch,stableDirectoryJson} from "../lib/catalog/directory-import";
import {foodProfileSchema} from "../lib/catalog/food-schema";
import {placeContentSchema} from "../lib/catalog/place-content-schema";
import {z} from "zod/v3";
const read=async(path:string)=>JSON.parse(await readFile(path,"utf8"));
const file=process.argv[2];if(!file)throw new Error("Usage: npx tsx scripts/publish-food-batch.ts docs/food-directory/batches/food-NNN.json");
const batch=await read(file);
if(!/^food-\d{3}$/.test(batch.id)||!Array.isArray(batch.entries)||!batch.entries.length||batch.entries.length>25)throw new Error("Use a reviewed batch of at most 25 entries");
const oldRows=await read("lib/catalog/directory-food.json"),profiles=await read("lib/catalog/food-profiles.json"),contents=await read("lib/catalog/place-content.json");
const rows=[],food=[],editorial=[];
for(const entry of batch.entries){
  if(entry.approved!==true||entry.identityReviewed!==true||entry.operationReviewed!==true||!entry.photoResearch?.sources?.length||!entry.photoResearch?.outcome)throw new Error("Every entry requires explicit identity/operation review and a recorded photo search");
  const row=entry.record,profile=foodProfileSchema.parse(entry.food),content=placeContentSchema.parse(entry.content);
  if(row.id!==profile.placeId||row.id!==content.placeId||row.category!=="Food & drink")throw new Error("Food identity mismatch");
  if(profile.operation.basis==="existing-source"||profile.operation.source.status!=="verified")throw new Error("New venues need current venue offering or dated accreditation evidence");
  if(content.photo)throw new Error("Publish photographs separately through the reviewed photo workflow");
  rows.push(row);food.push(profile);editorial.push(content);
}
const result=importDirectoryBatch(directoryCandidates,rows);
function merge(old:Record<string,unknown>[],incoming:Record<string,unknown>[],key:string){
  const map=new Map(old.map(p=>[p[key],p]));
  for(const original of incoming){const current=map.get(original[key]);
    // Approved photos are a separate enrichment overlay; reimporting an unchanged
    // editorial batch must neither remove them nor report a false content conflict.
    const p=current?.photo&&original.summary?{...original,photo:current.photo}:original;
    if(current&&stableDirectoryJson(current)!==stableDirectoryJson(p))throw new Error(`Existing ${p[key]} differs; review an explicit correction instead of overwriting it`);map.set(p[key],p);}
  return [...map.values()];
}
const outputs={"lib/catalog/directory-food.json":merge(oldRows,result.incoming,"id"),"lib/catalog/food-profiles.json":merge(profiles,food,"placeId"),"lib/catalog/place-content.json":merge(contents,editorial,"placeId")};
// Complete validation before any write. Each file is replaced atomically.
for(const value of Object.values(outputs))z.array(z.record(z.unknown())).parse(value);
for(const [path,value]of Object.entries(outputs)){const temp=path+".tmp";await writeFile(temp,JSON.stringify(value,null,2)+"\n");await rename(temp,path);}
await mkdir("docs/food-directory/completed-batches",{recursive:true});
await writeFile(`docs/food-directory/completed-batches/${batch.id}.json`,JSON.stringify({id:batch.id,checkedOn:batch.checkedOn,accepted:rows.map(p=>p.id),inserted:result.inserted,promoted:result.promoted,unchanged:result.unchanged,decisions:batch.decisions||[]},null,2)+"\n");
console.log(`${batch.id}: ${result.inserted} inserted, ${result.unchanged} unchanged`);
