import { test } from "node:test";
import assert from "node:assert/strict";
import {
  discoveryPlaces,
  discoveryPlace,
  discoveryStop,
  nearbyDiscoveries,
  verifiedPlaceCoordinates,
} from "../lib/discovery";
import {
  articleMappings,
  compareReadership,
  emptyInterestSnapshot,
  interestFresh,
  readershipReport,
  readershipWindow,
  shiftDate,
  signalLabel,
  interestCaveat,
  type ReadershipSuccess,
} from "../lib/discovery-interest";
import {
  createWikimediaClient,
  fetchReadership,
  refreshInterest,
  resolveArticle,
} from "../lib/wikimedia-pageviews";
import {
  acceptDiscoveryAddition,
  previewDiscoveryAddition,
  suggestedDiscoveryTime,
} from "../lib/discovery-planning";
import { blankActivity, generateDemo } from "../lib/engine";
import { defaultRequest, tripSchema } from "../lib/trip";
import { GET as discoveryResponse } from "../app/api/discovery/route";

const now = new Date("2026-10-19T12:00:00Z");
function success(previous = 100, latest = 140): ReadershipSuccess {
  const period = readershipWindow(now);
  return {
    ...period,
    project: "en.wikipedia.org",
    agent: "user",
    access: "all-access",
    title: "Baguio",
    pageId: 162480,
    sourceUrl:
      "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia.org/all-access/user/Baguio/daily/2026100500/2026101800",
    fetchedAt: now.toISOString(),
    days: Array.from({ length: 14 }, (_, i) => ({
      date: shiftDate(period.start, i),
      views: i < 7 ? previous : latest,
    })),
  };
}
const noSleep = async () => {};
const article = {
  query: {
    pages: [
      {
        pageid: 162480,
        ns: 0,
        title: "Baguio",
        pageprops: { wikibase_item: "Q1822" },
      },
    ],
  },
};
const pageviews = () => ({
  items: success().days.map((d) => ({
    project: "en.wikipedia",
    article: "Baguio",
    access: "all-access",
    agent: "user",
    granularity: "daily",
    timestamp: d.date.replaceAll("-", "") + "00",
    views: d.views,
  })),
});

