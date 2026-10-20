import type {Stop} from "./types";

const existingIds:Record<string,string> = {
  "Burnham Park":"baguio-burnham-park",
  "Baguio Botanical Garden":"baguio-botanical-garden",
  "Wright Park":"baguio-wright-park",
  "Fort San Pedro":"cebu-fort-san-pedro",
  "Casa Gorordo Museum area":"cebu-casa-gorordo",
  "Plaza Cuartel":"puerto-princesa-plaza-cuartel",
  "Big Lagoon — optional guided outing":"el-nido-big-lagoon",
  "Lualhati Park waterfront":"coron-lualhati-park",
  "Mount Tapyas viewpoint — optional climb":"coron-mount-tapyas",
  "Cloud 9 boardwalk area":"siargao-cloud-9",
};
export const normalizePlaceName=(name:string)=>name.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
export function seedStopId(baseSlug:string,name:string) {
  if (baseSlug!=="palawan" && existingIds[name]) return existingIds[name];
  return `${baseSlug}-${normalizePlaceName(name)}`;
}
export function stopConflictKeys(stop:Pick<Stop,"id"|"canonicalId"|"includes">, catalog:Stop[]) {
  return new Set([stop.canonicalId||stop.id,...stop.includes.map(id=>catalog.find(s=>s.id===id)?.canonicalId||id)]);
}
export function stopMatchesName(stop:Stop,value:string) {
  const key=normalizePlaceName(value);
  return [stop.name,...stop.aliases].some(n=>normalizePlaceName(n)===key);
}
