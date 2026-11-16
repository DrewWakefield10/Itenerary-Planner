import { test } from "node:test";
import assert from "node:assert/strict";
import { discoveryPlaces, type DiscoveryPlace } from "../lib/discovery";
import {
  googleMapsTarget,
  googleMapsEmbedUrl,
  mapsEmbedConfig,
  mapsReferences,
  mapsReferenceSchema,
  validateMapsReferences,
  type MapsReference,
} from "../lib/google-maps";

const places = discoveryPlaces.filter((place) => place.directory);
const missing = places.find((place) => !place.coordinates)!;
function review(place = missing): MapsReference {
  return {
    lakbayId: place.id,
    expectedName: place.name,
    expectedMunicipality: place.directory!.city_municipality!,
    expectedAddress: place.directory!.address,
    placeId: "ChIJ_TEST_REFERENCE_NOT_A_REAL_MATCH",
    status: "verified",
    checkedOn: "2026-10-23",
    evidenceUrls: [
      "https://www.google.com/maps/search/?api=1&query=test",
      place.directory!.sources.identity.sourceUrl!,
    ],
    reviewNote:
      "Test fixture only: exact venue, branch and municipality reviewed; never published.",
  };
}

test("every accepted place has key-free Maps and directions links without new coordinates", () => {
  assert.ok(places.length > 0);
  const before = JSON.stringify(discoveryPlaces);
  for (const place of places) {
    const target = googleMapsTarget(place);
    const search = new URL(target.searchUrl),
      directions = new URL(target.directionsUrl);
    assert.equal(search.origin, "https://www.google.com");
    assert.equal(search.searchParams.get("api"), "1");
    assert.ok(target.query.includes(place.name));
    assert.ok(target.query.includes(place.directory!.city_municipality!));
    assert.equal(directions.searchParams.get("destination"), target.query);
    assert.equal(directions.searchParams.has("origin"), false);
    assert.equal(search.searchParams.has("key"), false);
    assert.ok(
      target.searchUrl.length < 2048 && target.directionsUrl.length < 2048,
    );
    assert.equal(target.canEmbed, true);
  }
  assert.equal(JSON.stringify(discoveryPlaces), before);
});

test("queries preserve exact names and branches, municipality and supported address, not browsing labels", () => {
  for (const group of ["Manila", "Davao", "Boracay", "Palawan", "Iloilo"]) {
    const place = places.find(
      (place) =>
        place.directory!.destination_group === group &&
        place.directory!.city_municipality !== group,
    )!;
    const target = googleMapsTarget(place);
    assert.ok(target.query.startsWith(place.name + ","));
    assert.ok(target.query.includes(place.directory!.city_municipality!));
  }
  const a = structuredClone(missing),
    b = structuredClone(missing);
  a.name = "Café A & B — Main Branch";
  b.name = "Café A & B — Other Branch";
  a.directory!.address = "Unreviewed shortcut address";
  a.directory!.sources.address.status = "unverified";
  const first = googleMapsTarget(a),
    second = googleMapsTarget(b);
  assert.notEqual(first.searchUrl, second.searchUrl);
  assert.equal(new URL(first.searchUrl).searchParams.get("query"), first.query);
  assert.ok(!first.query.includes("Unreviewed shortcut"));
});

test("a single manually reviewed reference selects the exact Google ID, never changing Lakbay identity", () => {
  const record = review();
  validateMapsReferences([record], places);
  const target = googleMapsTarget(missing, [record]);
  assert.equal(target.reviewed?.placeId, record.placeId);
  assert.equal(
    new URL(target.searchUrl).searchParams.get("query_place_id"),
    record.placeId,
  );
  assert.equal(
    new URL(target.directionsUrl).searchParams.get("destination_place_id"),
    record.placeId,
  );
  const embed = new URL(
    googleMapsEmbedUrl(target, { enabled: true, key: "fixture" })!,
  );
  assert.equal(embed.pathname, "/maps/embed/v1/place");
  assert.equal(embed.searchParams.get("q"), `place_id:${record.placeId}`);
  assert.equal(missing.id, record.lakbayId);
  assert.equal(missing.coordinates, undefined);
});

