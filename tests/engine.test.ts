import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateDemo,
  budgetSummary,
  validateDay,
  regenerateDay,
  alternativePlan,
  dayCost,
  reflow,
} from "../lib/engine";
import { defaultRequest, tripSchema } from "../lib/trip";
const base = { ...defaultRequest, startDate: "2026-12-10" };
test("low-budget Baguio uses honest arithmetic and warns if insufficient", () => {
  const t = generateDemo({
    ...base,
    destinations: ["baguio"],
    days: 3,
    adults: 1,
    budget: 2000,
    pace: "Chill",
  });
  const b = budgetSummary(t);
  assert.equal(
    b.total,
    t.days.reduce((s, d) => s + dayCost(d), 0) + b.reserve + t.flightAllowance,
  );
  assert.ok(b.remaining < 0);
  assert.ok(
    t.days.every((d) => !validateDay(d).some((w) => w.includes("overlaps"))),
  );
});
test("Cebu–Bohol reserves a full unverified connection day", () => {
  const t = generateDemo({ ...base, destinations: ["cebu", "bohol"], days: 6 });
  assert.equal(t.days.length, 6);
  assert.equal(t.days.filter((d) => d.transfer).length, 1);
  assert.ok(
    validateDay(t.days.find((d) => d.transfer)!).some((w) =>
      w.includes("unverified"),
    ),
  );
  assert.equal(t.days.at(-1)?.destination, "bohol");
});
test("relaxed Palawan family has rest and limited sightseeing", () => {
  const t = generateDemo({ ...base, children: 2, pace: "Chill" });
  assert.ok(
    t.days
      .slice(0, -1)
      .every((d) => d.activities.some((a) => a.kind === "Rest")),
  );
  assert.ok(
    t.days.every((d) => d.activities.filter((a) => a.outdoor).length <= 1),
  );
  assert.ok(
    t.days.every((d) => !validateDay(d).some((w) => w.includes("overlaps"))),
  );
});
test("editing removes costs and regeneration preserves locks and other days", () => {
  const t = generateDemo(base);
  const old = budgetSummary(t).total;
  const day = t.days[1];
  const paid = day.activities.find((a) => a.cost > 0)!;
  day.activities = day.activities.filter((a) => a.id !== paid.id);
  assert.equal(budgetSummary(t).total, old - paid.cost);
  day.activities[0].locked = true;
  const changed = regenerateDay(t, 1);
  assert.deepEqual(changed.days[0], t.days[0]);
  assert.deepEqual(
    changed.days[1].activities.find((a) => a.id === day.activities[0].id),
    day.activities[0],
  );
  const reordered = reflow([...day.activities].reverse());
  assert.equal(reordered.find((a) => a.locked)?.start, day.activities[0].start);
});
test("Plan B is a proposal and preserves locked and unaffected activities", () => {
  const t = generateDemo({ ...base, pace: "Packed", budget: 100000 });
  const day = t.days[1];
  day.activities[0].locked = true;
  const original = structuredClone(t);
  const next = alternativePlan(t, 1, "Heavy rain");
  assert.deepEqual(t, original);
  assert.deepEqual(next.days[0], t.days[0]);
  assert.deepEqual(next.days[1].activities[0], t.days[1].activities[0]);
  assert.ok(tripSchema.safeParse(next).success);
});
test("missing credentials is explicit demo; all generated days parse", () => {
  const t = generateDemo(base);
  assert.equal(t.mode, "demo");
  assert.ok(tripSchema.safeParse(t).success);
  for (const d of t.days)
    assert.ok(
      !validateDay(d).some((w) => w.includes("overlaps")),
      JSON.stringify(validateDay(d)),
    );
});
