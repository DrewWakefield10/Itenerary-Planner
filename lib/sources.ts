import { z } from "zod/v3";

const checkedDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      !Number.isNaN(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
    "Use a valid calendar date",
  );
export const sourceMetadataSchema = z
  .object({
    sourceName: z.string().trim().min(1).max(200).nullable(),
    sourceUrl: z
      .string()
      .url()
      .max(2000)
      .refine(
        (value) => /^https?:\/\//i.test(value),
        "Sources must use HTTP or HTTPS",
      )
      .nullable(),
    dateChecked: checkedDate.nullable(),
    status: z.enum(["verified", "estimate", "unverified"]),
  })
  .superRefine((source, ctx) => {
    if (
      source.status === "verified" &&
      (!source.sourceName || !source.sourceUrl || !source.dateChecked)
    ) {
      ctx.addIssue({
        code: "custom",
        message:
          "Verified facts need a named source, a URL, and a checked date.",
      });
    }
  });
export type SourceMetadata = z.infer<typeof sourceMetadataSchema>;
export function unverifiedSource(): SourceMetadata {
  return {
    sourceName: null,
    sourceUrl: null,
    dateChecked: null,
    status: "unverified",
  };
}
export function estimatedSource(): SourceMetadata {
  return {
    sourceName: "Lakbay planning assumptions",
    sourceUrl: null,
    dateChecked: null,
    status: "estimate",
  };
}
// Keys refer only to their corresponding values. Location is the textual context;
// coordinates are separate because checking a town does not verify a map pin.
export const factSourcesSchema = z.object({
  description: sourceMetadataSchema.default(unverifiedSource),
  location: sourceMetadataSchema.default(unverifiedSource),
  coordinates: sourceMetadataSchema.default(unverifiedSource),
  price: sourceMetadataSchema.default(estimatedSource),
  transport: sourceMetadataSchema.default(unverifiedSource),
  accessibility: sourceMetadataSchema.default(unverifiedSource),
  schedule: sourceMetadataSchema.default(estimatedSource),
  booking: sourceMetadataSchema.default(unverifiedSource),
  season: sourceMetadataSchema.default(unverifiedSource),
  food: sourceMetadataSchema.default(unverifiedSource),
  region: sourceMetadataSchema.default(unverifiedSource),
});
export type FactSources = z.infer<typeof factSourcesSchema>;
export const defaultFactSources = (): FactSources =>
  factSourcesSchema.parse({});
export const sourcedLinkSchema = z.object({
  label: z.string().min(1).max(200),
  source: sourceMetadataSchema,
});
export type SourcedLink = z.infer<typeof sourcedLinkSchema>;
export const sourceReviewNote =
  "A checked date records when a source was reviewed; it does not guarantee the information is still current. Each label applies only to the detail beside it.";
export function sourceLabel(source: SourceMetadata) {
  if (source.status !== "verified")
    return source.status === "estimate" ? "Estimate" : "Unverified";
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(source.dateChecked! + "T12:00:00Z"));
  return `Checked ${date.replace(" ", ". ")}`;
}
