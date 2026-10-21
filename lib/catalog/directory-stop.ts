import type {DirectoryCandidate} from "./directory-schema";
import type {Stop} from "./types";
import {directoryDetails} from "./directory-details";
import {geographyOf} from "./directory";

/** Directory identity does not verify transport, visit length, prices or access. */
export function stopFromDirectory(p:DirectoryCandidate,previous?:Stop):Stop|null {
  const plan=p.planning;
  if(!plan?.base_slug||plan.mode==="separate-base"||p.status!=="accepted")return null;
  const notes=directoryDetails(p)!;
  const sources=notes.sources;
  const category=p.category==="Food & drink"?"Food":p.category==="Nature"||p.category==="Parks & markets"?"Nature":p.interests.includes("Adventure Junkie")?"Adventure":"Culture";
  const entryPrice=notes.entryPrice;
  const outdoor=plan.outdoor??(p.category==="Nature");
  return {
    id:p.catalog_stop_id||p.id,baseSlug:plan.base_slug,canonicalId:previous?.canonicalId||p.catalog_stop_id||p.id,
    name:p.name,aliases:[...new Set([...(previous?.aliases||[]),...(p.aliases||[]),...(previous&&previous.name!==p.name?[previous.name]:[])])],
    description:p.description,interests:[...p.interests],geography:geographyOf(p),lat:p.latitude,lng:p.longitude,
    category,cost:notes.cost,costBasis:notes.costBasis,entryPrice:structuredClone(entryPrice),
    minutes:plan.minutes,outdoor,cluster:plan.cluster,mode:plan.mode,scheduling:plan.scheduling,
    transferMinutes:plan.transferMinutes??(plan.mode==="local"?45:120),requiresBooking:plan.requiresBooking,booking:plan.booking,
    includes:[...(previous?.includes||[])],componentOf:[...(previous?.componentOf||[])],distinct:true,
    locationDetails:p.city_municipality||"Check with the venue for the location.",accessibility:plan.accessibility,transport:plan.transport,
    sources,advisories:structuredClone(previous?.advisories||[]),
    disruptionSensitivities:plan.disruptionSensitivities?[...plan.disruptionSensitivities]:outdoor?["heavy-rain"]:[],
    ...(plan.openingHours?{openingHours:structuredClone(plan.openingHours)}:{}),
  };
}