test("discovery IDs, exact spot-to-base mappings, and canonical article identities are explicit", () => {
  assert.equal(
    new Set(discoveryPlaces.map((p) => p.id)).size,
    discoveryPlaces.length,
  );
  for (const p of discoveryPlaces.filter((p) => p.kind === "spot")) {
    if(p.stopId)assert.ok(discoveryStop(p), p.id);
    else assert.equal(discoveryStop(p),null);
    assert.ok(p.reviewedOn! >= p.source.dateChecked!);
    if(p.source.status==="verified")assert.ok(p.source.sourceUrl?.startsWith("https://"));
    else assert.equal(p.source.dateChecked,null);
  }
  assert.equal(
    articleMappings.find((m) => m.placeId === "base-coron")?.title,
    "Coron, Palawan",
  );
  assert.equal(
    articleMappings.find((m) => m.placeId === "base-cebu")?.title,
    "Cebu City",
  );
  assert.equal(discoveryPlace("cebu-casa-gorordo")?.baseSlug, "cebu");
  assert.equal(discoveryPlace("cebu-casa-gorordo")?.wikipedia, undefined);
  assert.ok(!discoveryPlaces.some((p) => p.baseSlug === "palawan"));
});
test("growth requires both useful baseline and absolute increase; percentages are suppressed for tiny or zero baselines", () => {
  assert.deepEqual(readershipWindow(now), {
    start: "2026-10-05",
    end: "2026-10-18",
  });
  const growth = compareReadership(success())!;
  assert.equal(growth.previous, 700);
  assert.equal(growth.latest, 980);
  assert.equal(growth.increase, 280);
  assert.equal(growth.percent, 40);
  assert.equal(growth.qualifies, true);
  for (const n of [0, 1, 50]) {
    const result = compareReadership(success(n, 1000))!;
    assert.equal(result.percent, null);
    assert.equal(result.qualifies, false);
  }
  assert.equal(compareReadership(success(100, 110))?.qualifies, false);
  assert.equal(compareReadership(success(1000, 1030))?.qualifies, false);
  assert.equal(compareReadership(success(100, 80))?.qualifies, false);
});
test("missing days, duplicates, invalid counts, stale coverage and future fetches never become a live readership signal", () => {
  const missing = success();
  missing.days.pop();
  assert.equal(compareReadership(missing), null);
  const duplicate = success();
  duplicate.days[13] = duplicate.days[12];
  assert.equal(compareReadership(duplicate), null);
  const negative = success();
  negative.days[0].views = -1;
  assert.equal(compareReadership(negative), null);
  assert.equal(
    interestFresh(success(), new Date("2026-10-23T12:00:00Z")),
    false,
  );
  assert.equal(
    interestFresh(success(), new Date("2026-10-18T12:00:00Z")),
    false,
  );
  assert.equal(signalLabel, "Wikipedia readership increased over this period.");
  assert.match(interestCaveat, /not evidence of bookings/);
  const snapshot = emptyInterestSnapshot();
  snapshot.records["base-baguio"] = { lastSuccess: success(), error: null };
  const current = readershipReport(snapshot, now)[0];
  assert.equal(current.qualifies, true);
  assert.equal(current.data?.end, "2026-10-18");
  assert.equal(
    readershipReport(snapshot, new Date("2026-10-23T12:00:00Z"))[0].qualifies,
    false,
  );
  snapshot.records["base-baguio"].lastSuccess!.title = "Coron Island";
  assert.equal(readershipReport(snapshot, now)[0].data, null);
});
test("server provider identifies requests, resolves articles conservatively and requests human-reader daily data", async () => {
  const urls: string[] = [];
  const client = createWikimediaClient({
    sleep: noSleep,
    fetcher: async (input, init) => {
      const url = String(input);
      urls.push(url);
      assert.match(
        String((init?.headers as Record<string, string>)["User-Agent"]),
        /LakbayDiscoveryBot/,
      );
      if (url.includes("api.php")) {
        assert.match(url, /redirects=1/);
        return Response.json(article);
      }
      assert.match(
        url,
        /all-access\/user\/Baguio\/daily\/2026100500\/2026101800$/,
      );
      return Response.json(pageviews());
    },
  });
  const data = await fetchReadership(client, "Baguio", now);
  assert.equal(data.days.length, 14);
  assert.equal(data.pageId, 162480);
  assert.equal(data.fetchedAt, now.toISOString());
  assert.equal(urls.length, 2);
  const redirect = createWikimediaClient({
    sleep: noSleep,
    fetcher: async () =>
      Response.json({
        query: {
          pages: [{ pageid: 1, ns: 0, title: "Coron Island" }],
          redirects: [{ from: "Baguio", to: "Coron Island" }],
        },
      }),
  });
  await assert.rejects(
    () => resolveArticle(redirect, "Baguio"),
    /outside its reviewed mapping/,
  );
  const missing = createWikimediaClient({
    sleep: noSleep,
    fetcher: async () =>
      Response.json({
        query: { pages: [{ ns: 0, title: "Baguio", missing: true }] },
      }),
  });
  await assert.rejects(
    () => resolveArticle(missing, "Baguio"),
    /Article missing/,
  );
  const incomplete = createWikimediaClient({
    sleep: noSleep,
    fetcher: async (input) =>
      Response.json(
        String(input).includes("api.php")
          ? article
          : { items: pageviews().items.slice(0, 12) },
      ),
  });
  await assert.rejects(
    () => fetchReadership(incomplete, "Baguio", now),
    /fourteen-day coverage/,
  );
});
test("rate limits have bounded retries and Retry-After cooldown; failure retains the last successful snapshot", async () => {
  let calls = 0;
  const sleeps: number[] = [];
  const limited = createWikimediaClient({
    now: () => now,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    fetcher: async () => {
      calls++;
      return new Response("", { status: 429, headers: { "Retry-After": "1" } });
    },
  });
  await assert.rejects(
    () => limited.get("https://en.wikipedia.org/w/api.php"),
    /rate limited/,
  );
  assert.equal(calls, 2);
  assert.ok(sleeps.includes(1000));
  calls = 0;
  const previous = emptyInterestSnapshot();
  previous.updatedAt = success().fetchedAt;
  previous.records["base-baguio"] = { lastSuccess: success(), error: null };
  const original = structuredClone(previous);
  const client = createWikimediaClient({
    now: () => now,
    sleep: noSleep,
    fetcher: async () => {
      calls++;
      return new Response("", {
        status: 429,
        headers: { "Retry-After": "120" },
      });
    },
  });
  const failed = await refreshInterest(previous, client, now, true);
  assert.equal(calls, 1);
  assert.deepEqual(previous, original);
  assert.deepEqual(
    failed.records["base-baguio"].lastSuccess,
    previous.records["base-baguio"].lastSuccess,
  );
  assert.equal(failed.updatedAt, previous.updatedAt);
  assert.equal(failed.retryAfter, "2026-10-19T12:02:00.000Z");
  assert.equal(await refreshInterest(failed, client, now, true), failed);
  assert.equal(calls, 1);
  assert.ok(readershipReport(failed, new Date("2026-10-24T00:00:00Z"))[0].data);
  assert.equal(
    readershipReport(failed, new Date("2026-10-24T00:00:00Z"))[0].qualifies,
    false,
  );
  const daily = { ...previous, lastAttemptAt: now.toISOString() };
  assert.equal(await refreshInterest(daily, client, now), daily);
});
test("request budgets and upstream failures do not repeatedly call Wikimedia", async () => {
  let calls = 0;
  const client = createWikimediaClient({
    sleep: noSleep,
    maxRequests: 1,
    fetcher: async () => {
      calls++;
      return Response.json(article);
    },
  });
  await resolveArticle(client, "Baguio");
  await assert.rejects(
    () => client.get("https://en.wikipedia.org/w/api.php"),
    /request limit/,
  );
  assert.equal(calls, 1);
  await assert.rejects(() => client.get("https://example.org/"), /Unapproved/);
});
test("visitor requests serve a shared snapshot without any upstream fetch", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("Visitor request must not fetch external data");
  };
  try {
    const response = await discoveryResponse();
    assert.match(response.headers.get("Cache-Control")!, /s-maxage=3600/);
    const data = (await response.json()) as {
      rows: unknown[];
      lastAttemptAt: string | null;
      updatedAt: string | null;
    };
    assert.equal(data.rows.length, articleMappings.length);
    assert.ok("lastAttemptAt" in data && "updatedAt" in data);
  } finally {
    globalThis.fetch = original;
  }
});
test("nearby discoveries use only reviewed coordinates and explicitly keep spots inside their base", () => {
  const nearby = nearbyDiscoveries("baguio");
  assert.equal(nearby.origin?.id, "baguio-burnham-park");
  assert.ok(nearby.spots.length >= 2);
  for (const { place, km } of nearby.spots) {
    assert.equal(place.baseSlug, "baguio");
    assert.ok(verifiedPlaceCoordinates(place));
    assert.ok(km > 0 && km < 15);
  }
  assert.equal(
    verifiedPlaceCoordinates(discoveryPlace("cebu-casa-gorordo")!),
    null,
  );
  assert.ok(nearbyDiscoveries("cebu").spots.every(({place})=>verifiedPlaceCoordinates(place)&&place.baseSlug==="cebu"));
});
function tripAt(slug = "baguio") {
  const trip = generateDemo({
    ...defaultRequest,
    startDate: "2026-12-08",
    destinations: [slug],
    days: 3,
  });
  trip.days[1].activities = [
    { ...blankActivity("Keep my locked appointment", "15:00"), locked: true },
  ];
  return trip;
}
test("discovery preview is immutable; explicit acceptance appends the correct place with independent evidence and group costs", () => {
  const trip = tripAt(),
    original = structuredClone(trip);
  const preview = previewDiscoveryAddition(
    trip,
    1,
    "baguio-botanical-garden",
    "10:00",
  );
  assert.deepEqual(trip, original);
  assert.equal(
    preview.activity.cost,
    100 * (trip.request.adults + trip.request.children),
  );
  assert.equal(preview.activity.sources.price.status, "estimate");
  assert.equal(preview.activity.sources.schedule.status, "estimate");
  assert.equal(preview.activity.sources.description.status, "verified");
  assert.equal(preview.activity.sources.coordinates.status, "verified");
  const next = acceptDiscoveryAddition(trip, preview);
  assert.deepEqual(next.request, original.request);
  assert.deepEqual(next.days[0], original.days[0]);
  assert.deepEqual(next.days[2], original.days[2]);
  assert.deepEqual(
    next.days[1].activities.find(
      (a) => a.id === original.days[1].activities[0].id,
    ),
    original.days[1].activities[0],
  );
  assert.equal(next.days[1].activities.length, 2);
  assert.deepEqual(tripSchema.parse(JSON.parse(JSON.stringify(next))), next);
  const stale = structuredClone(trip);
  stale.notes = "Changed elsewhere";
  assert.throws(
    () => acceptDiscoveryAddition(stale, preview),
    /changed after the preview/,
  );
});
test("additions reject wrong bases, connection days, duplicates, overlaps, invalid times, and recorded closures", () => {
  assert.throws(
    () =>
      previewDiscoveryAddition(
        tripAt("coron"),
        1,
        "baguio-wright-park",
        "10:00",
      ),
    /exact overnight base/,
  );
  assert.throws(
    () =>
      previewDiscoveryAddition(
        tripAt("palawan"),
        1,
        "baguio-wright-park",
        "10:00",
      ),
    /exact overnight base/,
  );
  const trip = tripAt();
  trip.days[1].transfer = true;
  assert.throws(
    () => previewDiscoveryAddition(trip, 1, "baguio-wright-park", "10:00"),
    /Connection days/,
  );
  trip.days[1].transfer = false;
  assert.throws(
    () => previewDiscoveryAddition(trip, 1, "baguio-wright-park", "14:30"),
    /empty slot/,
  );
  assert.throws(() =>
    previewDiscoveryAddition(trip, 1, "baguio-wright-park", "invalid"),
  );
  const added = acceptDiscoveryAddition(
    trip,
    previewDiscoveryAddition(trip, 1, "baguio-wright-park", "10:00"),
  );
  assert.throws(
    () => previewDiscoveryAddition(added, 1, "baguio-wright-park", "18:00"),
    /already in this trip/,
  );
  assert.ok(suggestedDiscoveryTime(trip, 1, "baguio-wright-park"));
  const cebu = tripAt("cebu");
  cebu.days[1].activities = [];
  assert.throws(
    () => previewDiscoveryAddition(cebu, 1, "cebu-casa-gorordo", "17:00"),
    /opening days or hours/,
  );
  cebu.request.startDate = "2026-12-12";
  cebu.days.forEach((d, i) => (d.date = shiftDate(cebu.request.startDate, i)));
  assert.throws(
    () => previewDiscoveryAddition(cebu, 1, "cebu-casa-gorordo", "10:00"),
    /opening days or hours/,
  );
  const legacy = JSON.parse(JSON.stringify(tripAt("palawan")));
  delete legacy.destinationInfo;
  for (const d of legacy.days)
    for (const a of d.activities) {
      delete a.sources;
      delete a.openingHours;
      delete a.disruptionSensitivities;
    }
  assert.deepEqual(tripSchema.parse(legacy).request.destinations, ["palawan"]);
});
