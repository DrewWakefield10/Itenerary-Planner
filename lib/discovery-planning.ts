import { fromStop, minutes, clock, validateDay } from "./engine";
import { activitySchema, tripSchema, type Activity, type Trip } from "./trip";
import { discoveryPlace, discoveryStop, reviewExpired } from "./discovery";
import {destination} from "./destinations";
import {activityKeys,conflictsWithUsed,addableStop} from "./catalog/planning";

export function discoveryActivity(
  placeId: string,
  trip: Trip,
  start: string,
): Activity {
  const place = discoveryPlace(placeId);
  const stop = place && discoveryStop(place);
  if (!place || !stop || reviewExpired(place))
    throw new Error(
      "This place needs a current reviewed catalog mapping before it can be added.",
    );
  const activity = fromStop(stop, trip.request, start);
  if(!addableStop(stop))throw new Error("This is a package component, another overnight base, or a venue awaiting current access confirmation. Choose a complete package or another stop instead.");
  if(stop.mode!=="local")activity.duration=Math.max(480,activity.duration);
  return activitySchema.parse({
    ...activity,
    description: place.description,
    sources: { ...activity.sources, description: { ...place.source } },
    source: `Selected discovery: ${place.id}; ${place.source.sourceName}`,
  });
}
export function previewDiscoveryAddition(
  trip: Trip,
  dayIndex: number,
  placeId: string,
  start: string,
) {
  const place = discoveryPlace(placeId);
  const day = trip.days[dayIndex];
  if (!place || !day || day.transfer || day.destination !== place.baseSlug)
    throw new Error(
      "Choose an ordinary day at this place's exact overnight base. Connection days and ambiguous legacy bases are not eligible.",
    );
  const stop=discoveryStop(place);
  const catalog=destination(place.baseSlug)!.stops;
  const used=new Set(trip.days.filter(d=>d.destination===place.baseSlug).flatMap(d=>d.activities.flatMap(a=>[...activityKeys(a,catalog)])));
  if (stop && conflictsWithUsed(stop,used,catalog))
    throw new Error(
      "This stop or an overlapping package component is already in this trip. Edit it in your trip instead of adding a duplicate.",
    );
  const activity = discoveryActivity(placeId, trip, start);
  if(activity.visitMode!=="local" && day.activities.length)throw new Error("An excursion or package needs a separate empty day. Edit this day first; no existing activities will be replaced.");
  if(day.activities.some(a=>a.visitMode!=="local"))throw new Error("This day already reserves a full excursion block. Choose another day.");
  const begins = minutes(start),
    ends = begins + activity.duration;
  if (ends > 24 * 60) throw new Error("The visit must finish before midnight.");
  if (day.activities.length >= 30)
    throw new Error("This day already has the maximum number of activities.");
  for (const a of day.activities) {
    const aStart = minutes(a.start),
      aEnd = aStart + a.duration;
    if (begins < aEnd + 45 && ends + 45 > aStart)
      throw new Error(
        "This visit needs an empty slot plus 45-minute planning buffers before and after existing activities. Choose another time or day; no activities will be moved.",
      );
  }
  const hours = activity.openingHours;
  if (hours) {
    const weekday = new Date(day.date + "T12:00:00Z").getUTCDay();
    if (
      !hours.weekdays.includes(weekday) ||
      begins < minutes(hours.opens) ||
      ends > minutes(hours.closes)
    )
      throw new Error(
        "This visit falls outside the recorded opening days or hours. Choose another time or day; special closures still need checking.",
      );
  }
  const next = structuredClone(trip);
  next.days[dayIndex].activities = [
    ...next.days[dayIndex].activities,
    activity,
  ].sort((a, b) => minutes(a.start) - minutes(b.start));
  return {
    original: JSON.stringify(trip),
    placeId,
    dayIndex,
    start,
    activity,
    next: tripSchema.parse(next),
    warnings: validateDay(next.days[dayIndex]),
  };
}
export type DiscoveryAddition = ReturnType<typeof previewDiscoveryAddition>;
export function acceptDiscoveryAddition(
  current: Trip,
  preview: DiscoveryAddition,
) {
  if (JSON.stringify(current) !== preview.original)
    throw new Error(
      "This trip changed after the preview. Preview the addition again.",
    );
  // Re-evaluate mapping, opening hours, duplicates, and schedule at acceptance.
  return previewDiscoveryAddition(
    current,
    preview.dayIndex,
    preview.placeId,
    preview.start,
  ).next;
}
export function suggestedDiscoveryTime(
  trip: Trip,
  dayIndex: number,
  placeId: string,
) {
  for (let t = 9 * 60; t <= 20 * 60; t += 15) {
    try {
      previewDiscoveryAddition(trip, dayIndex, placeId, clock(t));
      return clock(t);
    } catch {
      /* No slot is inferred from an invalid or incompatible day. */
    }
  }
  return null;
}
