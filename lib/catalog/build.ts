import {defaultFactSources, estimatedSource, unverifiedSource, type FactSources} from "../sources";
import type {LegacyStop, ResearchedSpot, Stop} from "./types";
import {seedStopId} from "./identity";

export const legacyPlaceholderNames=new Set([
  "Local market & lunch","Coron town lunch","Puerto Princesa city lunch","Cebu heritage food break",
  "Panglao local lunch","Session Road cafe break","Basco local lunch","Basco town walk","Basco heritage streets",
  "Molo neighborhood food stop","Davao local food break","Sagada village walk","Sagada coffee & local lunch",
  "Village craft browsing","Intramuros lunch break",
]);
export function enrichLegacyStop(baseSlug:string,seed:LegacyStop):Stop {
  const id=seedStopId(baseSlug,seed.name);
  const mode=seed.cluster==="boat"?"excursion":"local";
  return {
    ...seed,id,baseSlug,canonicalId:baseSlug==="boracay"&&seed.name.startsWith("White Beach")?"boracay-white-beach":id,
    aliases:[],description:seed.locationDetails,interests:interestsForCategory(seed.category),
    costBasis:"person",entryPrice:{amount:null,basis:"unknown",source:unverifiedSource()},
    mode,scheduling:"candidate",transferMinutes:mode==="excursion"?120:45,requiresBooking:mode==="excursion",
    booking:mode==="excursion"?"Confirm operator, permit, and booking before relying on this outing.":"Reservation and current access requirements are unknown; confirm with the venue.",
    includes:[],componentOf:[],distinct:!legacyPlaceholderNames.has(seed.name),
  };
}
export function interestsForCategory(category:string) {
  const map:Record<string,string[]>={
    Nature:["Nature Lover","Slow Traveler"],Culture:["Culture Seeker","City Wanderer"],
    Beaches:["Beach Bum","Nature Lover"],Adventure:["Adventure Junkie","Nature Lover"],Food:["Food Hunter"],
  };
  return map[category]||[];
}
export function researchedStop(raw:ResearchedSpot):Stop {
  const sources=defaultFactSources();
  for(const item of raw.evidence) for(const field of item.fields) {
    if (field in sources) sources[field as keyof FactSources]={sourceName:item.sourceName,sourceUrl:item.sourceUrl,dateChecked:item.dateChecked,status:item.status};
  }
  const entrySource=raw.cost===null?unverifiedSource():{...sources.price};
  // The budget allowance is distinct from the entry fee and is always an estimate.
  const allowance=raw.cost??(raw.mode==="local"?(raw.category==="Food"?300:150):1800);
  sources.price=estimatedSource();
  return {
    id:raw.id,baseSlug:raw.baseSlug,canonicalId:raw.id,name:raw.name,aliases:raw.aliases||[],
    description:raw.description,interests:raw.interests,lat:raw.lat,lng:raw.lng,category:raw.category,
    cost:Math.round(allowance),costBasis:raw.costBasis==="group"?"group":"person",
    entryPrice:{amount:raw.cost,basis:raw.cost===null?"unknown":raw.costBasis,source:entrySource},
    minutes:raw.minutes,outdoor:raw.outdoor,cluster:raw.cluster,mode:raw.mode,scheduling:"candidate",
    transferMinutes:raw.mode==="local"?45:120,requiresBooking:!!raw.requiresBooking,booking:raw.booking,
    includes:raw.includes||[],componentOf:raw.componentOf||[],distinct:raw.mode!=="package",
    locationDetails:raw.locationDetails,accessibility:raw.accessibility||"Accessibility is unknown. Confirm step-free access and individual needs with the venue or operator.",
    transport:raw.transport,sources,advisories:[],
    disruptionSensitivities:raw.outdoor?["heavy-rain",...(raw.cluster==="boat"?["marine-conditions" as const]:[])]:[],
    ...(raw.openingHours?{openingHours:raw.openingHours}:{}),
  };
}
