import type {DirectoryCandidate} from "./directory-schema";
import type {Stop} from "./types";
import {defaultFactSources,estimatedSource,unverifiedSource} from "../sources";
export type DirectoryDetails=Pick<Stop,"entryPrice"|"mode"|"componentOf"|"scheduling"|"includes"|"booking"|"cost"|"costBasis"|"sources"|"minutes"|"openingHours"|"accessibility"|"transport"|"locationDetails">;

/** Practical notes are also readable for outliers without an overnight mapping. */
export function directoryDetails(p:DirectoryCandidate):DirectoryDetails|null {
  const plan=p.planning;if(!plan)return null;
  const sources=defaultFactSources();
  sources.description={...p.sources.identity};sources.location={...p.sources.municipality};sources.coordinates={...p.sources.coordinates};
  sources.schedule=estimatedSource();sources.price=estimatedSource();
  sources.booking=plan.booking_source?{...plan.booking_source}:unverifiedSource();
  sources.transport=plan.transport_source?{...plan.transport_source}:unverifiedSource();
  sources.accessibility=plan.accessibility_source?{...plan.accessibility_source}:unverifiedSource();
  const entryPrice=plan.entryPrice||{amount:null,basis:"unknown" as const,source:unverifiedSource()};
  return {sources,entryPrice:structuredClone(entryPrice),mode:plan.mode,componentOf:[],scheduling:plan.scheduling,includes:[],booking:plan.booking,
    cost:Math.round(entryPrice.amount??(plan.mode==="local"?(p.category==="Food & drink"?300:150):1800)),costBasis:entryPrice.basis==="group"?"group":"person",
    minutes:plan.minutes,...(plan.openingHours?{openingHours:structuredClone(plan.openingHours)}:{}),
    accessibility:plan.accessibility,transport:plan.transport,locationDetails:p.city_municipality||"Check with the venue for the location.",
  };
}
