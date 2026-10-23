import {readFile,writeFile,readdir} from "node:fs/promises";
import {directoryListings,destinationGroups} from "../lib/catalog/directory";
import {foodProfiles} from "../lib/catalog/food";
import {discoveryPlace} from "../lib/discovery";
import {placeContent,videosForPlace} from "../lib/catalog/place-content";
import type {DirectoryCandidate} from "../lib/catalog/directory-schema";
type Batch={id:string;entries:{record:DirectoryCandidate}[];decisions:unknown[]};
const read=async(p:string)=>JSON.parse(await readFile(p,"utf8"));
const baseline=await read("docs/food-directory/baseline.json");
const rows=foodProfiles.map(food=>({place:directoryListings.find(p=>p.id===food.placeId)!,food}));
if(rows.some(p=>!p.place)||new Set(rows.map(p=>p.place.id)).size!==rows.length)throw new Error("Invalid food identities");
const batches:Batch[]=await Promise.all((await readdir("docs/food-directory/batches")).filter(n=>n.endsWith('.json')).sort().map(n=>read(`docs/food-directory/batches/${n}`)));
const targets=[25,20,20,12,12,12,12,12,12,7,6];
const breakdown=destinationGroups.map((group,i)=>{const list=rows.filter(p=>p.place.destination_group===group);return{destination:group,target:targets[i],total:list.length,cafes:list.filter(p=>p.food.primary==='cafe').length,other_food:list.filter(p=>p.food.primary==='other-food').length,photos:list.filter(p=>discoveryPlace(p.place.id)?.image).length,videos:list.filter(p=>videosForPlace(p.place.id).length).length,descriptions:list.filter(p=>placeContent(p.place.id)).length,added:list.filter(p=>!baseline.foodIds.includes(p.place.id)).length};});
const progress={generatedOn:new Date().toISOString().slice(0,10),starting_count:baseline.foodIds.length,starting_category_count:59,excluded:baseline.excluded,target:150,added:rows.length-baseline.foodIds.length,final_count:rows.length,cafes:rows.filter(p=>p.food.primary==='cafe').length,other_food:rows.filter(p=>p.food.primary==='other-food').length,shortfall:Math.max(0,150-rows.length),by_destination:breakdown,batches:batches.map(b=>({id:b.id,accepted:b.entries.length,decisions:b.decisions||[],descriptions:b.entries.length,photos:b.entries.filter(e=>discoveryPlace(e.record.id)?.image).length,videos:b.entries.filter(e=>videosForPlace(e.record.id).length).length})),operation_review:{existing_source:rows.filter(p=>p.food.operation.basis==='existing-source').length,venue_offering:rows.filter(p=>p.food.operation.basis==='venue-offering').length,accredited_2026:rows.filter(p=>p.food.operation.basis==='2026-accreditation').length},limitations:["Current public offering and dated accreditation are evidence, not real-time opening guarantees.","Existing profiles retain their original source/check dates unless explicitly re-reviewed.","Unknown coordinates, hours, prices and accessibility remain unknown. Meal allowances and visit/transfer durations are estimates."]};
await writeFile('public/data/food-directory-progress.json',JSON.stringify(progress,null,2)+'\n');
const detailed={...progress,
 operation_review:Object.fromEntries(['existing-source','venue-offering','2026-accreditation','current-guide','recent-report'].map(basis=>[basis,rows.filter(p=>p.food.operation.basis===basis).length])),
 media:{new_photos:rows.filter(p=>!baseline.foodIds.includes(p.place.id)&&discoveryPlace(p.place.id)?.image).length,new_photo_gaps:rows.filter(p=>!baseline.foodIds.includes(p.place.id)&&!discoveryPlace(p.place.id)?.image).length,new_videos:rows.filter(p=>!baseline.foodIds.includes(p.place.id)).reduce((n,p)=>n+videosForPlace(p.place.id).length,0)},
 manual_review:rows.filter(p=>p.food.scheduling==='manual'||p.place.planning?.scheduling==='manual').map(p=>({placeId:p.place.id,reason:p.food.operation.limitation})),
 decisions:batches.flatMap(b=>b.decisions||[]),
};
await writeFile('public/data/food-directory-progress.json',JSON.stringify(detailed,null,2)+'\n');
const exports:Record<string,unknown>[]=await read('public/data/lakbay-locations.json');const ids=new Set(rows.map(p=>p.place.id));const foods=exports.filter(p=>ids.has(p.id as string));
if(foods.length!==rows.length)throw new Error("Regenerate directory exports before food progress");
await writeFile('public/data/lakbay-food.json',JSON.stringify(foods,null,2)+'\n');
const columns=Object.keys(foods[0]||{});const cell=(v:unknown)=>'"'+(v==null?'':typeof v==='object'?JSON.stringify(v):String(v)).replaceAll('"','""')+'"';
await writeFile('public/data/lakbay-food.csv','\uFEFF'+[columns.join(','),...foods.map(p=>columns.map(k=>cell(p[k])).join(','))].join('\r\n')+'\r\n');
console.table(breakdown);console.log(`${progress.starting_count} starting + ${progress.added} = ${rows.length}; ${progress.cafes} cafés / ${progress.other_food} other food; shortfall ${progress.shortfall}`);
