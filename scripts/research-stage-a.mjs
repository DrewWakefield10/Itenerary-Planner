import {wikiCandidate} from "./research-place-content.mjs";
const places=[
  ["iloilo-jaro-plaza-heritage-area","Jaro Plaza"],
  ["iloilo-plaza-libertad","Plaza Libertad"],
  ["iloilo-molo-church-plaza","Molo Church"],
  ["iloilo-miagao-church","Miagao Church"],
  ["baguio-burnham-park","Burnham Park (Baguio)"],
  ["baguio-botanical-garden","Baguio Botanical Garden"],
  ["cebu-fort-san-pedro","Fort San Pedro"],
  ["cebu-casa-gorordo","Casa Gorordo Museum"],
];
for(const [id,title] of places){
  try{const r=await wikiCandidate(id,title),m=r.photo?.extmetadata;console.log(JSON.stringify({id,title:r.title,extract:r.extract,url:r.url,photo:r.photo?.url,creator:m?.Artist?.value,license:m?.LicenseShortName?.value,licenseUrl:m?.LicenseUrl?.value}));}
  catch(e){console.log(JSON.stringify({id,error:e.message}));}
}
