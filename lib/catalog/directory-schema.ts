import { z } from "zod/v3";
import { sourceMetadataSchema } from "../sources";
import {openingHoursSchema,disruptionSensitivitySchema} from "../disruptions";
import {entryPriceSchema} from "./practical-schema";

export const planningBaseSlugs=["el-nido","coron","puerto-princesa","siargao","cebu","bohol","boracay","baguio","batanes","iloilo","davao","sagada","manila"] as const;
const stableId=z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);
export const directoryPlanningSchema=z.object({
  base_slug:z.enum(planningBaseSlugs).nullable(),mode:z.enum(["local","excursion","separate-base"]),cluster:stableId,
  minutes:z.number().int().min(15).max(720),booking:z.string().min(1).max(600),transport:z.string().min(1).max(600),
  accessibility:z.string().min(1).max(1000),requiresBooking:z.boolean(),scheduling:z.enum(["candidate","manual"]),
  outdoor:z.boolean().optional(),transferMinutes:z.number().int().min(45).max(720).optional(),
  openingHours:openingHoursSchema.nullable().optional(),entryPrice:entryPriceSchema.nullable().optional(),
  transport_source:sourceMetadataSchema.optional(),booking_source:sourceMetadataSchema.optional(),accessibility_source:sourceMetadataSchema.optional(),
  disruptionSensitivities:z.array(disruptionSensitivitySchema).max(3).optional(),
});

export const destinationGroups = [
  "Palawan",
  "Cebu",
  "Manila",
  "Siargao",
  "Bohol",
  "Boracay",
  "Baguio",
  "Iloilo",
  "Davao",
  "Batanes",
  "Sagada",
] as const;
export const directoryCategories = [
  "Attractions",
  "Nature",
  "Food & drink",
  "Culture",
  "Parks & markets",
] as const;
export const geographySchema = z.object({
  destination_group: z.enum(destinationGroups),
  region: z.string().min(1),
  province: z.string().nullable(),
  city_municipality: z.string().min(1).nullable(),
  barangay: z.string().nullable(),
  address: z.string().nullable(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
  sources: z.object({
    identity: sourceMetadataSchema,
    municipality: sourceMetadataSchema,
    address: sourceMetadataSchema,
    coordinates: sourceMetadataSchema,
  }),
});
export type DirectoryGeography = z.infer<typeof geographySchema>;
export const directoryCandidateSchema = geographySchema
  .extend({
    id: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(100),
    name: z.string().min(1).max(160),
    slug:stableId.optional(),
    aliases:z.array(z.string().min(1).max(160)).max(20).optional(),
    planning:directoryPlanningSchema.optional(),
    category: z.enum(directoryCategories),
    description: z.string().min(1).max(1500),
    interests: z.array(z.string()),
    itinerary_base_slug: z.string().nullable(),
    catalog_stop_id: z.string().nullable(),
    status: z.enum(["accepted", "rejected", "unresolved"]),
    decision_reason: z.string().min(1),
    reviewed_on: z.string().nullable(),
  })
  .superRefine((p, ctx) => {
    if(p.slug&&p.slug!==p.id)ctx.addIssue({code:"custom",message:"Slug must match the stable place ID used in detail URLs"});
    if(p.planning&&p.planning.base_slug!==p.itinerary_base_slug)ctx.addIssue({code:"custom",message:"Planning and itinerary base mappings must agree"});
    if(p.planning?.mode==="separate-base"&&p.itinerary_base_slug)ctx.addIssue({code:"custom",message:"A separate overnight base must not be silently mapped to an existing base"});
    if ((p.latitude === null) !== (p.longitude === null))
      ctx.addIssue({
        code: "custom",
        message: "Coordinates must be supplied together",
      });
    if (
      p.status === "accepted" &&
      (!p.city_municipality ||
        p.sources.identity.status !== "verified" ||
        p.sources.municipality.status !== "verified")
    )
      ctx.addIssue({
        code: "custom",
        message: "Acceptance requires verified identity and municipality",
      });
    if (p.latitude === null && p.sources.coordinates.status === "verified")
      ctx.addIssue({
        code: "custom",
        message: "Verified coordinates require a point",
      });
    if (p.latitude !== null && !p.sources.coordinates.sourceUrl)
      ctx.addIssue({
        code: "custom",
        message: "Directory pins need a supporting source",
      });
  });
export type DirectoryCandidate = z.infer<typeof directoryCandidateSchema>;
