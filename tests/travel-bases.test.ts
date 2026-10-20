import { test } from "node:test";
import assert from "node:assert/strict";
import { destination, destinations, selectableDestinations, templates } from "../lib/destinations";
import { generateDemo, fromStop, recommendDestinations, regenerateDay } from "../lib/engine";
import { destinationCenter, activityLocation } from "../lib/map-locations";
import { defaultRequest, requestSchema, tripSchema } from "../lib/trip";
import { readTrips, saveTrip } from "../lib/trip-storage";

const bases = ["el-nido", "coron", "puerto-princesa"];
const request = {...defaultRequest, startDate: "2026-12-10", days: 5};

test("Palawan bases validate independently and discovery never offers the legacy parent", () => {
  assert.deepEqual(selectableDestinations.filter(d => d.province === "Palawan").map(d => d.slug), bases);
  assert.equal(new Set(destinations.map(d => d.slug)).size, destinations.length);
  for (const slug of bases) {
    assert.ok(requestSchema.safeParse({...request, destinations: [slug]}).success);
    assert.ok(destination(slug)!.stops.length >= 3);
  }
  assert.ok(!selectableDestinations.some(d => d.slug === "palawan"));
  assert.ok(!recommendDestinations(["Beach Bum"]).some(d => d.slug === "palawan"));
  assert.ok(templates.every(t => !t.slugs.includes("palawan")));
});

test("each base generates its own stops and evidence survives regeneration and JSON round trips", () => {
  for (const slug of bases) {
    const d = destination(slug)!;
    const trip = generateDemo({...request, destinations: [slug]});
    const activities = trip.days.flatMap(day => day.activities).filter(a => a.lat !== null);
    assert.ok(activities.length);
    assert.ok(trip.days.every(day => day.destination === slug && !day.transfer));
    for (const a of activities) {
      const stop = d.stops.find(s => s.name === a.name);
      assert.ok(stop, `${a.name} must belong to ${slug}`);
      assert.deepEqual(activityLocation(a), [stop.lat, stop.lng]);
      assert.deepEqual(a.sources.coordinates, stop.sources.coordinates);
      assert.deepEqual(a.sources.location, stop.sources.location);
      assert.equal(a.sources.price.status, "estimate");
      assert.deepEqual(a.sources.description, stop.sources.description);
    }
    assert.equal(trip.destinationInfo[0].slug, slug);
    assert.deepEqual(tripSchema.parse(JSON.parse(JSON.stringify(trip))), trip);
    const changed = regenerateDay(trip, 1);
    assert.ok(changed.days[1].activities.filter(a => a.lat !== null).every(a => d.stops.some(s => s.name === a.name)));
  }
});

test("map fallback centers identify towns, and stop pins retain their own coordinates", () => {
  const centers: Record<string, [number, number]> = {
    "el-nido": [11.18056, 119.39083],
    coron: [11.9975, 120.20556],
    "puerto-princesa": [9.740696, 118.730072],
  };
  for (const slug of bases) {
    assert.deepEqual(destinationCenter(slug), centers[slug]);
    const stop = destination(slug)!.stops[0];
    const a = fromStop(stop, request, "09:00");
    assert.deepEqual(activityLocation(a), [stop.lat, stop.lng]);
    assert.notDeepEqual(activityLocation(a), destinationCenter(slug));
  }
  assert.equal(activityLocation({lat: null, lng: null}), null);
});

test("changing overnight bases reserves one connection day per change, even within Palawan", () => {
  for (const slugs of [bases.slice(0, 2), bases]) {
    const trip = generateDemo({...request, destinations: slugs, days: slugs.length === 2 ? 5 : 8});
    const connections = trip.days.filter(d => d.transfer);
    assert.equal(connections.length, slugs.length - 1);
    assert.deepEqual(connections.map(d => d.destination), slugs.slice(1));
    assert.ok(connections.every(d => d.activities[0].sources.transport.status === "unverified"));
    assert.ok(tripSchema.safeParse(trip).success);
    for (const day of trip.days.filter(d => !d.transfer))
      assert.ok(day.activities.filter(a => a.lat !== null).every(a => destination(day.destination)!.stops.some(s => s.name === a.name)));
  }
  assert.equal(requestSchema.safeParse({...request, destinations: bases, days: 7}).success, false);
});

test("Baguio's central and Leonard Wood clusters remain stops in one overnight base", () => {
  const trip = generateDemo({...request, destinations: ["baguio"], days: 6});
  assert.deepEqual(trip.request.destinations, ["baguio"]);
  assert.equal(trip.destinationInfo.length, 1);
  assert.ok(trip.days.every(d => d.destination === "baguio" && !d.transfer));
  const clusters = new Set(trip.days.flatMap(d => d.activities).filter(a => a.lat !== null).map(a => a.cluster));
  assert.ok(clusters.has("central") && clusters.has("leonard-wood"));
  for (const name of ["Baguio Botanical Garden", "Wright Park"]) {
    assert.ok(destination("baguio")!.stops.some(s => s.name === name && s.cluster === "leonard-wood"));
    assert.ok(!destinations.some(d => d.name === name));
  }
  for (const day of trip.days) {
    const pinned = day.activities.filter(a => a.lat !== null);
    assert.ok(new Set(pinned.map(a => a.cluster)).size <= 1);
  }
});

test("legacy palawan requests, imports, and browser storage retain their slug and traveler locations", () => {
  assert.ok(requestSchema.safeParse({...request, destinations: ["palawan"]}).success);
  const old = JSON.parse(JSON.stringify(generateDemo({...request, destinations: ["palawan"]})));
  delete old.destinationInfo;
  const stop = old.days[0].activities.find((a: {lat: number | null}) => a.lat !== null);
  stop.name = "My original Puerto Princesa stop";
  stop.lat = 9.740696; stop.lng = 118.730072;
  for (const day of old.days) for (const a of day.activities) {
    delete a.sources; delete a.disruptionSensitivities; delete a.openingHours;
  }
  const parsed = tripSchema.parse(old);
  assert.deepEqual(parsed.request.destinations, ["palawan"]);
  assert.ok(parsed.days.every(d => d.destination === "palawan"));
  const preserved = parsed.days[0].activities.find(a => a.id === stop.id)!;
  assert.equal(preserved.name, stop.name);
  assert.deepEqual(activityLocation(preserved), [stop.lat, stop.lng]);
  assert.equal(preserved.sources.coordinates.status, "unverified");
  assert.deepEqual(tripSchema.parse(JSON.parse(JSON.stringify(parsed))), parsed);
  const values = new Map<string, string>();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "window", {value: {}, configurable: true});
  Object.defineProperty(globalThis, "localStorage", {value: {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
  }, configurable: true});
  try {
    values.set("lakbay:trips", JSON.stringify([old]));
    assert.deepEqual(readTrips()[0], parsed);
    assert.ok(saveTrip(parsed));
    assert.deepEqual(readTrips()[0], parsed);
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
