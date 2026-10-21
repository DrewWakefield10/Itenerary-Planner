import luzon from "./research-luzon.json";
import islands from "./research-islands.json";
import visayas from "./research-visayas.json";
import {researchedStop} from "./build";
import type {ResearchedSpot, Stop} from "./types";
import {unverifiedSource} from "../sources";
import {directoryListings,geographyOf} from "./directory";
import {stopFromDirectory} from "./directory-stop";
import {typesForStop} from "./place-types";

const additions=([...luzon,...islands,...visayas] as ResearchedSpot[]).map(researchedStop);

/** Compose seed modules behind the existing destination.stops interface. Saved
 * activities remain independent snapshots, never hydrated from today's catalog. */
export function catalogForBase(baseSlug:string,existing:Stop[]) {
  const stops=[...existing,...additions.filter(s=>s.baseSlug===baseSlug)].map(s=>structuredClone(s));
  for(const p of directoryListings.filter(p=>p.planning?.base_slug===baseSlug)){
    const index=stops.findIndex(s=>s.id===(p.catalog_stop_id||p.id));
    const next=stopFromDirectory(p,index>=0?stops[index]:undefined);
    if(next){if(index>=0)stops[index]=next;else stops.push(next);}
  }
  for(const s of stops) {
    s.placeTypes=typesForStop(s.id);
    // Correct broad legacy labels without rewriting source records or snapshots.
    if(s.placeTypes.includes("beach"))s.category="Beaches";
    else if(s.placeTypes.some(t=>["cafe","restaurant","bakery","bar"].includes(t)))s.category="Food";
    else if(s.placeTypes.includes("market"))s.category="Markets";
    else if(s.placeTypes.includes("shopping"))s.category="Shopping";
    else if(s.placeTypes.some(t=>["museum","heritage","church"].includes(t)))s.category="Culture";
    const listing=directoryListings.find(p=>p.catalog_stop_id===s.id&&p.itinerary_base_slug===baseSlug);
    if(listing)s.geography=geographyOf(listing);
    for(const parent of stops.filter(p=>p.includes.includes(s.id)))
      if(!s.componentOf.includes(parent.id))s.componentOf.push(parent.id);
    // These broad legacy ideas are retained for old plans, not counted as venues.
    if(["El Nido town walk","Coron town stroll","General Luna waterfront","Catangnan coastal afternoon"].includes(s.name))s.distinct=false;
    if(s.name==="Catangnan coastal afternoon")s.canonicalId="siargao-catangnan-bridge";
    if(s.name==="Museo Dabawenyo area") {
      s.aliases.push("Museo Dabawenyo Event Center");
      s.description="Museo Dabawenyo's city-reported venue on Mabini Street, separate from the National Museum Davao.";
      s.locationDetails="Mabini Street, Barangay 10-A, behind Davao City National High School. The city reported this venue in May 2025; confirm the current entrance.";
      s.lat=null;s.lng=null;s.cluster="davao-mabini";
      const evidence={sourceName:"Davao City Government — Museo Dabawenyo Event Center, May 2025",sourceUrl:"https://davaocity.gov.ph/local-government/museo-dabawenyo-event-center-opens-exhibit-a-history-of-davao-city-in-50-objects/",dateChecked:"2026-10-19",status:"verified" as const};
      s.sources.description={...evidence};s.sources.location={...evidence};s.sources.coordinates=unverifiedSource();
    }
    if(s.id==="boracay-mount-luho"||s.id.includes("kawasan")) {
      s.scheduling="manual";
      s.booking="Current visitor access needs a fresh operator confirmation. This entry is browse-only and is excluded from generation and additions.";
      s.sources.booking=unverifiedSource();
    }
    // Known shared trails are alternatives on the same route, not extra visits.
    if(baseSlug==="sagada"&&/ampacao|nabas/i.test(s.id))s.canonicalId="sagada-ampacao-route";
    if(baseSlug==="sagada"&&/marlboro|blue-soil/i.test(s.id))s.canonicalId="sagada-marlboro-blue-soil-route";
    if(/sugba|iwahig-firefly/i.test(s.id))s.disruptionSensitivities=["heavy-rain","marine-conditions"];
  }
  return stops;
}
