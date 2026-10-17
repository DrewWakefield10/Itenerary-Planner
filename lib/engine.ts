import { destination, destinations, type Stop } from "./destinations";
import {
  requestSchema,
  tripSchema,
  expenseCategories,
  type TripRequest,
  type Trip,
  type Activity,
  type TripDay,
} from "./trip";
import { defaultFactSources, estimatedSource } from "./sources";
export const uid = () => crypto.randomUUID();
export const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
export const clock = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
export const endTime = (a: Activity) => clock(minutes(a.start) + a.duration);
export const travelers = (r: TripRequest) => r.adults + r.children;
export const totalBudget = (r: TripRequest) =>
  r.budget * (r.budgetMode === "person" ? travelers(r) : 1);
export function dateOffset(date: string, n: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function blankActivity(
  name: string,
  start = "09:00",
  kind = "Rest",
): Activity {
  return {
    id: uid(),
    name,
    description:
      "Personal planning placeholder. Confirm details before travel.",
    lat: null,
    lng: null,
    start,
    duration: 60,
    cost: 0,
    category: kind === "Food" ? "Food" : "Miscellaneous",
    kind,
    outdoor: false,
    disruptionSensitivities: [],
    openingHours: null,
    cluster: "local",
    locked: false,
    transport: "No route verified.",
    booking: "No booking has been made.",
    provenance: "user",
    source: "Added by traveler",
    locationDetails: "Location context has not been independently checked.",
    accessibility:
      "Accessibility has not been verified. Confirm your needs with the venue or operator.",
    sources: defaultFactSources(),
    advisories: [],
  };
}
export function fromStop(s: Stop, r: TripRequest, start: string): Activity {
  return {
    ...blankActivity(s.name, start, s.category),
    description: `Explore at your own pace. ${s.outdoor ? "Outdoor stop; keep a weather alternative." : "Confirm venue and opening hours."}`,
    lat: s.lat,
    lng: s.lng,
    duration: s.minutes,
    cost: s.cost * travelers(r),
    category: s.category === "Food" ? "Food" : "Attractions",
    outdoor: s.outdoor,
    disruptionSensitivities: [...(s.disruptionSensitivities || [])],
    openingHours: s.openingHours ? structuredClone(s.openingHours) : null,
    cluster: s.cluster,
    transport: s.transport,
    locationDetails: s.locationDetails,
    accessibility: s.accessibility,
    sources: {
      ...structuredClone(s.sources),
      description: defaultFactSources().description,
      schedule: defaultFactSources().schedule,
    },
    advisories: structuredClone(s.advisories),
    booking:
      "Illustrative allowance, not a quoted entrance fee. Confirm availability and hours.",
    provenance: "estimate",
    source:
      "Lakbay seed collection; see fact-specific sources for review status.",
  };
}
export function recommendDestinations(interests: string[], budget = 10000) {
  const map: Record<string, string> = {
    "Beach Bum": "Beaches",
    "Mountain Explorer": "Mountains",
    "Food Hunter": "Food",
    "Culture Seeker": "Culture",
    "Adventure Junkie": "Adventure",
    "Nature Lover": "Nature",
    "Hidden Gem Collector": "Hidden Gems",
    "City Wanderer": "Culture",
    "Slow Traveler": "Family",
  };
  return [...destinations]
    .sort((a, b) => {
      const score = (d: typeof a) =>
        interests.reduce((n, i) => n + (d.tags.includes(map[i]) ? 3 : 0), 0) +
        (d.daily * 3 <= budget ? 2 : 0);
      return score(b) - score(a) || a.daily - b.daily;
    })
    .slice(0, 3);
}
export function makeDay(
  r: TripRequest,
  slug: string,
  index: number,
  localIndex: number,
  variant = 0,
): TripDay {
  const d = destination(slug)!;
  const n = travelers(r);
  const available = (totalBudget(r) * (1 - r.reserve / 100)) / r.days / n;
  const economy =
    available < d.daily || r.tier === "Budget" || r.tier === "Backpacker";
  let pool = d.stops.filter(
    (s) =>
      s.category !== "Food" &&
      (!r.avoid || !r.avoid.toLowerCase().includes(s.name.toLowerCase())),
  );
  // A boat outing is a separate activity block, never squeezed between town stops.
  if (economy || r.accessibility || r.pace === "Chill")
    pool = pool.filter((s) => s.cluster !== "boat");
  const match = (s: Stop) =>
    r.interests.some((i) =>
      i
        .toLowerCase()
        .includes(
          s.category === "Beaches"
            ? "beach"
            : s.category.toLowerCase().split(" ")[0],
        ),
    );
  pool.sort((a, b) => Number(match(b)) - Number(match(a)) || a.cost - b.cost);
  const first = pool[(localIndex + variant) % Math.max(1, pool.length)];
  const cluster = first?.cluster;
  const count =
    index === 0 || r.pace === "Chill" ? 1 : r.pace === "Balanced" ? 2 : 3;
  const chosen = first
    ? [
        first,
        ...pool.filter((s) => s !== first && s.cluster === cluster),
      ].slice(0, first.cluster === "boat" ? 1 : count)
    : [];
  let cursor = index === 0 ? 14 * 60 : 9 * 60;
  const activities: Activity[] = [];
  const meal = d.stops.find((s) => s.category === "Food");
  let mealAdded = false;
  const addMeal = (start: number) => {
    if (!meal || mealAdded) return;
    const a = fromStop(meal, r, clock(start));
    a.description = `Meal idea: ${d.food} ${r.diet ? "Dietary requirements must be confirmed with the venue." : ""}`;
    a.lat = null;
    a.lng = null;
    a.cluster = "local";
    activities.push(a);
    mealAdded = true;
  };
  if (index === 0)
    activities.push({
      ...blankActivity("Arrival & check-in buffer", "09:00", "Travel"),
      duration: 240,
      description: `Travel from ${r.departure} is not verified. Confirm arrival before accepting afternoon activities. Move them if your journey needs a full day.`,
      transport: "No departure schedule or direct connection assumed.",
      provenance: "demo",
    });
  for (const s of chosen) {
    if (
      index !== 0 &&
      cursor >= 12 * 60 &&
      !mealAdded &&
      s.cluster !== "boat"
    ) {
      addMeal(cursor);
      cursor += 135;
    }
    if (cursor + s.minutes > 18 * 60) break;
    activities.push(fromStop(s, r, clock(cursor)));
    cursor += s.minutes + 45;
  }
  if (!mealAdded)
    addMeal(Math.max(index === 0 ? 18 * 60 : 12 * 60 + 30, cursor));
  activities.push({
    ...blankActivity(
      r.pace === "Chill"
        ? "A long, unhurried rest"
        : "Free time & a little breathing room",
      clock(Math.max(index === 0 ? 19 * 60 + 30 : 16 * 60 + 30, cursor + 135)),
    ),
    duration: r.pace === "Chill" ? 120 : 60,
    description: "Keep this time open. No activity or reservation is assumed.",
    provenance: "demo",
  });
  activities.sort((a, b) => minutes(a.start) - minutes(b.start));
  if (index === r.days - 1) {
    for (let j = activities.length - 1; j >= 0; j--)
      if (minutes(activities[j].start) + activities[j].duration > 13 * 60)
        activities.splice(j, 1);
    activities.push({
      ...blankActivity("Departure & onward travel buffer", "13:00", "Travel"),
      duration: 300,
      description:
        "Confirm transport and check-out. This is a reserved buffer, not a transport timetable.",
      provenance: "demo",
    });
  }
  return {
    id: uid(),
    date: dateOffset(r.startDate, index),
    destination: slug,
    title:
      index === 0
        ? "Arrive, settle in, take it slow"
        : index === r.days - 1
          ? "One last look, then onward"
          : `${d.name}, at your own pace`,
    transfer: false,
    activities,
    stay:
      r.accommodation && index < r.days - 1
        ? (economy ? 800 : r.tier === "Premium" ? 4500 : 2000) *
          Math.ceil(n / 2)
        : 0,
    food: (economy ? 350 : 550) * n,
    transport: (economy ? 200 : 400) * n,
  };
}
const checklist = [
  "Identification and required documents",
  "Booking confirmations & transport details",
  "Clothing and comfortable footwear",
  "Chargers, power bank & offline copies",
  "Personal care essentials",
  "Personal medication & first-aid supplies",
  "Rain protection & sun protection",
  "Cash and payment backup",
  "Verified local emergency contacts",
];
export function generateDemo(input: TripRequest): Trip {
  const r = requestSchema.parse(input);
  const k = r.destinations.length;
  const localDays = r.days - (k - 1);
  const days: TripDay[] = [];
  r.destinations.forEach((slug, i) => {
    if (i > 0) {
      days.push({
        id: uid(),
        date: dateOffset(r.startDate, days.length),
        destination: slug,
        title: `Connection day: ${destination(r.destinations[i - 1])?.name} → ${destination(slug)?.name}`,
        transfer: true,
        activities: [
          {
            ...blankActivity(
              "Verify and complete inter-destination transfer",
              "08:00",
              "Travel",
            ),
            duration: 600,
            category: "Transportation",
            description:
              "No direct ferry or flight is assumed. Confirm operator, terminals, connections, baggage, and overnight needs. Extend this trip if the verified journey requires more time.",
            transport:
              "Unsupported connection until you confirm an actual itinerary.",
            provenance: "demo",
          },
        ],
        stay: r.accommodation ? 1200 * Math.ceil(travelers(r) / 2) : 0,
        food: 600 * travelers(r),
        transport: 2500 * travelers(r),
      });
    }
    const count = Math.floor(localDays / k) + (i < localDays % k ? 1 : 0);
    for (let j = 0; j < count; j++) days.push(makeDay(r, slug, days.length, j));
  });
  const warnings = [
    "All costs are planning allowances, not quotes. Operating hours, transport times, availability, and map locations need confirmation.",
    "Airport/terminal access and local transport allowances are estimates; replace them with confirmed costs.",
  ];
  if (!r.flights)
    warnings.push(
      "Travel to and from your first/last destination is excluded. Add confirmed flights, bus fares, or other arrival costs.",
    );
  if (
    r.accessibility ||
    r.diet ||
    r.reservations ||
    r.must ||
    r.avoid ||
    r.requirements
  )
    warnings.push(
      "Your special requests are saved below. Demo mode cannot verify accessibility, dietary suitability, reservations, or every must-visit/avoid request. Review these before using the plan.",
    );
  return tripSchema.parse({
    version: 1,
    id: uid(),
    title: `${r.destinations.map((s) => destination(s)?.name).join(" & ")} — my island story`,
    createdAt: new Date().toISOString(),
    mode: "demo",
    request: r,
    days,
    destinationInfo: r.destinations.map((slug) => {
      const d = destination(slug)!;
      return structuredClone({
        slug: d.slug,
        name: d.name,
        locationDetails: d.locationDetails,
        transport: d.transport,
        accessibility: d.accessibility,
        lat: d.lat,
        lng: d.lng,
        daily: d.daily,
        sources: d.sources,
        advisories: d.advisories,
      });
    }),
    notes: "",
    checklist: checklist.map((text) => ({ id: uid(), text, done: false })),
    actual: {},
    warnings,
    flightAllowance: r.flights ? 7000 * travelers(r) : 0,
  });
}
export function dayCost(day: TripDay) {
  return (
    day.stay +
    day.food +
    day.transport +
    day.activities.reduce((sum, a) => sum + a.cost, 0)
  );
}
export function budgetSummary(trip: Trip) {
  const categories: Record<string, number> = Object.fromEntries(
    expenseCategories.map((c) => [c, 0]),
  );
  categories.Transportation = trip.flightAllowance;
  for (const d of trip.days) {
    categories.Accommodation += d.stay;
    categories.Food += d.food;
    categories.Transportation += d.transport;
    for (const a of d.activities) categories[a.category] += a.cost;
  }
  const planned = Object.values(categories).reduce((a, b) => a + b, 0);
  const budget = totalBudget(trip.request);
  const reserve = Math.round((budget * trip.request.reserve) / 100);
  const total = planned + reserve;
  return {
    categories,
    planned,
    reserve,
    total,
    budget,
    remaining: budget - total,
    perPerson: Math.ceil(total / travelers(trip.request)),
    daily: Math.ceil(total / trip.days.length),
    actual: Object.values(trip.actual).reduce((a, b) => a + b, 0),
  };
}
export function validateDay(day: TripDay): string[] {
  const warnings: string[] = [];
  if (day.transfer)
    warnings.push(
      "Connection unverified: this full-day buffer does not guarantee that the route operates or fits in one day.",
    );
  let last: Activity | undefined;
  for (const a of day.activities) {
    const start = minutes(a.start),
      end = start + a.duration;
    if (end > 24 * 60) warnings.push(`${a.name}: ends after midnight.`);
    if (last) {
      const gap = start - minutes(last.start) - last.duration;
      if (gap < 0) warnings.push(`${a.name}: overlaps with ${last.name}.`);
      else if (a.lat !== null && last.lat !== null && gap < 45)
        warnings.push(
          `${a.name}: allow at least a 45-minute planning buffer; actual transfer time is unverified.`,
        );
      if (
        a.cluster !== last.cluster &&
        a.cluster !== "local" &&
        last.cluster !== "local" &&
        a.lat !== null &&
        last.lat !== null
      )
        warnings.push(
          `${a.name}: travel between areas needs a confirmed route and duration.`,
        );
    }
    if (a.cluster === "boat")
      warnings.push(
        `${a.name}: verify boat service, permits, and local marine advisories.`,
      );
    last = a;
  }
  if (day.activities.reduce((n, a) => n + a.duration, 0) > 600 && !day.transfer)
    warnings.push(
      "More than 10 scheduled hours. Consider removing stops or adding rest.",
    );
  return [...new Set(warnings)];
}
export function reflow(activities: Activity[]): Activity[] {
  let cursor = 9 * 60;
  return activities.map((a) => {
    const next = { ...a };
    if (a.locked) cursor = Math.max(cursor, minutes(a.start) + a.duration + 45);
    else {
      next.start = clock(Math.min(cursor, 23 * 60));
      if (next.start !== a.start)
        next.sources = { ...a.sources, schedule: estimatedSource() };
      cursor += a.duration + 45;
    }
    return next;
  });
}
export function regenerateDay(trip: Trip, index: number, variant = 1): Trip {
  const next = structuredClone(trip),
    old = next.days[index];
  if (old.transfer) return next;
  const generated = makeDay(
    next.request,
    old.destination,
    index,
    index,
    variant,
  );
  const locked = old.activities.filter((a) => a.locked);
  generated.id = old.id;
  generated.activities = [
    ...locked,
    ...generated.activities.filter(
      (a) =>
        !locked.some((l) => l.name === a.name) &&
        !locked.some(
          (l) =>
            minutes(a.start) < minutes(l.start) + l.duration &&
            minutes(a.start) + a.duration > minutes(l.start),
        ),
    ),
  ].sort((a, b) => minutes(a.start) - minutes(b.start));
  next.days[index] = generated;
  return next;
}
export const disruptions = [
  "Heavy rain",
  "Severe weather",
  "Cancelled ferry",
  "Flight delay",
  "Attraction closure",
  "Traffic disruption",
  "Unexpected fatigue",
  "Reduced budget",
] as const;
export function alternativePlan(
  trip: Trip,
  index: number,
  scenario: string,
): Trip {
  const next = structuredClone(trip);
  const day = next.days[index];
  day.activities = day.activities.map((a) => {
    if (a.locked) return a;
    const impacted =
      scenario === "Severe weather"
        ? a.kind !== "Rest"
        : scenario === "Cancelled ferry"
          ? a.cluster === "boat" || a.kind === "Travel"
          : scenario === "Flight delay" || scenario === "Traffic disruption"
            ? a.kind === "Travel"
            : scenario === "Attraction closure"
              ? a.kind !== "Food" && a.kind !== "Rest" && a.kind !== "Travel"
              : scenario === "Unexpected fatigue"
                ? a.outdoor
                : scenario === "Reduced budget"
                  ? a.cost > 0 && a.kind !== "Food"
                  : a.outdoor;
    if (!impacted) return a;
    return {
      ...blankActivity(
        scenario === "Severe weather"
          ? "Stay at accommodation & follow official advice"
          : "Flexible rest at your accommodation",
        a.start,
      ),
      id: a.id,
      duration: a.duration,
      description: `Plan B for ${scenario.toLowerCase()}. No replacement venue, transport, or availability is assumed. Confirm any booking changes.`,
      provenance: "demo" as const,
    };
  });
  return next;
}
export function modifyBudget(
  trip: Trip,
  direction: "cheaper" | "upgrade",
): Trip {
  const next = structuredClone(trip);
  next.days = next.days.map((d) => ({
    ...d,
    activities: d.activities.map((a) =>
      direction === "cheaper" && !a.locked && a.cost > 0 && a.kind !== "Food"
        ? {
            ...blankActivity(
              "Free time instead of optional paid activity",
              a.start,
            ),
            duration: a.duration,
            id: a.id,
          }
        : a,
    ),
  }));
  if (direction === "upgrade") {
    next.request.tier = "Premium";
    next.days.forEach((d, i) => {
      if (next.request.accommodation && i < next.days.length - 1)
        d.stay = Math.max(
          d.stay,
          4500 * Math.ceil(travelers(next.request) / 2),
        );
    });
  }
  return next;
}
