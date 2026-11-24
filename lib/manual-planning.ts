import { z } from "zod/v3";
import { destination, peso } from "./destinations";
import { groupForBase } from "./catalog/directory";
import { discoveryPlace, discoveryStop } from "./discovery";
import {
  blankActivity,
  clock,
  dateOffset,
  destinationSnapshots,
  fromStop,
  localTransportAllowance,
  minutes,
  travelers,
  uid,
  validateDay,
} from "./engine";
import {
  activitySchema,
  daySchema,
  manualBudgetSchema,
  requestSchema,
  tripSchema,
  type Activity,
  type Trip,
  type TripDay,
  type TripRequest,
} from "./trip";
import {
  activityKeys,
  addableStop,
  closeEnough,
  conflictsWithUsed,
  mentioned,
  visitStart,
} from "./catalog/planning";
import { matchesPlacePreferences } from "./catalog/place-types";

export const manualDraftSchema = z.object({
  days: z.array(daySchema).max(21),
  budget: manualBudgetSchema,
  selectedDay: z.number().int().min(0).max(20),
  step: z.number().int().min(0).max(6),
  search: z.string(),
  group: z.string(),
  category: z.string(),
  page: z.number().int().min(1),
});
export type ManualDraft = z.infer<typeof manualDraftSchema>;
export const emptyManualDraft: ManualDraft = {
  days: [],
  budget: { limit: null, additional: null },
  selectedDay: 0,
  step: 0,
  search: "",
  group: "all",
  category: "all",
  page: 1,
};

export function layoutManualDays(request: TripRequest, previous: TripDay[]) {
  const r = requestSchema.parse(request);
  const localDays = r.days - r.destinations.length + 1;
  const slots = r.destinations.flatMap((slug, index) => [
    ...(index ? [{ slug, transfer: true }] : []),
    ...Array.from(
      {
        length:
          Math.floor(localDays / r.destinations.length) +
          Number(index < localDays % r.destinations.length),
      },
      () => ({ slug, transfer: false }),
    ),
  ]);
  const days = slots.map(
    ({ slug, transfer }, index): TripDay => ({
      id: previous[index]?.id ?? uid(),
      date: dateOffset(r.startDate, index),
      destination: slug,
      title: transfer
        ? `Connection to ${destination(slug)?.name}`
        : destination(slug)!.name,
      transfer,
      activities: (previous[index]?.activities ?? []).map((activity) => ({
        ...activity,
        manual: {
          flexible: false,
          durationUnknown: false,
          price: "estimate",
          ...activity.manual,
          base: activity.manual?.base ?? previous[index]?.destination,
        },
      })),
      windows: previous[index]?.windows ?? [],
      stay: 0,
      food: 0,
      transport: 0,
    }),
  );
  return [...days, ...previous.slice(r.days)];
}

export function finishManualTrip(
  request: TripRequest,
  draft: ManualDraft,
): Trip {
  const r = requestSchema.parse(request);
  const days = layoutManualDays(r, draft.days);
  if (
    days
      .slice(r.days)
      .some((day) => day.activities.length || day.windows?.length)
  )
    throw new Error(
      "Move or remove the stops and time windows on days outside your new duration first.",
    );
  const activeDays = days.slice(0, r.days);
  if (
    activeDays.some((day) =>
      day.activities.some((activity) => misplaced(activity, day)),
    )
  )
    throw new Error(
      "Move or remove activities flagged for a different overnight base.",
    );
  return tripSchema.parse({
    version: 1,
    id: uid(),
    title: `${r.destinations.map((slug) => destination(slug)?.name).join(" & ")} — my itinerary`,
    createdAt: new Date().toISOString(),
    mode: "manual",
    request: r,
    manualBudget: draft.budget,
    destinationInfo: destinationSnapshots(r.destinations),
    days: activeDays,
    notes: "",
    actual: {},
    flightAllowance: 0,
    checklist: [
      "Confirm booked times and routes",
      "Check local access and opening hours",
      "Review transport and accommodation costs",
    ].map((text) => ({ id: uid(), text, done: false })),
    warnings: [
      "Review times, prices, access and transport before traveling. Unentered costs are excluded from the known subtotal.",
    ],
  });
}

export const manualDefaults = {
  flexible: true,
  durationUnknown: true,
  price: "unknown",
} as const;
export const isTimed = (a: Activity) =>
  !a.manual?.flexible && !a.manual?.durationUnknown;
