import { test } from "node:test";
import assert from "node:assert/strict";
import { destination } from "../lib/destinations";
import {
  blankActivity,
  fromStop,
  generateDemo,
  minutes,
  uid,
} from "../lib/engine";
import {
  acceptManualSuggestions,
  catalogActivity,
  dayWindows,
  emptyManualDraft,
  finishManualTrip,
  layoutManualDays,
  manualBudgetTotals,
  manualDayWarnings,
  manualDefaults,
  suggestionsForWindow,
} from "../lib/manual-planning";
import { defaultRequest, tripSchema, type TripRequest } from "../lib/trip";
import { rankCatalogStops } from "../lib/provider";

const request: TripRequest = {
  ...defaultRequest,
  destinations: ["baguio"],
  startDate: "2026-12-10",
  interests: [],
};
const budget = { limit: null, additional: null };
const timed = (name: string, start: string) => ({
  ...blankActivity(name, start, "Personal"),
  duration: 30,
  locked: true,
  manual: {
    ...manualDefaults,
    flexible: false,
    durationUnknown: false,
    reviewedDate: request.startDate,
  },
});

test("manual-only five-day snapshot has real empty days and survives export/import", () => {
  const days = layoutManualDays(request, []);
  assert.equal(days.length, 5);
  assert.ok(days.every((day) => day.activities.length === 0));
  days[0].activities.push(
    catalogActivity("baguio-burnham-park", request, days[0]),
  );
  days[1].activities.push(timed("Reservation", "11:00"));
  const trip = finishManualTrip(request, { ...emptyManualDraft, days });
  assert.equal(trip.mode, "manual");
  assert.deepEqual(tripSchema.parse(JSON.parse(JSON.stringify(trip))), trip);
  assert.equal(
    trip.days[0].activities[0].manual?.placeId,
    "baguio-burnham-park",
  );
  assert.equal(trip.days[0].activities[0].manual?.flexible, true);
  assert.ok(tripSchema.safeParse(generateDemo(request)).success);
});

test("shortening and redating a trip preserves displaced activities and flags fixed dates", () => {
  const days = layoutManualDays(request, []);
  days[4].activities.push(timed("Checkout", "10:00"));
  days[0].activities.push(timed("Reservation", "11:00"));
  const shortened = { ...request, days: 3, startDate: "2026-12-11" };
  const retained = layoutManualDays(shortened, days);
  assert.equal(retained[4].activities[0].name, "Checkout");
  assert.match(
    manualDayWarnings(retained[0], shortened).join(),
    /date changed/,
  );
  assert.throws(
    () => finishManualTrip(shortened, { ...emptyManualDraft, days: retained }),
    /outside your new duration/,
  );
  assert.equal(
    layoutManualDays(
      { ...request, destinations: ["el-nido", "coron"] },
      [],
    ).filter((day) => day.transfer).length,
    1,
  );
});

test("explicit windows protect free time and flexible stops cannot imply timed gaps", () => {
  const days = layoutManualDays(request, []),
    day = days[0];
  day.activities.push(
    timed("Breakfast", "08:00"),
    timed("Reservation", "11:00"),
  );
  assert.equal(dayWindows(day)[0].start, "08:30");
  day.activities.push({ ...blankActivity("Flexible"), manual: manualDefaults });
  assert.equal(dayWindows(day).length, 0);
  day.windows = [
    { id: "protected", start: "09:00", end: "11:00", intent: "free" },
    { id: "candidate", start: "09:30", end: "10:30", intent: "open" },
  ];
  assert.deepEqual(
    suggestionsForWindow(request, days, day, "protected", budget),
    [],
  );
  assert.deepEqual(
    suggestionsForWindow(request, days, day, "candidate", budget),
    [],
  );
});

