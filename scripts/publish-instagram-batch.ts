import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {z} from 'zod/v3';
import {instagramRecordSchema,validateInstagramRecords} from '../lib/catalog/instagram-schema';

const decisionSchema=z.object({
 mode:z.literal('instagram-only'),batchId:z.string().regex(/^instagram-[a-z0-9-]+$/),
 checkedOn:instagramRecordSchema.innerType().shape.checkedOn,
 entries:z.array(z.object({placeId:z.string(),decision:z.literal('approved'),identityReviewed:z.literal(true),correctionReason:z.string().min(15).optional(),posts:z.array(instagramRecordSchema).min(1).max(3)}).strict()).min(1).max(20),
}).strict();
export async function publishInstagramBatch(input:unknown){
 const decision=decisionSchema.parse(input);
 const read=async(path:string)=>JSON.parse(await readFile(path,'utf8'));
 const catalog=await read('public/data/lakbay-locations.json') as {id:string}[];
 const existing=validateInstagramRecords(await read('lib/catalog/place-instagram.json'),new Set(catalog.map(p=>p.id)));
 const result=[...existing],seen=new Set<string>();
 for(const entry of decision.entries){
  if(seen.has(entry.placeId))throw Error(`Duplicate batch place: ${entry.placeId}`);
  seen.add(entry.placeId);
  for(const post of entry.posts){
   if(post.placeId!==entry.placeId||post.checkedOn!==decision.checkedOn)throw Error('Post identity and actual check date must match its decision');
   const old=result.find(r=>r.placeId===post.placeId&&r.url===post.url);
   if(old&&JSON.stringify(old)!==JSON.stringify(post)){
    if(!entry.correctionReason)throw Error('Existing reviewed post differs; an explicit correction reason is required');
    result[result.indexOf(old)]=post;
   }
   if(!old)result.push(post);
  }
 }
 validateInstagramRecords(result,new Set(catalog.map(p=>p.id)));
 // All decisions validate before writing. Do not touch descriptions, videos,
 // licensed photographs, catalog IDs, accounts or itinerary snapshots.
 const path='lib/catalog/place-instagram.json';
 await writeFile(path+'.tmp',JSON.stringify(result,null,2)+'\n');await rename(path+'.tmp',path);
 await mkdir('docs/place-enrichment/instagram/completed-batches',{recursive:true});
 await writeFile(`docs/place-enrichment/instagram/completed-batches/${decision.batchId}.json`,JSON.stringify({batchId:decision.batchId,checkedOn:decision.checkedOn,places:decision.entries.length,posts:decision.entries.flatMap(e=>e.posts).length,outcomes:decision.entries.map(e=>({placeId:e.placeId,posts:e.posts.map(p=>({url:p.url,presentation:p.presentation,embedCheck:p.embedCheck}))}))},null,2)+'\n');
 console.log(`Published ${decision.entries.length} reviewed Instagram locations; ${result.length} total resources.`);
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/publish-instagram-batch.ts'))await publishInstagramBatch(JSON.parse(await readFile(process.argv[2],'utf8')));
