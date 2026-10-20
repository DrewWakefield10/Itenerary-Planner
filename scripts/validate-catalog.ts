import {destinations,selectableDestinations} from "../lib/destinations";
import {validateCatalog} from "../lib/catalog/validate";
const errors=validateCatalog(destinations);
if(errors.length){console.error(errors.join("\n"));process.exitCode=1;}
else console.log("Catalog structure valid. This does not establish factual verification or current availability.");
console.table(selectableDestinations.map(d=>({base:d.name,records:d.stops.length,
  distinctPlaces:new Set(d.stops.filter(s=>s.distinct&&s.mode!=="package"&&s.mode!=="separate-base").map(s=>s.canonicalId)).size,
  packages:d.stops.filter(s=>s.mode==="package").length,
  unknownPins:d.stops.filter(s=>s.lat===null).length,unknownEntryPrices:d.stops.filter(s=>s.entryPrice.amount===null).length})));