export function activityCostLabel(a: Activity) {
  if (a.manual?.price === "unknown") return "Cost unknown";
  return `${peso(a.cost)}${a.manual ? (a.manual.price === "confirmed" ? " · confirmed" : " · estimate") : ""}`;
}
export function misplaced(a: Activity, day: TripDay) {
  return (
    !!a.manual?.base &&
    (a.manual.base !== day.destination ||
      (day.transfer && !!(a.manual.placeId || a.catalogStopId)))
  );
}
export function catalogActivity(
  id: string,
  request: TripRequest,
  day: TripDay,
): Activity {
  const place = discoveryPlace(id);
  if (!place?.directory)
    throw new Error("This place is no longer in the directory.");
  if (
    day.transfer ||
    (place.baseSlug
      ? place.baseSlug !== day.destination
      : place.directory.destination_group !== groupForBase(day.destination))
  )
    throw new Error("Choose an ordinary day at the compatible overnight base.");
  const stop = discoveryStop(place);
  const activity = stop
    ? fromStop(stop, request, "09:00")
    : blankActivity(place.name);
  const fee = stop?.entryPrice;
  const price =
    fee?.amount == null
      ? 0
      : Math.round(
          fee.amount *
            (fee.basis === "person" ? request.adults + request.children : 1),
        );
  return activitySchema.parse({
    ...activity,
    description: place.description,
    geography: place.directory,
    lat: place.directory.latitude,
    lng: place.directory.longitude,
    sources: {
      ...activity.sources,
      description: place.source,
      coordinates: place.directory.sources.coordinates,
      location: place.directory.sources.address,
      ...(fee ? { price: fee.source } : {}),
    },
    cost: price,
    manual: {
      flexible: true,
      durationUnknown: !stop,
      price: fee?.amount == null ? "unknown" : "estimate",
      placeId: id,
      base: day.destination,
      reviewedDate: day.date,
      ...(fee?.basis === "person"
        ? { groupSizeAtEstimate: travelers(request) }
        : {}),
    },
  });
}
export function manualBudgetTotals(
  days: TripDay[],
  budget: ManualDraft["budget"],
) {
  const activities = days.flatMap((day) => day.activities);
  const planned =
    days.reduce((sum, day) => sum + day.stay + day.food + day.transport, 0) +
    activities.reduce(
      (sum, activity) =>
        sum + (activity.manual?.price === "unknown" ? 0 : activity.cost),
      0,
    );
  const spentOnSuggestions = activities.reduce(
    (sum, activity) => sum + (activity.manual?.suggestion ? activity.cost : 0),
    0,
  );
  const remaining =
    budget.additional === null
      ? null
      : Math.max(0, budget.additional - spentOnSuggestions);
  return {
    planned,
    spentOnSuggestions,
    remaining,
    combined: remaining === null ? planned : planned + remaining,
    unknown: activities.filter(
      (activity) =>
        activity.manual?.price === "unknown" || activity.manual?.entryUnknown,
    ).length,
  };
}

export function manualDayWarnings(day: TripDay, request: TripRequest) {
  const ordered = day.activities
    .filter(isTimed)
    .sort((a, b) => a.start.localeCompare(b.start));
  const warnings = validateDay({ ...day, activities: ordered }).filter(
    (warning) => !warning.includes("45-minute planning buffer"),
  );
  for (const activity of day.activities) {
    if (misplaced(activity, day))
      warnings.push(
        `${activity.name}: move to a day at its original overnight base.`,
      );
    if (
      activity.locked &&
      activity.manual?.reviewedDate &&
      activity.manual.reviewedDate !== day.date
    )
      warnings.push(
        `${activity.name}: this day’s date changed. Check the original booking date.`,
      );
    if (
      activity.manual?.groupSizeAtEstimate &&
      activity.manual.groupSizeAtEstimate !== travelers(request)
    )
      warnings.push(
        `${activity.name}: recheck the group cost after changing traveler count.`,
      );
    if (
      isTimed(activity) &&
      activity.openingHours &&
      (!activity.openingHours.weekdays.includes(
        new Date(day.date + "T12:00:00Z").getUTCDay(),
      ) ||
        activity.start < activity.openingHours.opens ||
        minutes(activity.start) + activity.duration >
          minutes(activity.openingHours.closes))
    )
      warnings.push(
        `${activity.name}: outside recorded regular hours. Check the time or move to another day.`,
      );
    if (activity.locked && activity.manual?.flexible)
      warnings.push(
        `${activity.name}: fixed commitment has no scheduled time.`,
      );
    if (
      isTimed(activity) &&
      day.windows?.some(
        (window) =>
          window.intent === "free" &&
          minutes(activity.start) < minutes(window.end) &&
          minutes(activity.start) + activity.duration > minutes(window.start),
      )
    )
      warnings.push(`${activity.name}: overlaps time marked Keep free.`);
    const stop =
      activity.catalogStopId &&
      destination(day.destination)?.stops.find(
        (s) => s.id === activity.catalogStopId,
      );
    if (
      stop &&
      (mentioned(stop, request.avoid) ||
        (request.activityCategories.length &&
          !matchesPlacePreferences(stop, request)))
    )
      warnings.push(
        `${activity.name}: review this stop against your travel preferences.`,
      );
  }
  return [...new Set(warnings)];
}

