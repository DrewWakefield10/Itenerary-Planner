import { destination, selectableDestinations, type Stop } from "./destinations";
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
import {activityKeys, conflictsWithUsed, markUsed, mentioned, visitStart, closeEnough, addableStop} from "./catalog/planning";
import {matchesPlacePreferences,placeTypeLabels} from "./catalog/place-types";
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
    placeTypes: [],
    geography:null,
    name,
    catalogStopId: null,
    canonicalStopId: null,
    entryPrice: null,
    visitMode: "local",
    transferMinutes: 45,
    bookingRequired: false,
    includedStopIds: [],
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
    description: s.description,
    geography:s.geography?structuredClone(s.geography):null,
    catalogStopId: s.id,
    placeTypes: [...(s.placeTypes||[])],
    canonicalStopId: s.canonicalId,
    entryPrice: structuredClone(s.entryPrice),
    visitMode: s.mode,
    transferMinutes: s.transferMinutes,
    bookingRequired: s.requiresBooking,
    includedStopIds: [...s.includes],
    lat: s.lat,
    lng: s.lng,
    duration: s.mode === "local" ? s.minutes : Math.max(480, s.minutes),
    cost: s.cost * (s.costBasis === "group" ? 1 : travelers(r)),
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
      description: structuredClone(s.sources.description),
      schedule: defaultFactSources().schedule,
    },
    advisories: structuredClone(s.advisories),
    booking: s.booking,
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
  return [...selectableDestinations]
    .sort((a, b) => {
      const score = (d: typeof a) =>
        interests.reduce((n, i) => n + (d.tags.includes(map[i]) ? 3 : 0), 0) +
        (d.daily * 3 <= budget ? 2 : 0);
      return score(b) - score(a) || a.daily - b.daily;
    })
    .slice(0, 3);
}
/** One eligibility policy for demo generation, regeneration and AI proposals. */
export function candidateStops(r:TripRequest,slug:string,index:number,used=new Set<string>()) {
  const d=destination(slug);
  if(!d)return [];
  const economy=totalBudget(r)*(1-r.reserve/100)/r.days/travelers(r)<d.daily||r.tier==="Budget"||r.tier==="Backpacker";
  const arrival=index===0,departure=index===r.days-1;
  return d.stops.filter(s=>s.baseSlug===slug&&s.distinct&&addableStop(s)&&(matchesPlacePreferences(s,r)||(!r.activityCategories.length&&mentioned(s,r.must)))
    &&!conflictsWithUsed(s,used,d.stops)&&!mentioned(s,r.avoid)
    &&(!s.requiresBooking||mentioned(s,r.reservations))
    &&(s.mode==="local"||(r.includeExcursions&&!arrival&&!departure&&!economy&&!r.accessibility))
    &&visitStart(s,dateOffset(r.startDate,index),arrival?14*60:9*60,departure?12*60+15:18*60,s.mode==="local"?s.minutes:Math.max(480,s.minutes))!==null);
}
/** Fisher-Yates with a reproducible seed for tests/imported requests. A fresh
 * request without a seed gets fresh choices; priorities are applied afterwards. */
