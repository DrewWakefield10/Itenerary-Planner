import { destination, rainAlternativeSeeds } from "./destinations";
import { fromStop, minutes, clock, endTime } from "./engine";
import { tripSchema, type Trip, type Activity } from "./trip";
import { estimatedSource } from "./sources";

export type RainAlternative = {
  original: Activity;
  replacement: Activity;
  notes: string[];
  transferBufferMinutes: number;
  costDifference: number;
  durationDifference: number;
};
export type AffectedActivity = {
  activity: Activity;
  reason: string;
  alternative?: RainAlternative;
  unavailableReason?: string;
};
// Coordinates only reject clearly remote stops. They are never converted into
// travel time; the seed registry supplies a separate conservative planning buffer.
function nearby(a: Activity, b: Activity) {
  if (a.lat === null || a.lng === null || b.lat === null || b.lng === null)
    return false;
  const radians = (n: number) => (n * Math.PI) / 180;
  const x = radians(b.lng - a.lng) * Math.cos(radians((a.lat + b.lat) / 2)),
    y = radians(b.lat - a.lat);
  return Math.sqrt(x * x + y * y) * 6371 <= 3;
}
export function rainAlternativeFor(
  trip: Trip,
  dayIndex: number,
  id: string,
): { alternative?: RainAlternative; reason?: string } {
  const day = trip.days[dayIndex],
    original = day?.activities.find((a) => a.id === id);
  if (
    !day ||
    !original ||
    !original.disruptionSensitivities?.includes("heavy-rain")
  )
    return { reason: "No rain sensitivity is recorded for this activity." };
  if (original.locked)
    return {
      reason:
        "This activity is locked. Review the booking and unlock it yourself before considering changes.",
    };
  if (day.transfer)
    return {
      reason:
        "This is a transfer day. Replacement transport needs independent confirmation.",
    };
  const config = rainAlternativeSeeds[day.destination];
  if (!config)
    return {
      reason:
        "No curated rain alternative is available for this destination yet. You can still make a manual Plan B.",
    };
  const seed = destination(day.destination)?.stops.find(
    (s) => s.name === config.stopName,
  );
  if (!seed) return { reason: "The alternative seed is unavailable." };
  if (day.activities.some((a) => a.name === seed.name))
    return {
      reason:
        "The curated indoor or flexible stop is already in this day. No duplicate visit is suggested.",
    };
  const candidate = fromStop(seed, trip.request, original.start);
  if (original.cluster !== candidate.cluster || !nearby(original, candidate))
    return {
      reason:
        "The alternative is outside the recorded local planning area, or location data is missing. A practical transfer cannot be assumed.",
    };
  if (
    trip.request.avoid &&
    seed.name.toLowerCase().includes(trip.request.avoid.toLowerCase().trim())
  )
    return { reason: "This stop matches an activity you asked to avoid." };
  const start = minutes(original.start),
    end = start + original.duration;
  const others = day.activities.filter((a) => a.id !== id);
  if (
    others.some(
      (a) => minutes(a.start) < end && minutes(a.start) + a.duration > start,
    )
  )
    return {
      reason:
        "The original time block already overlaps another activity. Resolve the conflict before replacing it.",
    };
  const before = others
    .filter((a) => minutes(a.start) + a.duration <= start)
    .sort(
      (a, b) => minutes(b.start) + b.duration - minutes(a.start) - a.duration,
    )[0];
  const after = others
    .filter((a) => minutes(a.start) >= end)
    .sort((a, b) => minutes(a.start) - minutes(b.start))[0];
  // Use an existing incoming gap if it holds the buffer; otherwise reserve that
  // buffer inside the original time block. All other activities keep their times.
  const visitStart =
    before &&
    start - (minutes(before.start) + before.duration) >=
      config.transferBufferMinutes
      ? start
      : start + config.transferBufferMinutes;
  const visitEnd = visitStart + config.visitMinutes;
  if (
    visitEnd > end ||
    (after && minutes(after.start) - visitEnd < config.transferBufferMinutes)
  )
    return {
      reason:
        "A visit and conservative transfer buffers do not fit this slot without moving other activities. Keep the plan or edit the day manually.",
    };
  const hours = seed.openingHours;
  if (hours) {
    const weekday = new Date(day.date + "T12:00:00Z").getUTCDay();
    if (
      !hours.weekdays.includes(weekday) ||
      visitStart < minutes(hours.opens) ||
      visitEnd > minutes(hours.closes)
    )
      return {
        reason:
          "The proposed visit is outside the venue’s published opening days or hours. Special closures still need checking.",
      };
  }
  candidate.id = original.id;
  candidate.start = clock(visitStart);
  candidate.duration = config.visitMinutes;
  candidate.description = config.note;
  candidate.transport = `Reserve ${config.transferBufferMinutes} minutes before and after the visit using the original slot or existing gaps. This is a planning allowance, not a routed travel-time estimate. Confirm current local transport and conditions.`;
  candidate.sources.schedule = estimatedSource();
  const notes = [
    config.note,
    `${config.transferBufferMinutes}-minute transfer buffers are reserved. No road route or journey duration has been verified.`,
    hours
      ? `Published hours: ${hours.opens}–${hours.closes}, ${hours.weekdays.map((n) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][n]).join(", ")}. Confirm current hours, reservations, and special closures.`
      : "Opening hours are unverified. Choose an open indoor venue before relying on this flexible idea.",
    "Admission, meals, and transport allowances remain estimates. Check local conditions and official advisories; an indoor activity is not guaranteed safe.",
  ];
  return {
    alternative: {
      original: structuredClone(original),
      replacement: candidate,
      notes,
      transferBufferMinutes: config.transferBufferMinutes,
      costDifference: candidate.cost - original.cost,
      durationDifference: candidate.duration - original.duration,
    },
  };
}
export function affectedRainActivities(
  trip: Trip,
  dayIndex: number,
): AffectedActivity[] {
  return (trip.days[dayIndex]?.activities || [])
    .filter((a) => a.disruptionSensitivities?.includes("heavy-rain"))
    .map((activity) => {
      const result = rainAlternativeFor(trip, dayIndex, activity.id);
      return {
        activity,
        reason: `${activity.name} is tagged as rain-sensitive; rain may affect this planned outdoor stop.`,
        alternative: result.alternative,
        unavailableReason: result.reason,
      };
    });
}
export function previewRainReplacement(
  trip: Trip,
  dayIndex: number,
  suggestion: RainAlternative,
): Trip {
  // Rebuild from current data to reject stale previews, locked stops, or new conflicts.
  const current = rainAlternativeFor(
    trip,
    dayIndex,
    suggestion.original.id,
  ).alternative;
  if (
    !current ||
    JSON.stringify(current.original) !== JSON.stringify(suggestion.original) ||
    JSON.stringify(current.replacement) !==
      JSON.stringify(suggestion.replacement)
  )
    throw new Error(
      "This suggestion no longer matches the day. Preview it again.",
    );
  const next = structuredClone(trip);
  next.days[dayIndex].activities = next.days[dayIndex].activities.map((a) =>
    a.id === suggestion.original.id ? structuredClone(current.replacement) : a,
  );
  return tripSchema.parse(next);
}
export function rainScheduleDifference(alternative: RainAlternative) {
  return `${alternative.original.start}–${endTime(alternative.original)} → ${alternative.replacement.start}–${endTime(alternative.replacement)}; ${alternative.original.duration} → ${alternative.replacement.duration} minutes visiting.`;
}
