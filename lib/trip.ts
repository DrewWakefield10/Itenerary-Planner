import { z } from "zod";
import { destinations } from "./destinations";
import { factSourcesSchema, sourcedLinkSchema } from "./sources";
import { disruptionSensitivitySchema, openingHoursSchema } from "./disruptions";
import {entryPriceSchema, visitModeSchema} from "./catalog/schema";
import {geographySchema} from "./catalog/directory-schema";
import {placeTypeSchema,placeTypes} from "./catalog/place-types";
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !Number.isNaN(Date.parse(v)) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Choose a valid date",
  );
export const requestSchema = z
  .object({
    departure: z.string().trim().min(1).max(80),
    destinations: z
      .array(
        z
          .string()
          .refine(
            (v) => destinations.some((d) => d.slug === v),
            "Unknown destination",
          ),
      )
      .min(1)
      .max(3)
      .refine((v) => new Set(v).size === v.length),
    startDate: date,
    days: z.number().int().min(2).max(21),
    adults: z.number().int().min(1).max(20),
    children: z.number().int().min(0).max(10),
    interests: z.array(z.string().max(50)).max(9),
    activityCategories: z.array(placeTypeSchema).max(placeTypes.length).default([]),
    randomSeed: z.string().max(100).nullable().default(null),
    includeExcursions: z.boolean().default(false),
    budget: z.number().int().min(500).max(2000000),
    budgetMode: z.enum(["total", "person"]),
    tier: z.enum(["Backpacker", "Budget", "Comfortable", "Premium", "Custom"]),
    flights: z.boolean(),
    accommodation: z.boolean(),
    reserve: z.number().int().min(0).max(40),
    pace: z.enum(["Chill", "Balanced", "Packed"]),
    diet: z.string().max(500),
    accessibility: z.string().max(500),
    stay: z.string().max(200),
    avoid: z.string().max(500),
    must: z.string().max(500),
    reservations: z.string().max(1000),
    requirements: z.string().max(500),
  })
  .refine(
    (r) => r.days >= r.destinations.length * 2 + (r.destinations.length - 1),
    {
      message:
        "Allow two days per destination plus a full day for each unverified connection.",
      path: ["days"],
    },
  );
export type TripRequest = z.infer<typeof requestSchema>;
export const expenseCategories = [
  "Transportation",
  "Accommodation",
  "Food",
  "Attractions",
  "Permits and fees",
  "Miscellaneous",
] as const;
const money = z.number().int().min(0).max(10000000);
export const activitySchema = z.object({
  placeTypes:z.array(placeTypeSchema).max(placeTypes.length).default([]),
  geography:geographySchema.nullable().default(null),
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(160),
  catalogStopId: z.string().max(100).nullable().default(null),
  canonicalStopId: z.string().max(100).nullable().default(null),
  entryPrice: entryPriceSchema.nullable().default(null),
  visitMode: visitModeSchema.default("local"),
  transferMinutes: z.number().int().min(0).max(720).default(45),
  bookingRequired: z.boolean().default(false),
  includedStopIds: z.array(z.string().max(100)).max(100).default([]),
  description: z.string().max(1500),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  duration: z.number().int().min(15).max(720),
  cost: money,
  category: z.enum(expenseCategories),
  kind: z.string().max(50),
  outdoor: z.boolean(),
  disruptionSensitivities: z
    .array(disruptionSensitivitySchema)
    .max(3)
    .default([]),
  openingHours: openingHoursSchema.nullable().default(null),
  cluster: z.string().max(100),
  locked: z.boolean(),
  transport: z.string().max(600),
  booking: z.string().max(600),
  provenance: z.enum(["estimate", "user", "demo"]),
  source: z.string().max(500),
  locationDetails: z
    .string()
    .max(1000)
    .default("Location context has not been independently checked."),
  accessibility: z
    .string()
    .max(1000)
    .default(
      "Accessibility has not been verified. Confirm your needs with the venue or operator.",
    ),
  sources: factSourcesSchema.default({}),
  advisories: z.array(sourcedLinkSchema).max(10).default([]),
});
export type Activity = z.infer<typeof activitySchema>;
export const daySchema = z.object({
  id: z.string(),
  date,
  destination: z
    .string()
    .refine(
      (v) => destinations.some((d) => d.slug === v),
      "Unknown destination",
    ),
  title: z.string().max(200),
  transfer: z.boolean(),
  activities: z.array(activitySchema).max(30),
  stay: money,
  food: money,
  transport: money,
});
export type TripDay = z.infer<typeof daySchema>;
const destinationInfoSchema = z.object({
  slug: z
    .string()
    .refine(
      (v) => destinations.some((d) => d.slug === v),
      "Unknown destination",
    ),
  name: z.string().max(100),
  locationDetails: z.string().max(1000),
  transport: z.string().max(1000),
  accessibility: z.string().max(1000),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  daily: money,
  sources: factSourcesSchema,
  advisories: z.array(sourcedLinkSchema).max(10),
});
export const tripSchema = z
  .object({
    version: z.literal(1),
    id: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-zA-Z0-9_-]+$/),
    title: z.string().min(1).max(160),
    createdAt: z.string(),
    mode: z.enum(["demo", "ai"]),
    request: requestSchema,
    days: z.array(daySchema).min(2).max(21),
    destinationInfo: z.array(destinationInfoSchema).max(3).default([]),
    notes: z.string().max(20000),
    checklist: z
      .array(
        z.object({
          id: z.string(),
          text: z.string().max(200),
          done: z.boolean(),
        }),
      )
      .max(100),
    actual: z.record(z.enum(expenseCategories), money),
    warnings: z.array(z.string().max(1500)).max(100),
    flightAllowance: money,
  })
  .superRefine((trip, ctx) => {
    if (
      trip.destinationInfo.some(
        (d) => !trip.request.destinations.includes(d.slug),
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Destination notes are outside this trip",
      });
    if (trip.days.length !== trip.request.days)
      ctx.addIssue({
        code: "custom",
        message: "Day count does not match request",
      });
    const ids = trip.days.flatMap((d) => [
      d.id,
      ...d.activities.map((a) => a.id),
    ]);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({
        code: "custom",
        message: "Duplicate day or activity identifiers",
      });
    trip.days.forEach((d, i) => {
      const expected = new Date(trip.request.startDate + "T12:00:00Z");
      expected.setUTCDate(expected.getUTCDate() + i);
      if (
        Number.isNaN(expected.getTime()) ||
        d.date !== expected.toISOString().slice(0, 10)
      )
        ctx.addIssue({
          code: "custom",
          message: "Day dates must be consecutive",
        });
      if (!trip.request.destinations.includes(d.destination))
        ctx.addIssue({
          code: "custom",
          message: "Day destination is outside request",
        });
      if (d.activities.some((a) => (a.lat === null) !== (a.lng === null)))
        ctx.addIssue({
          code: "custom",
          message: "Coordinates must be supplied together",
        });
    });
  });
export type Trip = z.infer<typeof tripSchema>;
export const defaultRequest: TripRequest = {
  departure: "Manila",
  destinations: ["el-nido"],
  startDate: "",
  days: 5,
  adults: 2,
  children: 0,
  interests: ["Nature Lover"],
  activityCategories: [],
  randomSeed: null,
  includeExcursions: false,
  budget: 25000,
  budgetMode: "total",
  tier: "Comfortable",
  flights: false,
  accommodation: true,
  reserve: 10,
  pace: "Balanced",
  diet: "",
  accessibility: "",
  stay: "Local guesthouse",
  avoid: "",
  must: "",
  reservations: "",
  requirements: "",
};
export function tomorrow() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
