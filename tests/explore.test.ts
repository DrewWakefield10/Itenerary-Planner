import { test } from "node:test";
import assert from "node:assert/strict";
import {
  exploreDestinations,
  placesForGuide,
  discoverForDestination,
  planDestination,
  retiredGuidesTarget,
  startersForDestination,
  guideHighlights,
  guideFood,
} from "../lib/explore";
import {
  selectableDestinations,
  templates,
  officialTravelLinks,
  officialAdvisories,
} from "../lib/destinations";
import { destinationGroups, groupForBase } from "../lib/catalog/directory";
import { typesForStop } from "../lib/catalog/place-types";
import { foodForPlace } from "../lib/catalog/food";
import { defaultRequest } from "../lib/trip";
import {
  plannerEntry,
  applyPlannerPrefill,
  readPlannerPrefill,
} from "../lib/planner-entry";
import { travelAdvice, adviceArticle } from "../lib/travel-advice";

test("Explore covers all browsing groups and keeps Palawan overnight bases independent", () => {
  const all = exploreDestinations();
  assert.equal(all.length, selectableDestinations.length);
  assert.deepEqual(
    new Set(all.map((d) => groupForBase(d.slug))),
    new Set(destinationGroups),
  );
  assert.ok(!all.some((d) => d.slug === "palawan"));
  assert.deepEqual(
    exploreDestinations({ search: "Palawan" }).map((d) => d.slug),
    ["el-nido", "coron", "puerto-princesa"],
  );
  for (const slug of ["el-nido", "coron", "puerto-princesa"]) {
    const places = placesForGuide(slug);
    assert.ok(places.length);
    assert.ok(
      places.every(
        (p) => (p.planning?.base_slug || p.itinerary_base_slug) === slug,
      ),
    );
    assert.ok(guideHighlights(slug).length <= 3);
    assert.ok(guideFood(slug).length <= 2);
    assert.equal(
      new URL(
        discoverForDestination(slug),
        "https://example.test",
      ).searchParams.get("destination"),
      "Palawan",
    );
  }
  assert.equal(planDestination("coron"), "/planner?destinations=coron");
  assert.ok(!planDestination("palawan").startsWith("/planner"));
});
test("destination interests require actual catalog identities; filters compose with search and favorites", () => {
  const beaches = exploreDestinations({ category: "Beaches" });
  assert.ok(beaches.length);
  for (const d of beaches)
    assert.ok(
      placesForGuide(d.slug).some((p) => typesForStop(p.id).includes("beach")),
      d.slug,
    );
  for (const d of exploreDestinations({ category: "Food" }))
    assert.ok(
      placesForGuide(d.slug).some((p) => foodForPlace(p.id)),
      d.slug,
    );
  for (const d of exploreDestinations({ category: "City" }))
    assert.ok(
      placesForGuide(d.slug).some(
        (p) =>
          /\bcity\b/i.test(p.city_municipality || "") ||
          p.destination_group === "Manila",
      ),
    );
  assert.deepEqual(
    exploreDestinations({
      search: "Baguio",
      category: "Food",
      saved: ["cebu"],
    }),
    [],
  );
  assert.deepEqual(
    exploreDestinations({
      search: "Baguio",
      category: "Food",
      saved: ["baguio"],
    }).map((d) => d.slug),
    ["baguio"],
  );
  assert.deepEqual(exploreDestinations({ category: "unknown" }), []);
});
test("retired guide index preserves relevant query parameters and every starter remains associated", () => {
  const target = new URL(
    retiredGuidesTarget({
      destinations: "cebu,bohol",
      days: "6",
      category: "Food",
      q: "Cebu",
      tag: ["one", "two"],
    }),
    "https://example.test",
  );
  assert.equal(target.pathname, "/explore/advice");
  assert.equal(target.searchParams.get("view"), null);
  assert.equal(target.searchParams.get("destinations"), "cebu,bohol");
  assert.equal(target.searchParams.get("days"), "6");
  assert.deepEqual(target.searchParams.getAll("tag"), ["one", "two"]);
  for (const t of templates)
    for (const slug of t.slugs)
      assert.ok(startersForDestination(slug).includes(t));
  assert.equal(travelAdvice.length, 4);
  assert.equal(new Set(travelAdvice.map((a) => a.slug)).size, 4);
  assert.equal(adviceArticle("preparation")?.resources, officialTravelLinks);
  assert.equal(adviceArticle("transport")?.resources, officialAdvisories);
  assert.equal(adviceArticle("missing"), undefined);
});
const saved = {
  ...defaultRequest,
  startDate: "2026-12-12",
  days: 12,
  destinations: ["cebu"],
  budget: 76543,
  pace: "Chill" as const,
  diet: "Vegetarian",
  activityCategories: ["cafe" as const],
  must: "Keep my note",
};
test("destination and template entry previews never mutate an existing planner draft", () => {
  const before = JSON.stringify(saved),
    entry = plannerEntry(saved, "destinations=coron&days=3");
  assert.deepEqual(entry.request, saved);
  assert.deepEqual(entry.proposal, { destinations: ["coron"], days: 3 });
  assert.equal(JSON.stringify(saved), before);
  const applied = applyPlannerPrefill(
    entry.request,
    entry.proposal!,
    "replace",
  );
  assert.deepEqual(applied, { ...saved, destinations: ["coron"] });
  assert.deepEqual(
    applyPlannerPrefill(entry.request, entry.proposal!, "replace", true),
    { ...saved, destinations: ["coron"], days: 3 },
  );
  assert.deepEqual(
    applyPlannerPrefill(saved, { destinations: ["cebu", "coron"] }, "add")
      .destinations,
    ["cebu", "coron"],
  );
  assert.equal(JSON.stringify(saved), before);
});
test("prefill respects scheduling/base limits, handles older drafts and protects malformed drafts", () => {
  assert.throws(() =>
    applyPlannerPrefill(
      { ...saved, days: 3 },
      { destinations: ["coron"] },
      "add",
    ),
  );
  assert.throws(() =>
    applyPlannerPrefill(
      { ...saved, destinations: ["cebu", "bohol", "baguio"] },
      { destinations: ["coron"] },
      "add",
    ),
  );
  for (const query of [
    "destinations=cebu,missing",
    "destinations=cebu,cebu",
    "destinations=cebu,bohol,baguio,coron",
  ])
    assert.equal(readPlannerPrefill(query).destinations, undefined);
  const fresh = plannerEntry(null, "destinations=coron&days=3", "Chill");
  assert.equal(fresh.proposal, null);
  assert.deepEqual(fresh.request.destinations, ["coron"]);
  assert.equal(fresh.request.days, 3);
  assert.equal(fresh.request.pace, "Chill");
  const old = { ...saved };
  delete (old as Partial<typeof saved>).activityCategories;
  assert.equal(plannerEntry(old, "").draftValid, true);
  for (const invalid of ["{broken", [], undefined, { days: 999 }])
    assert.equal(plannerEntry(invalid, "destinations=coron").draftValid, false);
});
