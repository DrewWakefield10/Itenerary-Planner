import { z } from "zod/v3";
import { discoverySeeds as discoveryPlaces } from "./discovery-data";

export const interestThresholdSchema = z.object({
  baseline: z.number().int().min(1),
  absoluteGrowth: z.number().int().min(1),
  percentGrowth: z.number().min(1),
  freshnessHours: z.number().min(1).max(168),
});
export const defaultInterestThresholds = {
  baseline: 700,
  absoluteGrowth: 200,
  percentGrowth: 20,
  freshnessHours: 72,
};
export const signalLabel = "Wikipedia readership increased over this period.";
export const interestCaveat =
  "English Wikipedia readership is a limited interest signal, not evidence of bookings, visitor arrivals, travel demand, or social-media virality.";
export const articleMappings = discoveryPlaces
  .filter((p) => p.wikipedia)
  .map((p) => ({
    placeId: p.id,
    title: p.wikipedia!.title,
    reviewedOn: p.wikipedia!.reviewedOn,
  }));
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
  );
export const readershipSuccessSchema = z.object({
  project: z.literal("en.wikipedia.org"),
  agent: z.literal("user"),
  access: z.literal("all-access"),
  title: z.string().min(1),
  pageId: z.number().int().positive(),
  fetchedAt: z.string().datetime(),
  start: isoDate,
  end: isoDate,
  sourceUrl: z.string().url(),
  days: z
    .array(z.object({ date: isoDate, views: z.number().int().nonnegative() }))
    .length(14),
});
export type ReadershipSuccess = z.infer<typeof readershipSuccessSchema>;
export const interestSnapshotSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string().datetime().nullable(),
  lastAttemptAt: z.string().datetime().nullable(),
  retryAfter: z.string().datetime().nullable(),
  thresholds: interestThresholdSchema,
  records: z.record(
    z.object({
      lastSuccess: readershipSuccessSchema.nullable(),
      error: z.string().nullable(),
    }),
  ),
});
export type InterestSnapshot = z.infer<typeof interestSnapshotSchema>;
export const emptyInterestSnapshot = (): InterestSnapshot => ({
  version: 1,
  updatedAt: null,
  lastAttemptAt: null,
  retryAfter: null,
  thresholds: { ...defaultInterestThresholds },
  records: {},
});
export const utcDate = (d: Date) => d.toISOString().slice(0, 10);
export const shiftDate = (date: string, delta: number) =>
  utcDate(new Date(Date.parse(date + "T00:00:00Z") + delta * 86400000));
export function readershipWindow(now = new Date()) {
  const end = shiftDate(utcDate(now), -1);
  return { start: shiftDate(end, -13), end };
}
export function compareReadership(
  data: ReadershipSuccess,
  thresholds = defaultInterestThresholds,
) {
  const counts = new Map(data.days.map((d) => [d.date, d.views]));
  if (
    counts.size !== 14 ||
    shiftDate(data.start, 13) !== data.end ||
    data.days.some((d) => !Number.isInteger(d.views) || d.views < 0) ||
    Array.from({ length: 14 }, (_, i) => shiftDate(data.start, i)).some(
      (d) => !counts.has(d),
    )
  )
    return null;
  const previous = Array.from(
    { length: 7 },
    (_, i) => counts.get(shiftDate(data.start, i))!,
  ).reduce((a, b) => a + b, 0);
  const latest = Array.from(
    { length: 7 },
    (_, i) => counts.get(shiftDate(data.start, i + 7))!,
  ).reduce((a, b) => a + b, 0);
  const increase = latest - previous;
  const percent =
    previous >= thresholds.baseline ? (increase / previous) * 100 : null;
  return {
    previous,
    latest,
    increase,
    percent,
    qualifies:
      percent !== null &&
      increase >= thresholds.absoluteGrowth &&
      percent >= thresholds.percentGrowth,
    previousStart: data.start,
    previousEnd: shiftDate(data.start, 6),
    latestStart: shiftDate(data.start, 7),
    latestEnd: data.end,
  };
}
export function interestFresh(
  data: ReadershipSuccess,
  now = new Date(),
  hours = defaultInterestThresholds.freshnessHours,
) {
  const age = now.getTime() - Date.parse(data.fetchedAt);
  const coverageAge = Date.parse(utcDate(now)) - Date.parse(data.end);
  return (
    age >= -300000 &&
    age <= hours * 3600000 &&
    coverageAge >= 86400000 &&
    coverageAge <= hours * 3600000
  );
}
export function readershipReport(snapshot: InterestSnapshot, now = new Date()) {
  return articleMappings.map((mapping) => {
    const entry = snapshot.records[mapping.placeId];
    const data = entry?.lastSuccess;
    const matches =
      data?.title === mapping.title &&
      data.project === "en.wikipedia.org" &&
      data.agent === "user";
    const comparison =
      data && matches ? compareReadership(data, snapshot.thresholds) : null;
    const fresh = !!(
      data &&
      comparison &&
      interestFresh(data, now, snapshot.thresholds.freshnessHours)
    );
    return {
      placeId: mapping.placeId,
      title: mapping.title,
      data: matches ? data : null,
      comparison,
      fresh,
      error:
        entry?.error ||
        (data && !matches ? "Article mapping needs review." : null),
      qualifies: fresh && !!comparison?.qualifies,
    };
  });
}
export type ReadershipRow = ReturnType<typeof readershipReport>[number];