test("ambiguous, rejected, unresolved, conflicting and wrong-branch matches never become precise pins", () => {
  for (const status of ["ambiguous", "rejected", "unresolved"] as const) {
    const target = googleMapsTarget(missing, [{ ...review(), status }]);
    assert.equal(target.reviewed, null);
    assert.equal(target.mode, "search");
    assert.equal(
      new URL(target.searchUrl).searchParams.has("query_place_id"),
      false,
    );
  }
  for (const patch of [
    { expectedName: "Other branch" },
    { expectedMunicipality: "Other city" },
    { expectedAddress: "Different street" },
    { checkedOn: "2099-01-01" },
  ]) {
    assert.equal(
      googleMapsTarget(missing, [{ ...review(), ...patch }]).reviewed,
      null,
    );
    assert.throws(() =>
      validateMapsReferences([{ ...review(), ...patch }], places),
    );
  }
  assert.equal(googleMapsTarget(missing, [review(), review()]).reviewed, null);
  assert.throws(() => validateMapsReferences([review(), review()], places));
  assert.throws(() =>
    validateMapsReferences([{ ...review(), lakbayId: "unknown" }], places),
  );
  const other = places.find((place) => place.id !== missing.id)!;
  assert.equal(
    googleMapsTarget(missing, [review(), review(other)]).reviewed,
    null,
  );
  assert.throws(() =>
    validateMapsReferences([review(), review(other)], places),
  );
});

test("review records reject copied Google content, missing provenance, malformed URLs and missing IDs", () => {
  assert.equal(
    mapsReferenceSchema.safeParse({ ...review(), googleAddress: "Google data" })
      .success,
    false,
  );
  assert.equal(
    mapsReferenceSchema.safeParse({ ...review(), placeId: null }).success,
    false,
  );
  assert.equal(
    mapsReferenceSchema.safeParse({ ...review(), evidenceUrls: ["bad url"] })
      .success,
    false,
  );
  assert.equal(
    mapsReferenceSchema.safeParse({
      ...review(),
      evidenceUrls: ["https://www.google.com/maps/"],
    }).success,
    false,
  );
  assert.equal(
    mapsReferenceSchema.safeParse({ ...review(), checkedOn: "2026-02-31" })
      .success,
    false,
  );
  validateMapsReferences(mapsReferences, discoveryPlaces);
});

test("unreviewed and absent coordinates never center Google search, while verified points can bias it", () => {
  const config = { enabled: true, key: "fixture" };
  for (const place of places) {
    const target = googleMapsTarget(place);
    const embed = new URL(googleMapsEmbedUrl(target, config)!);
    assert.equal(embed.pathname, "/maps/embed/v1/search");
    assert.equal(
      embed.searchParams.has("center"),
      place.coordinates?.source.status === "verified",
    );
    if (target.point)
      assert.equal(
        embed.searchParams.get("center"),
        `${target.point.lat},${target.point.lng}`,
      );
  }
});

test("missing credentials, an explicit kill switch and unverified location identity disable embedding", () => {
  const target = googleMapsTarget(missing);
  for (const enabled of [undefined, "false", "TRUE", "1", "true"]) {
    assert.equal(
      googleMapsEmbedUrl(target, mapsEmbedConfig(enabled, undefined)),
      null,
    );
  }
  assert.equal(
    googleMapsEmbedUrl(target, mapsEmbedConfig("false", "fixture")),
    null,
  );
  assert.equal(googleMapsEmbedUrl(target, mapsEmbedConfig("true", " ")), null);
  const unknown = structuredClone(missing);
  unknown.directory!.sources.municipality.status = "unverified";
  assert.equal(
    googleMapsEmbedUrl(
      googleMapsTarget(unknown),
      mapsEmbedConfig("true", "fixture"),
    ),
    null,
  );
  const legacy: DiscoveryPlace = {
    ...missing,
    id: "legacy",
    directory: undefined,
    baseSlug: null,
  };
  assert.equal(googleMapsTarget(legacy).canEmbed, false);
  assert.ok(googleMapsTarget(legacy).searchUrl.includes("maps/search/"));
});
