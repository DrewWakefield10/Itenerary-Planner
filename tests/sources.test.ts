import { test } from "node:test";
import assert from "node:assert/strict";
import { destination } from "../lib/destinations";
import {
  blankActivity,
  fromStop,
  generateDemo,
  regenerateDay,
  alternativePlan,
  reflow,
} from "../lib/engine";
import { updateActivityField } from "../lib/activity-sources";
import { defaultRequest, tripSchema } from "../lib/trip";
import { sourceMetadataSchema, sourceLabel } from "../lib/sources";
import { createProvider } from "../lib/provider";
import { saveTrip, readTrips } from "../lib/trip-storage";

const request = {
  ...defaultRequest,
  destinations: ["baguio"],
  days: 3,
  startDate: "2026-12-10",
};
test("seed facts retain individual status and sources through generation and JSON import/export", () => {
  const seed = destination("baguio")!.stops.find(
    (s) => s.name === "Burnham Park",
  )!;
  const trip = generateDemo(request);
  const generated = trip.days
    .flatMap((d) => d.activities)
    .find((a) => a.name === seed.name)!;
  assert.deepEqual(generated.sources.location, seed.sources.location);
  assert.equal(generated.sources.location.status, "verified");
  assert.equal(generated.sources.price.status, "estimate");
  assert.equal(generated.sources.price.dateChecked, null);
  assert.equal(generated.sources.coordinates.status, "unverified");
  assert.equal(generated.sources.accessibility.status, "unverified");
  assert.equal(generated.sources.description.status, "unverified");
  assert.equal(generated.sources.schedule.status, "estimate");
  assert.ok(
    generated.advisories[0].source.sourceUrl?.includes("pagasa.dost.gov.ph"),
  );
  assert.equal(sourceLabel(generated.sources.location), "Checked Oct. 2026");
  assert.deepEqual(tripSchema.parse(JSON.parse(JSON.stringify(trip))), trip);
  assert.deepEqual(
    trip.destinationInfo[0].sources.location,
    destination("baguio")!.sources.location,
  );
  generated.sources.location.sourceName = "Changed copy";
  assert.notEqual(seed.sources.location.sourceName, "Changed copy");
});

test("old trips retain legacy source strings and get conservative undated metadata", () => {
  const trip = generateDemo(request);
  const legacy = JSON.parse(JSON.stringify(trip));
  delete legacy.destinationInfo;
  for (const day of legacy.days)
    for (const activity of day.activities) {
      delete activity.sources;
      delete activity.locationDetails;
      delete activity.accessibility;
      delete activity.advisories;
      activity.source = "Original legacy source";
    }
  const parsed = tripSchema.parse(legacy);
  assert.deepEqual(parsed.destinationInfo, []);
  for (const day of parsed.days)
    for (const a of day.activities) {
      assert.equal(a.source, "Original legacy source");
      assert.equal(a.sources.location.status, "unverified");
      assert.equal(a.sources.location.dateChecked, null);
      assert.equal(a.sources.location.sourceUrl, null);
      assert.equal(a.sources.price.status, "estimate");
      assert.deepEqual(a.advisories, []);
    }
  assert.ok(tripSchema.safeParse(JSON.parse(JSON.stringify(parsed))).success);
});

