// Fetch official public metadata for explicit editorial choices, before publication.
import {readFile,writeFile} from 'node:fs/promises';
import {videoCandidate} from './research-place-content.mjs';
const decision=JSON.parse(await readFile(process.argv[2],'utf8')),choices=decision.entries.flatMap(e=>(e.videos||[]).map(v=>({placeId:e.placeId,...v}))),results=[];
let cursor=0;
await Promise.all(Array.from({length:3},async()=>{while(cursor<choices.length){const choice=choices[cursor++];try{let data;try{data=JSON.parse(await readFile(`work/place-research/${choice.placeId}-video-${choice.id}.json`,'utf8'));}catch{data=await videoCandidate(choice.placeId,choice.id);}const r={placeId:choice.placeId,videoId:choice.id,title:data.metadata.title,creator:data.metadata.author_name,published:data.publishedOn,playability:data.playability,embeddable:data.embeddable,description:data.description};results.push(r);console.log(JSON.stringify({...r,description:r.description?.slice(0,220)}));}catch(error){results.push({...choice,error:error.message});console.log(JSON.stringify({...choice,error:error.message}));}}}));
await writeFile(`work/place-research/${decision.batchId}-video-review.json`,JSON.stringify(results,null,2));
