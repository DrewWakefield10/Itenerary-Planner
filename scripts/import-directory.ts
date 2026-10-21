import {readFile,writeFile,rename} from "node:fs/promises";
import {resolve} from "node:path";
import approved from "../lib/catalog/directory-expansion.json";
import {originalDirectoryCandidates} from "../lib/catalog/directory";
import {importDirectoryBatch,mergeCommittedDirectory,stableDirectoryJson} from "../lib/catalog/directory-import";
import type {DirectoryCandidate} from "../lib/catalog/directory-schema";
import baseline from "../lib/catalog/expansion-baseline.json";
import {selectableDestinations} from "../lib/destinations";

const args=process.argv.slice(2);
if(args.length&&!(args.length===2&&args[0]==="--input"))throw new Error("Usage: npm run import:directory [-- --input candidate-batch.json]");
const files=args.length?[resolve(args[1])]:["islands","visayas","luzon"].map(group=>resolve(`lib/catalog/expansion-${group}.json`));
const batch:unknown[]=[];
for(const file of files){
  try{const value=JSON.parse(await readFile(file,"utf8"));if(!Array.isArray(value))throw new Error(`${file}: expected a JSON array`);batch.push(...value);}
  catch(error){if(!args.length&&(error as NodeJS.ErrnoException).code==="ENOENT")continue;throw error;}
}
if(!batch.length)throw new Error("No researched expansion records were found; no files changed.");
const current=mergeCommittedDirectory(originalDirectoryCandidates,approved as DirectoryCandidate[]);
const options={protectedIds:new Set(baseline.records.map(p=>p.id)),knownCatalogIds:new Set(selectableDestinations.flatMap(d=>d.stops.map(s=>s.id)))};
const result=importDirectoryBatch(current,batch,options);
const next=new Map((approved as DirectoryCandidate[]).map(p=>[p.id,p]));
for(const p of result.incoming)next.set(p.id,p);
// Validate the complete approved batch too, preventing collisions across files.
importDirectoryBatch(originalDirectoryCandidates,[...next.values()],options);
const output=resolve("lib/catalog/directory-expansion.json");
const data=JSON.stringify([...next.values()],null,2)+"\n";
if(stableDirectoryJson(approved)!==stableDirectoryJson([...next.values()])){
  const temporary=output+".tmp";await writeFile(temporary,data,"utf8");await rename(temporary,output);
}
console.log(JSON.stringify({imported:result.inserted,promoted:result.promoted,updated:result.updated,unchanged:result.unchanged,approvedAdditions:next.size,publishedTotal:result.records.filter(p=>p.status==="accepted").length},null,2));
