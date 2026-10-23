import {z} from "zod/v3";
import {sourceMetadataSchema} from "../sources";

/** One primary counting category; specialties never create additional places. */
export const foodProfileSchema=z.object({
  placeId:z.string(),primary:z.enum(["cafe","other-food"]),
  venueType:z.enum(["cafe","restaurant","bakery","dessert-shop","food-market","brewpub","food-shop"]),
  // A named café identity can be established while its exact menu is unknown.
  // Do not force a coffee/meal role merely to satisfy the schema.
  suitability:z.array(z.enum(["coffee","meal","bakery","dessert","breakfast"])),
  specialties:z.array(z.string().min(1)).max(12),
  source:sourceMetadataSchema,
  officialUrl:z.string().url().startsWith("https://").nullable(),
  publishedPrices:z.object({text:z.string().min(1),source:sourceMetadataSchema}).optional(),
  scheduling:z.enum(["candidate","manual"]).optional(),
  operation:z.object({basis:z.enum(["venue-offering","2026-accreditation","current-guide","recent-report","existing-source"]),source:sourceMetadataSchema,limitation:z.string().min(1)}),
});
export type FoodProfile=z.infer<typeof foodProfileSchema>;
