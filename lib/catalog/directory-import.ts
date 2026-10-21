import {directoryCandidateSchema,type DirectoryCandidate} from "./directory-schema";

export const normalizeDirectoryValue=(value:string)=>value.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/['’]/g,"").replace(/[^a-z0-9]+/g," ").trim();
const noise=new Set(["the","a","and","of","at","in","cafe","restaurant","coffee","shop","resort"]);
const names=(p:DirectoryCandidate)=>[p.name,...(p.aliases||[])].map(normalizeDirectoryValue);
const significant=(s:string)=>s.split(" ").filter(w=>!noise.has(w));
const signature=(s:string)=>significant(s).join(" ");
const sameTown=(a:DirectoryCandidate,b:DirectoryCandidate)=>normalizeDirectoryValue(a.city_municipality||"")===normalizeDirectoryValue(b.city_municipality||"");
function verifiedDistinctAddresses(a:DirectoryCandidate,b:DirectoryCandidate) {
  return a.sources.address.status==="verified"&&b.sources.address.status==="verified"&&!!a.address&&!!b.address&&normalizeDirectoryValue(a.address)!==normalizeDirectoryValue(b.address);
}
const similarity=(a:string,b:string)=>{
  const x=new Set(significant(a)),y=new Set(significant(b));
  const union=new Set([...x,...y]);return union.size?[...x].filter(w=>y.has(w)).length/union.size:0;
};
export function directoryDistanceMeters(a:DirectoryCandidate,b:DirectoryCandidate) {
  if(a.latitude===null||a.longitude===null||b.latitude===null||b.longitude===null||a.sources.coordinates.status!=="verified"||b.sources.coordinates.status!=="verified")return null;
  const rad=(n:number)=>n*Math.PI/180;
  const x=Math.sin(rad(b.latitude-a.latitude)/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(rad(b.longitude-a.longitude)/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));
}
export function duplicateReason(a:DirectoryCandidate,b:DirectoryCandidate) {
  if(a.id===b.id)return "same stable ID";
  if(a.catalog_stop_id&&a.catalog_stop_id===b.catalog_stop_id)return "same itinerary place identity";
  const overlap=names(a).some(x=>names(b).some(y=>x===y||!!signature(x)&&signature(x)===signature(y)));
  if(overlap){
    if(verifiedDistinctAddresses(a,b))return null;
    if(!sameTown(a,b)&&a.category!=="Food & drink"&&b.category!=="Food & drink")return null;
    return "normalized name or alias matches; separate business branches need distinct verified addresses";
  }
  if(!sameTown(a,b))return null;
  const close=directoryDistanceMeters(a,b);
  const sharedAddress=a.address&&b.address&&a.sources.address.status==="verified"&&b.sources.address.status==="verified"&&normalizeDirectoryValue(a.address)===normalizeDirectoryValue(b.address);
  if((sharedAddress||(close!==null&&close<=75))&&names(a).some(x=>names(b).some(y=>similarity(x,y)>=0.5)))return "similar names at the same verified address or within 75 metres";
  return null;
}
export function stableDirectoryJson(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(stableDirectoryJson).join(",")}]`;
  if(value&&typeof value==="object")return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stableDirectoryJson((value as Record<string,unknown>)[k])}`).join(",")}}`;
  return JSON.stringify(value);
}
/** Pure upsert; callers write only after the entire batch passes. */
export function importDirectoryBatch(existing:DirectoryCandidate[],input:unknown,options:{protectedIds?:Set<string>;knownCatalogIds?:Set<string>}={}) {
  if(!Array.isArray(input))throw new Error("Import a JSON array of place records.");
  const rows=input.map(raw=>{
    const parsed=directoryCandidateSchema.parse(raw);
    if(parsed.planning){
      parsed.slug=parsed.slug||parsed.id;
      if(parsed.planning.base_slug)parsed.catalog_stop_id=parsed.catalog_stop_id||parsed.id;
      else if(options.knownCatalogIds&&parsed.catalog_stop_id&&!options.knownCatalogIds.has(parsed.catalog_stop_id))parsed.catalog_stop_id=null;
    }
    return parsed;
  });
  const merged=new Map(existing.map(p=>[p.id,p]));
  const seen=new Set<string>();let inserted=0,promoted=0,unchanged=0,updated=0;
  for(const p of rows){
    if(seen.has(p.id))throw new Error(`Duplicate ID inside incoming batch: ${p.id}`);seen.add(p.id);
    if(p.status!=="accepted")throw new Error(`${p.id}: only verified accepted additions can be published by this import.`);
    if(p.latitude!==null&&p.sources.coordinates.status!=="verified")throw new Error(`${p.id}: new coordinate pins need independent verified evidence; otherwise use null.`);
    const old=merged.get(p.id);
    if(old&&stableDirectoryJson(old)===stableDirectoryJson(p)){unchanged++;continue;}
    if(old?.status==="accepted"&&(!options.protectedIds||options.protectedIds.has(old.id)))throw new Error(`${p.id}: an existing accepted record differs; preserve it and use its current stable identity.`);
    if(old&&!names(p).some(n=>names(old).includes(n)))throw new Error(`${p.id}: existing candidate identity differs; include the researched prior name as an alias or correct the ID.`);
    for(const other of merged.values()){
      if(other.id===p.id)continue;
      const reason=duplicateReason(p,other);
      if(reason)throw new Error(`${p.id} duplicates ${other.id}: ${reason}. Reuse the existing candidate ID for a promotion.`);
    }
    merged.set(p.id,p);if(old?.status==="accepted")updated++;else if(old)promoted++;else inserted++;
  }
  return {records:[...merged.values()],incoming:rows,inserted,promoted,unchanged,updated};
}

/** The committed batch has already passed import validation. No browser writes. */
export function mergeCommittedDirectory(existing:DirectoryCandidate[],approved:DirectoryCandidate[]) {
  const records=new Map(existing.map(p=>[p.id,p]));for(const p of approved)records.set(p.id,p);return [...records.values()];
}