type Window = NonNullable<TripDay["windows"]>[number];
export function dayWindows(day: TripDay): Window[] {
  const explicit = day.windows ?? [];
  if (day.activities.some((activity) => !isTimed(activity))) return explicit;
  const sorted = [...day.activities].sort((a, b) =>
    a.start.localeCompare(b.start),
  );
  const inferred = sorted.slice(1).flatMap((activity, index): Window[] => {
    const prior = sorted[index],
      start = minutes(prior.start) + prior.duration;
    if (
      minutes(activity.start) - start < 30 ||
      explicit.some(
        (w) =>
          minutes(w.start) < minutes(activity.start) && minutes(w.end) > start,
      )
    )
      return [];
    return [
      {
        id: `gap-${prior.id}-${activity.id}`,
        start: clock(start),
        end: activity.start,
        intent: "unplanned",
      },
    ];
  });
  return [...explicit, ...inferred].sort((a, b) =>
    a.start.localeCompare(b.start),
  );
}
export type Suggestion = {
  dayId: string;
  windowId: string;
  stopId: string;
  start: string;
  before: number;
  after: number;
  spare: number;
  cost: number;
  duration: number;
  transport: number;
  entryUnknown: boolean;
};
export function assistanceWindows(day: TripDay): Window[] {
  if (day.transfer) return [];
  if (!day.activities.length && !day.windows?.length)
    return [
      {
        id: `open-day-${day.id}`,
        start: "09:00",
        end: "17:00",
        intent: "unplanned",
      },
    ];
  return dayWindows(day);
}
function travelAllowance(
  neighbor: Activity | undefined,
  candidate: Activity,
  request: TripRequest,
) {
  if (!neighbor || neighbor.kind === "Rest") return 0;
  if (sameVerifiedPoint(neighbor, candidate)) return 0;
  const catalog = destination(candidate.manual?.base ?? null)?.stops ?? [];
  const first = catalog.find((stop) => stop.id === neighbor.catalogStopId),
    second = catalog.find((stop) => stop.id === candidate.catalogStopId);
  if (!first || !second || !closeEnough(first, second)) return null;
  return request.pace === "Chill" ? 30 : request.pace === "Packed" ? 15 : 20;
}
function sameVerifiedPoint(a: Activity | undefined, b: Activity) {
  return (
    a?.lat != null &&
    a.lng != null &&
    a.sources.coordinates.status === "verified" &&
    b.sources.coordinates.status === "verified" &&
    a.lat === b.lat &&
    a.lng === b.lng
  );
}
export function suggestionsForWindow(
  request: TripRequest,
  days: TripDay[],
  day: TripDay,
  windowId: string,
  budget: ManualDraft["budget"],
): Suggestion[] {
  const window = assistanceWindows(day).find(
    (window) => window.id === windowId,
  );
  if (
    !window ||
    window.intent === "free" ||
    day.transfer ||
    day.activities.length >= 30 ||
    day.activities.some((a) => misplaced(a, day) || a.visitMode !== "local")
  )
    return [];
  const earliest = minutes(window.start),
    latest = minutes(window.end);
  const sorted = day.activities
    .filter(isTimed)
    .sort((a, b) => a.start.localeCompare(b.start));
  if (
    sorted.some(
      (activity, index) =>
        index &&
        minutes(sorted[index - 1].start) + sorted[index - 1].duration >
          minutes(activity.start),
    )
  )
    return [];
  if (
    sorted.some(
      (activity) =>
        minutes(activity.start) < latest &&
        minutes(activity.start) + activity.duration > earliest,
    ) ||
    day.windows?.some(
      (other) =>
        other.id !== window.id &&
        other.intent === "free" &&
        other.start < window.end &&
        other.end > window.start,
    )
  )
    return [];
  const previous = sorted
    .filter(
      (activity) => minutes(activity.start) + activity.duration <= earliest,
    )
    .at(-1);
  const following = sorted.find(
    (activity) => minutes(activity.start) >= latest,
  );
  const catalog = destination(day.destination)!.stops;
  const used = new Set(
    days.flatMap((d) =>
      d.activities.flatMap((a) => [...activityKeys(a, catalog)]),
    ),
  );
  const budgetLeft = manualBudgetTotals(days, budget).remaining;
  const scheduled = day.activities.reduce(
    (sum, activity) =>
      sum + (activity.manual?.durationUnknown ? 0 : activity.duration),
    0,
  );
  const buffer =
    request.pace === "Chill" ? 20 : request.pace === "Packed" ? 10 : 15;
  return catalog
    .flatMap((stop) => {
      if (
        !stop.distinct ||
        !addableStop(stop) ||
        stop.mode !== "local" ||
        stop.requiresBooking ||
        conflictsWithUsed(stop, used, catalog) ||
        mentioned(stop, request.avoid) ||
        !matchesPlacePreferences(stop, request)
      )
        return [];
      const fee = stop.entryPrice;
      const candidate = fromStop(stop, request, "09:00");
      candidate.manual = { ...manualDefaults, base: day.destination };
      const before = travelAllowance(previous, candidate, request),
        after = travelAllowance(following, candidate, request);
      if (
        before === null ||
        after === null ||
        scheduled + before + stop.minutes + after > 600
      )
        return [];
      const sameSite =
        sameVerifiedPoint(previous, candidate) &&
        sameVerifiedPoint(following, candidate);
      const transport = sameSite
        ? 0
        : localTransportAllowance(travelers(request));
      const entryUnknown = fee.amount === null;
      const cost =
        transport +
        (entryUnknown
          ? candidate.cost
          : Math.round(
              fee.amount! * (fee.basis === "group" ? 1 : travelers(request)),
            ));
      if (
        budgetLeft === 0 &&
        !(sameSite && fee.amount === 0 && fee.source.status === "verified")
      )
        return [];
      if (budgetLeft !== null && (entryUnknown || cost > budgetLeft)) return [];
      const start = visitStart(
        stop,
        day.date,
        earliest + before,
        latest - after - buffer,
      );
      return start === null
        ? []
        : [
            {
              dayId: day.id,
              windowId,
              stopId: stop.id,
              start: clock(start),
              before,
              after,
              spare: latest - start - stop.minutes - after,
              cost,
              duration: stop.minutes,
              transport,
              entryUnknown,
            },
          ];
    })
    .sort((a, b) => {
      const stopA = catalog.find((stop) => stop.id === a.stopId)!;
      const stopB = catalog.find((stop) => stop.id === b.stopId)!;
      const score = (stop: typeof stopA) =>
        Number(mentioned(stop, request.must)) * 2 +
        Number(
          !!request.accessibility &&
            stop.sources.accessibility.status === "verified",
        );
      return (
        score(stopB) - score(stopA) || b.spare - a.spare || a.cost - b.cost
      );
    })
    .slice(0, 12);
}