test("saving and loading retain metadata; older local records remain readable", () => {
  const storage = new Map<string, string>();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalStorage = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  Object.defineProperty(globalThis, "window", {
    value: {},
    configurable: true,
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
    },
    configurable: true,
  });
  try {
    const trip = generateDemo(request);
    assert.ok(saveTrip(trip));
    assert.deepEqual(readTrips()[0], trip);
    const legacy = JSON.parse(JSON.stringify(trip));
    for (const day of legacy.days)
      for (const a of day.activities) delete a.sources;
    storage.set("lakbay:trips", JSON.stringify([legacy]));
    assert.equal(readTrips().length, 1);
    assert.ok(
      readTrips()[0].days.every((d) =>
        d.activities.every((a) => a.sources.location.status === "unverified"),
      ),
    );
  } finally {
    if (originalWindow)
      Object.defineProperty(globalThis, "window", originalWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (originalStorage)
      Object.defineProperty(globalThis, "localStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("editing invalidates affected facts only, and replacement takes the new seed evidence", () => {
  const stop = destination("baguio")!.stops.find(
    (s) => s.name === "Burnham Park",
  )!;
  const activity = fromStop(stop, request, "09:00");
  const timeEdit = updateActivityField(activity, "start", "10:00");
  assert.deepEqual(timeEdit.sources.location, activity.sources.location);
  assert.equal(timeEdit.sources.schedule.status, "estimate");
  const priceEdit = updateActivityField(timeEdit, "cost", 1234);
  assert.equal(priceEdit.sources.price.status, "estimate");
  assert.deepEqual(priceEdit.sources.location, activity.sources.location);
  const coordinateEdit = updateActivityField(activity, "lat", 16.5);
  assert.equal(coordinateEdit.sources.coordinates.status, "unverified");
  assert.deepEqual(coordinateEdit.sources.location, activity.sources.location);
  const rename = updateActivityField(activity, "name", "A different place");
  assert.equal(rename.sources.location.status, "unverified");
  assert.equal(rename.sources.location.dateChecked, null);
  assert.notEqual(rename.locationDetails, activity.locationDetails);
  const replacement = fromStop(destination("cebu")!.stops[0], request, "09:00");
  assert.equal(
    replacement.sources.location.sourceName,
    "National Museum of the Philippines — Cebu museum inauguration",
  );
  assert.deepEqual(activity.sources.location, stop.sources.location);
});

test("regeneration, Plan B, and user-created activities never transfer verification to new claims", () => {
  const trip = generateDemo(request);
  const original = trip.days[0].activities.find(
    (a) => a.name === "Burnham Park",
  )!;
  original.locked = true;
  const regenerated = regenerateDay(trip, 0);
  assert.deepEqual(
    regenerated.days[0].activities.find((a) => a.id === original.id),
    original,
  );
  original.locked = false;
  const proposal = alternativePlan(trip, 0, "Heavy rain");
  const replacement = proposal.days[0].activities.find(
    (a) => a.id === original.id,
  )!;
  assert.equal(replacement.sources.location.status, "unverified");
  assert.equal(replacement.sources.price.status, "estimate");
  assert.deepEqual(
    trip.days[0].activities.find((a) => a.id === original.id)!.sources.location,
    original.sources.location,
  );
  const blank = blankActivity("Traveler-added venue");
  assert.ok(
    Object.values(blank.sources).every(
      (s) => s.status !== "verified" && s.dateChecked === null,
    ),
  );
  assert.deepEqual(
    reflow([original])[0].sources.location,
    original.sources.location,
  );
});

test("AI editorial personalization preserves evidence without verifying generated content", async () => {
  const previousFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      Response.json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                title: "A Baguio journal",
                dayTitles: ["Arrive", "Explore", "Depart"],
                notes: "Generated editorial note",
              }),
            },
          },
        ],
      });
    const trip = await createProvider({
      key: "test",
      url: "https://example.com/chat",
      model: "fixture",
    }).generateItinerary(request);
    const stop = trip.days
      .flatMap((d) => d.activities)
      .find((a) => a.name === "Burnham Park")!;
    assert.equal(trip.mode, "ai");
    assert.equal(stop.sources.location.status, "verified");
    assert.equal(stop.sources.description.status, "unverified");
    assert.equal(stop.sources.price.status, "estimate");
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("incomplete verification, impossible check dates, and unsafe source URLs are rejected on import", () => {
  assert.equal(
    sourceMetadataSchema.safeParse({
      sourceName: null,
      sourceUrl: null,
      dateChecked: null,
      status: "verified",
    }).success,
    false,
  );
  const trip = generateDemo(request);
  const source = trip.days[0].activities[0].sources.location;
  Object.assign(source, {
    sourceName: "Invalid import",
    sourceUrl: "javascript:alert(1)",
    dateChecked: "2026-10-18",
    status: "verified",
  });
  assert.equal(tripSchema.safeParse(trip).success, false);
  Object.assign(source, {
    sourceUrl: "https://example.com",
    dateChecked: "2026-02-30",
  });
  assert.equal(tripSchema.safeParse(trip).success, false);
});