function shuffled<T>(items:T[],seed:string) {
  let state=2166136261;
  for(const c of seed){state^=c.charCodeAt(0);state=Math.imul(state,16777619);}
  const random=()=>{state+=0x6D2B79F5;let t=Math.imul(state^(state>>>15),1|state);t^=t+Math.imul(t^(t>>>7),61|t);return ((t^(t>>>14))>>>0)/4294967296;};
  const result=[...items];
  for(let i=result.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[result[i],result[j]]=[result[j],result[i]];}
  return result;
}
export function makeDay(
  r: TripRequest, slug: string, index: number, localIndex: number,
  variant = 0, used = new Set<string>(), selectedIds?:string[],
): TripDay {
  const d = destination(slug)!;
  const n = travelers(r);
  const available = totalBudget(r) * (1-r.reserve/100) / r.days / n;
  const economy = available < d.daily || r.tier === "Budget" || r.tier === "Backpacker";
  const date = dateOffset(r.startDate,index);
  const arrival = index === 0, departure = index === r.days-1;
  const dayEnd = departure ? 12*60+15 : 18*60;
  const start = arrival ? 14*60 : 9*60;
  const score = (s:Stop) => (mentioned(s,r.must)?100:0) + s.interests.filter(i=>r.interests.includes(i)).length*10 - (economy?s.cost/50:s.cost/1000);
  let pool=shuffled(candidateStops(r,slug,index,used),`${r.randomSeed||uid()}:${slug}:${index}:${variant}`);
  pool.sort((a,b)=>score(b)-score(a)||a.cost-b.cost);
  if(selectedIds)pool=selectedIds.flatMap(id=>pool.find(s=>s.id===id)||[]);
  // Explicit excursion opt-in reserves one whole day; never append other visits.
  const excursion = !selectedIds&&r.includeExcursions && localIndex%2===1 ? pool.find(s=>s.mode!=="local") : undefined;
  if(excursion)pool=[excursion,...pool.filter(s=>s!==excursion)];
  const activities:Activity[]=[];
  if(arrival)activities.push({...blankActivity("Arrival & check-in buffer","09:00","Travel"),duration:240,
    description:`Travel from ${r.departure} is not verified. Confirm arrival before accepting afternoon activities. Move them if your journey needs a full day.`,transport:"No departure schedule or direct connection assumed.",provenance:"demo"});
  let cursor=start;
  let first:Stop|undefined;
  let previous:Stop|undefined;
  const target=arrival||r.pace==="Chill"?1:r.pace==="Balanced"?2:3;
  for(const s of pool) {
    if(first&&(s.mode!=="local"||!closeEnough(first,s)||!closeEnough(previous!,s)))continue;
    if(conflictsWithUsed(s,used,d.stops))continue;
    const duration=s.mode!=="local"?Math.max(480,s.minutes):s.minutes;
    const begins=visitStart(s,date,cursor,dayEnd,duration);
    if(begins===null)continue;
    const activity=fromStop(s,r,clock(begins));
    activity.duration=duration;
    if(s.mode!=="local"){
      activity.description += " Reserve this full block for the visit and transfers. Confirm the route, booking and return time; this is not a timetable.";
      activity.sources.description=estimatedSource();
    }
    activities.push(activity);markUsed(s,used,d.stops);
    first ??= s;
    previous=s;
    cursor=begins+duration+Math.max(45,s.transferMinutes);
    if(s.mode!=="local"||activities.filter(a=>a.catalogStopId).length>=target)break;
  }
  const visits=activities.filter(a=>a.catalogStopId);
  // A flexible meal placeholder uses the day's food budget, not a repeated venue
  // or another admission allowance. Its location and availability remain unknown.
  if(!departure&&(!first||first.mode==="local")) {
    const meal=blankActivity("Flexible meal break",clock(Math.max(arrival?18*60:12*60+30,cursor)),"Food");
    meal.description=`Meal ideas: ${d.food} Use the day's food allowance. Confirm a venue and dietary needs locally.`;
    meal.duration=60;meal.provenance="demo";
    activities.push(meal);cursor=minutes(meal.start)+meal.duration+45;
  }
  if(!departure)activities.push({...blankActivity(r.pace==="Chill"?"A long, unhurried rest":"Free time & a little breathing room",clock(Math.min(21*60,Math.max(16*60+30,cursor)))),
    duration:r.pace==="Chill"?120:60,provenance:"demo",
    description:visits.length<target&&first?.mode!=="excursion"&&first?.mode!=="package"?`Too few suitable unique stops fit this date, preferences and remaining time (${visits.length} of up to ${target} visits). No off-category substitute or duplicate was added.`:"Keep this time open. No activity or reservation is assumed."});
  else {
    if(!visits.length)activities.push({...blankActivity("An open morning","09:00"),description:"Too few suitable unique stops fit before departure. Browse alternatives; no duplicate visit was added.",provenance:"demo"});
    activities.push({...blankActivity("Departure & onward travel buffer","13:00","Travel"),duration:300,description:"Confirm transport and check-out. This is a reserved buffer, not a transport timetable.",provenance:"demo"});
  }
  return {id:uid(),date,destination:slug,title:arrival?"Arrive, settle in, take it slow":departure?"One last look, then onward":`${d.name}, at your own pace`,transfer:false,
    activities:activities.sort((a,b)=>minutes(a.start)-minutes(b.start)),
    stay:r.accommodation&&!departure?(economy?800:r.tier==="Premium"?4500:2000)*Math.ceil(n/2):0,
    food:Math.max(0,(economy?350:550)*n-activities.filter(a=>a.kind==="Food").reduce((sum,a)=>sum+a.cost,0)),transport:(economy?200:400)*n};
}
export function hasSelectionShortage(days:TripDay[],r:TripRequest){
  return days.some((d,index)=>{
    if(d.transfer)return false;
    const visits=d.activities.filter(a=>a.catalogStopId);
    if(visits.some(a=>a.visitMode!=="local"))return false;
    const target=index===0||r.pace==="Chill"?1:r.pace==="Balanced"?2:3;
    return visits.length<target;
  });
}
export function refreshSelectionWarnings(trip:Trip){
  trip.warnings=trip.warnings.filter(w=>!w.startsWith("Some days have too few suitable")&&!w.includes(" scheduled. Choices are limited")&&!w.startsWith("Requested places not scheduled:"));
  if(hasSelectionShortage(trip.days,trip.request))trip.warnings.push("Some days have too few suitable unique stops. Open time is retained instead of adding unrelated or repeated places; excursions need a full day and explicit opt-in.");
  for(const slug of trip.request.destinations)for(const type of trip.request.activityCategories){
    const count=trip.days.filter(d=>d.destination===slug).flatMap(d=>d.activities).filter(a=>a.placeTypes.includes(type)).length;
    trip.warnings.push(`${destination(slug)!.name}: ${count} ${placeTypeLabels[type].toLowerCase()} scheduled. Choices are limited to matching catalog places that fit dates, clusters, booking constraints and remaining time; no substitutes are assumed.`);
  }
  const used=new Set(trip.days.flatMap(d=>d.activities.flatMap(a=>[...activityKeys(a,destination(d.destination)!.stops)])));
  const missing=trip.request.destinations.flatMap(slug=>destination(slug)!.stops).filter(s=>mentioned(s,trip.request.must)&&!used.has(s.canonicalId));
  if(missing.length)trip.warnings.push(`Requested places not scheduled: ${missing.map(s=>s.name).join(", ")}. Check categories, hours, booking, excursion opt-in and available days.`);
  return trip;
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
  const used = new Set<string>();
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
    for (let j = 0; j < count; j++) days.push(makeDay(r, slug, days.length, j, 0, used));
  });
  const warnings = [
    "All costs are planning allowances, not quotes. Operating hours, transport times, availability, and map locations need confirmation.",
    "Airport/terminal access and local transport allowances are estimates; replace them with confirmed costs.",
  ];
  if(hasSelectionShortage(days,r))warnings.push("Some days have too few suitable unique stops. Open time is retained instead of adding unrelated or repeated places; excursions need a full day and explicit opt-in.");
  for(const slug of r.destinations)for(const category of r.activityCategories){
    const scheduled=days.filter(d=>d.destination===slug).flatMap(d=>d.activities).filter(a=>a.placeTypes.includes(category)).length;
    warnings.push(`${destination(slug)!.name}: ${scheduled} ${placeTypeLabels[category].toLowerCase()} scheduled. Choices are limited to matching catalog places that fit dates, clusters, booking constraints and remaining time; no substitutes are assumed.`);
  }
  if(r.accessibility)warnings.push("Step-free access is unknown at most stops. Local suggestions are provisional; confirm your specific requirements with venues before relying on them.");
  const missingMust=r.must && r.destinations.flatMap(slug=>destination(slug)!.stops).filter(s=>mentioned(s,r.must)&&!used.has(s.canonicalId));
  if(missingMust&&missingMust.length)warnings.push(`Requested places not scheduled: ${missingMust.map(s=>s.name).join(", ")}. Check hours, booking, excursion opt-in and available days.`);
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
        a.kind !== "Rest" && last.kind !== "Rest"
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
  const catalog = destination(old.destination)!.stops;
  const used = new Set(next.days.flatMap((d,i)=>d.activities.filter(a=>i!==index||a.locked).flatMap(a=>[...activityKeys(a,catalog)])));
  const generated = makeDay(
    next.request,
    old.destination,
    index,
    index,
    variant,
    used,
  );
  const locked = old.activities.filter((a) => a.locked);
  generated.id = old.id;
  generated.activities = [
    ...locked,
    ...generated.activities.filter(
      (a) =>
        (!a.catalogStopId || locked.every(l=>{
          if(!l.catalogStopId)return true;
          const original=catalog.find(s=>s.id===l.catalogStopId),candidate=catalog.find(s=>s.id===a.catalogStopId);
          return !!original&&!!candidate&&l.visitMode==="local"&&a.visitMode==="local"&&l.cluster===a.cluster&&closeEnough(original,candidate);
        })) &&
        !locked.some((l) => l.name === a.name) &&
        !locked.some(
          (l) =>
            minutes(a.start) < minutes(l.start) + l.duration + (a.catalogStopId&&l.catalogStopId?Math.max(45,l.transferMinutes):0) &&
            minutes(a.start) + a.duration + (a.catalogStopId&&l.catalogStopId?Math.max(45,a.transferMinutes):0) > minutes(l.start),
        ),
    ),
  ].sort((a, b) => minutes(a.start) - minutes(b.start));
  next.days[index] = generated;
  return refreshSelectionWarnings(next);
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
