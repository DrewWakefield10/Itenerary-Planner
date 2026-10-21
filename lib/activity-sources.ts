import type { Activity } from "./trip";
import { estimatedSource, unverifiedSource, type FactSources } from "./sources";

// Edits invalidate only affected facts. A changed time must not erase a checked
// location, and a changed price must never retain verification of the old amount.
export function updateActivityField<K extends keyof Activity>(
  activity: Activity,
  key: K,
  value: Activity[K],
): Activity {
  if (activity[key] === value) return activity;
  const sources = structuredClone(activity.sources);
  const affected: Partial<Record<keyof Activity, (keyof FactSources)[]>> = {
    name: [
      "description",
      "location",
      "coordinates",
      "transport",
      "accessibility",
      "booking",
    ],
    description: ["description"],
    lat: ["coordinates"],
    lng: ["coordinates"],
    locationDetails: ["location"],
    accessibility: ["accessibility"],
    transport: ["transport"],
    booking: ["booking"],
    start: ["schedule"],
    duration: ["schedule"],
    cost: ["price"],
  };
  for (const fact of affected[key] || [])
    sources[fact] =
      fact === "price" || fact === "schedule"
        ? estimatedSource()
        : unverifiedSource();
  return {
    ...activity,
    [key]: value,
    sources,
    ...((key==="lat"||key==="lng")&&activity.geography?{geography:{...activity.geography,[key==="lat"?"latitude":"longitude"]:value,sources:{...activity.geography.sources,coordinates:unverifiedSource()}}}:{}),
    ...(key === "name"
      ? {
          catalogStopId: null,
          placeTypes: [],
          geography:null,
          canonicalStopId: null,
          entryPrice: null,
          includedStopIds: [],
          bookingRequired: false,
          disruptionSensitivities: [],
          openingHours: null,
          locationDetails:
            "Location context has not been independently checked.",
          accessibility:
            "Accessibility has not been verified. Confirm your needs with the venue or operator.",
        }
      : {}),
  };
}