test("fits between geographically compatible bookings, keeps fixed stops, and rejects stale or duplicate alternatives", () => {
  const days = layoutManualDays(request, []),
    day = days[0];
  const byCluster = destination("baguio")!.stops.filter(
    (stop) => stop.cluster === "central" && stop.mode === "local",
  );
  assert.ok(byCluster.length >= 2);
  day.activities = [
    { ...fromStop(byCluster[0], request, "08:00"), duration: 30, locked: true },
    { ...fromStop(byCluster[1], request, "13:00"), duration: 45, locked: true },
  ];
  const gap = dayWindows(day)[0];
  const picks = suggestionsForWindow(request, days, day, gap.id, budget);
  assert.ok(picks.length);
  const first = picks[0];
  assert.ok(first.before > 0 && first.after > 0);
  assert.ok(
    minutes(first.start) + first.duration + first.after + first.spare <=
      13 * 60,
  );
  const result = acceptManualSuggestions(request, days, budget, [first]);
  assert.deepEqual(result.days[0].activities.slice(0, 2), day.activities);
  assert.equal(day.activities.length, 2);
  assert.equal(result.added.length, 1);
  assert.throws(() =>
    acceptManualSuggestions(request, days, budget, [first, first]),
  );
  assert.throws(() =>
    acceptManualSuggestions(request, result.days, budget, [first]),
  );
  day.activities[1].start = "09:30";
  assert.throws(
    () => acceptManualSuggestions(request, days, budget, [first]),
    /changed/,
  );
});

test("zero budget and unknown entry prices cannot silently pass, and accepted costs are counted once", () => {
  const days = layoutManualDays(request, []),
    day = days[0];
  day.windows = [{ id: uid(), start: "09:00", end: "14:00", intent: "open" }];
  const id = day.windows[0].id;
  assert.equal(
    suggestionsForWindow(request, days, day, id, { ...budget, additional: 0 })
      .length,
    0,
  );
  const options = suggestionsForWindow(request, days, day, id, budget);
  assert.ok(options.length);
  const capped = suggestionsForWindow(request, days, day, id, {
    ...budget,
    additional: 10000,
  });
  assert.ok(
    capped.every(
      (option) => !option.entryUnknown && option.cost >= option.transport,
    ),
  );
  const result = acceptManualSuggestions(request, days, budget, [options[0]]);
  const totals = manualBudgetTotals(result.days, {
    ...budget,
    additional: options[0].cost + 100,
  });
  assert.equal(totals.planned, options[0].cost);
  assert.equal(totals.combined, options[0].cost + 100);
  assert.equal(totals.remaining, 100);
});

test("selected open days can be applied as one compatible set and duplicate choices leave the draft unchanged", () => {
  const days = layoutManualDays(request, []);
  const choices = days
    .slice(0, 2)
    .map((day) =>
      suggestionsForWindow(request, days, day, `open-day-${day.id}`, budget),
    );
  const first = choices[0][0],
    second = choices[1].find((choice) => choice.stopId !== first.stopId)!;
  assert.ok(first && second);
  assert.throws(() =>
    acceptManualSuggestions(request, days, budget, [
      first,
      choices[1].find((choice) => choice.stopId === first.stopId)!,
    ]),
  );
  assert.ok(days.every((day) => !day.activities.length));
  const result = acceptManualSuggestions(request, days, budget, [
    first,
    second,
  ]);
  assert.equal(result.added.length, 2);
  assert.deepEqual(result.days.slice(2), days.slice(2));
});

test("optional AI ranking receives only supplied catalog options and rejects invented choices", async () => {
  const candidates = [
    { id: "one", name: "One", category: "Cafe", minutes: 60 },
  ];
  const prefs = { interests: [], pace: "Balanced", categories: [] };
  assert.deepEqual(await rankCatalogStops(candidates, prefs, {}), {
    ids: ["one"],
    assisted: false,
  });
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (_url, opts) => {
      const body = JSON.parse(String(opts?.body));
      assert.deepEqual(JSON.parse(body.messages[1].content), {
        candidates,
        preferences: prefs,
      });
      return Response.json({
        choices: [
          { message: { content: JSON.stringify({ ids: ["invented"] }) } },
        ],
      });
    };
    await assert.rejects(
      () =>
        rankCatalogStops(candidates, prefs, {
          key: "test",
          url: "https://fixture.invalid/chat",
          model: "fixture",
        }),
      /invalid catalog choice/,
    );
  } finally {
    globalThis.fetch = original;
  }
});
