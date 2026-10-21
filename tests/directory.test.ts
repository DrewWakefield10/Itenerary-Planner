import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  directoryCandidates,
  directoryListings,
  directoryTargets,
  destinationGroups,
  directoryCategories,
  filterDirectory,
} from "../lib/catalog/directory";
import { directoryCandidateSchema } from "../lib/catalog/directory-schema";
import {
  discoveryPlace,
  nearbyDiscoveries,
  discoveryStop,
} from "../lib/discovery";
import { generateDemo } from "../lib/engine";
import { defaultRequest, tripSchema } from "../lib/trip";
import {
  previewDiscoveryAddition,
  acceptDiscoveryAddition,
} from "../lib/discovery-planning";
import { updateActivityField } from "../lib/activity-sources";

test("250 candidates retain decisions; 200 unique accepted identities and municipalities cover every browsing destination", () => {
  assert.equal(directoryCandidates.length, 250);
  assert.equal(directoryListings.length, 200);
  assert.equal(new Set(directoryCandidates.map((p) => p.id)).size, 250);
  for (const p of directoryCandidates)
    assert.ok(directoryCandidateSchema.safeParse(p).success, p.id);
  for (const group of destinationGroups) {
    const places = directoryListings.filter(
      (p) => p.destination_group === group,
    );
    assert.equal(places.length, directoryTargets[group], group);
    assert.equal(
      new Set(places.map((p) => p.name.normalize("NFKD").toLowerCase())).size,
      places.length,
    );
    for (const p of places) {
      assert.equal(p.sources.identity.status, "verified");
      assert.equal(p.sources.municipality.status, "verified");
      assert.ok(p.city_municipality);
    }
  }
  const bad = { ...directoryListings[0], city_municipality: null };
  assert.equal(directoryCandidateSchema.safeParse(bad).success, false);
  const pin = { ...directoryListings[0], latitude: 200, longitude: 120 };
  assert.equal(directoryCandidateSchema.safeParse(pin).success, false);
});
test("browsing groups preserve actual jurisdictions, outlying locations and unknown coordinates", () => {
  assert.ok(
    new Set(
      filterDirectory({ group: "Manila" }).map((p) => p.city_municipality),
    ).size >= 7,
  );
  assert.ok(
    filterDirectory({ group: "Manila" }).every(
      (p) => p.region === "National Capital Region" && p.province === null,
    ),
  );
  assert.ok(
    filterDirectory({ group: "Cebu" }).some(
      (p) => p.city_municipality === "Badian" && p.itinerary_base_slug === null,
    ),
  );
  assert.ok(
    filterDirectory({ group: "Palawan" }).some(
      (p) =>
        p.city_municipality === "San Vicente" && p.itinerary_base_slug === null,
    ),
  );
  assert.ok(
    filterDirectory({ group: "Boracay" }).every(
      (p) => p.city_municipality === "Malay" && p.province === "Aklan",
    ),
  );
  assert.ok(
    filterDirectory({ group: "Iloilo" }).some(
      (p) => p.city_municipality !== "Iloilo City",
    ),
  );
  assert.ok(
    filterDirectory({ group: "Siargao" }).some(
      (p) => p.city_municipality === "Socorro",
    ),
  );
  for (const p of directoryListings) {
    assert.equal(p.latitude === null, p.longitude === null);
    if (p.latitude !== null) assert.ok(p.sources.coordinates.sourceUrl, p.id);
    assert.equal(
      discoveryPlace(p.id)?.directory?.city_municipality,
      p.city_municipality,
    );
  }
});
test("destination, category, interest and municipality search compose rather than overriding each other", () => {
  for (const group of destinationGroups)
    for (const category of directoryCategories) {
      const result = filterDirectory({ group, category });
      assert.ok(
        result.every(
          (p) => p.destination_group === group && p.category === category,
        ),
      );
    }
  const p = directoryListings.find((p) => p.city_municipality === "Dauis")!;
  assert.ok(
    filterDirectory({
      group: "Bohol",
      category: p.category,
      search: "DAUIS",
    }).some((r) => r.id === p.id),
  );
  assert.equal(filterDirectory({ group: "Baguio", search: "Dauis" }).length, 0);
  assert.ok(
    filterDirectory({ interest: "Food Hunter" }).every((p) =>
      p.interests.includes("Food Hunter"),
    ),
  );
  assert.equal(
    filterDirectory({ search: "a place that does not exist in this directory" })
      .length,
    0,
  );
});
test("directory sources and administrative addresses survive preview, acceptance, import and editing; nearby stays within one base", () => {
  const trip = generateDemo({
    ...defaultRequest,
    startDate: "2026-12-10",
    destinations: ["baguio"],
    days: 3,
  });
  for (const day of trip.days) day.activities = [];
  const p = discoveryPlace("baguio-botanical-garden")!;
  const before = JSON.stringify(trip),
    preview = previewDiscoveryAddition(trip, 1, p.id, "10:00");
  assert.equal(JSON.stringify(trip), before);
  const accepted = acceptDiscoveryAddition(trip, preview),
    activity = accepted.days[1].activities[0];
  assert.equal(activity.geography?.city_municipality, "Baguio City");
  assert.deepEqual(
    activity.geography?.sources.municipality,
    p.directory?.sources.municipality,
  );
  assert.deepEqual(
    tripSchema.parse(JSON.parse(JSON.stringify(accepted))),
    accepted,
  );
  assert.equal(
    updateActivityField(activity, "name", "Another place").geography,
    null,
  );
  const old = JSON.parse(JSON.stringify(accepted));
  for (const day of old.days)
    for (const a of day.activities) delete a.geography;
  assert.equal(tripSchema.parse(old).days[1].activities[0].geography, null);
  const unlinked = directoryListings.find(
    (p) => p.itinerary_base_slug === null,
  )!;
  assert.throws(
    () => previewDiscoveryAddition(trip, 1, unlinked.id, "10:00"),
    /exact overnight base/,
  );
  for (const slug of [
    "baguio",
    "cebu",
    "el-nido",
    "coron",
    "puerto-princesa",
    "iloilo",
  ]) {
    const nearby = nearbyDiscoveries(slug);
    assert.ok(
      nearby.spots.every(
        ({ place }) =>
          place.baseSlug === slug && discoveryStop(place)?.mode === "local",
      ),
    );
  }
});
test("combined exported JSON and progress reflect accepted data, preserving practical facts separately", () => {
  const rows = JSON.parse(
    readFileSync("public/data/lakbay-locations.json", "utf8"),
  );
  const progress = JSON.parse(
    readFileSync("public/data/research-progress.json", "utf8"),
  );
  assert.equal(rows.length, 200);
  assert.equal(progress.totals.researched, 250);
  assert.equal(progress.totals.accepted, 200);
  assert.ok(
    progress.destinations.every(
      (d: { shortfall: number }) => d.shortfall === 0,
    ),
  );
  assert.deepEqual(
    new Set(rows.map((r: { id: string }) => r.id)),
    new Set(directoryListings.map((p) => p.id)),
  );
  const unknown = rows.find((p: { practical: unknown }) => !p.practical);
  assert.ok(unknown);
  assert.equal(unknown.latitude, null);
  for (const row of rows)
    if (row.practical?.entry_price.amount === null)
      assert.notEqual(row.practical.entry_price.source.status, "verified");
});