export function acceptManualSuggestions(
  request: TripRequest,
  days: TripDay[],
  budget: ManualDraft["budget"],
  picks: Suggestion[],
) {
  const usedWindows = new Set<string>();
  const updated = structuredClone(days),
    added: Activity[] = [];
  for (const pick of picks) {
    const day = updated.find((day) => day.id === pick.dayId);
    const key = `${pick.dayId}:${pick.windowId}`;
    if (!day || usedWindows.has(key))
      throw new Error("Choose one alternative per time window.");
    const valid = suggestionsForWindow(
      request,
      updated,
      day,
      pick.windowId,
      budget,
    ).find(
      (candidate) =>
        candidate.stopId === pick.stopId &&
        JSON.stringify(candidate) === JSON.stringify(pick),
    );
    if (!valid)
      throw new Error(
        "The schedule, price or budget changed. Request new options before applying.",
      );
    const stop = destination(day.destination)!.stops.find(
      (stop) => stop.id === pick.stopId,
    )!;
    const choice = fromStop(stop, request, valid.start);
    choice.cost = valid.cost;
    choice.manual = {
      flexible: false,
      durationUnknown: false,
      price: "estimate",
      base: day.destination,
      suggestion: true,
      entryUnknown: valid.entryUnknown,
      groupSizeAtEstimate: travelers(request),
    };
    day.activities.push(choice);
    added.push(choice);
    usedWindows.add(key);
  }
  return { days: updated, added };
}
