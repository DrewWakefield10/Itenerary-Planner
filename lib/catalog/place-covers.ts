import { z } from "zod/v3";
import type { DiscoveryPlace } from "../discovery-data";
import raw from "./place-cover-assets.json";
import { foodForPlace } from "./food";
import { placePhotoSchema } from "./place-content-schema";

export const supplementalCoverSchema = z
  .object({
    kind: z.enum(["promotion", "logo"]),
    asset: placePhotoSchema,
    rightsEvidence: z.string().trim().min(25),
    directoryUseAllowed: z.literal(true),
    resizingAllowed: z.literal(true),
  })
  .strict()
  .superRefine(({ asset }, context) => {
    const local = /^\/images\/place-covers\/[\w-]+\.(?:jpe?g|png|webp|avif)$/i;
    const originalHost = URL.parse(asset.originalUrl)?.hostname ?? "";
    if (
      !local.test(asset.src) ||
      (asset.srcSmall && !local.test(asset.srcSmall)) ||
      /(^|\.)(?:instagram\.com|cdninstagram\.com|fbcdn\.net|googleusercontent\.com|ggpht\.com|ytimg\.com)\.?$/i.test(
        originalHost,
      )
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Use a rights-cleared local cover with the original publisher documented.",
      });
    }
  });

type SupplementalCover = z.infer<typeof supplementalCoverSchema>;
const covers = new Map<string, SupplementalCover[]>();
for (const row of z.array(supplementalCoverSchema).parse(raw)) {
  const existing = covers.get(row.asset.placeId) ?? [];
  if (existing.some((cover) => cover.kind === row.kind))
    throw new Error(`Duplicate ${row.kind} cover for ${row.asset.placeId}`);
  covers.set(row.asset.placeId, [...existing, row]);
}

type Cover = {
  kind: "photo" | "promotion" | "logo";
  image: NonNullable<DiscoveryPlace["image"]>;
};
export function coverChoices(
  place: Pick<DiscoveryPlace, "id" | "image">,
  assets = covers.get(place.id) ?? [],
): Cover[] {
  const eligible = assets.filter((cover) => cover.asset.placeId === place.id);
  return [
    ...(place.image ? [{ kind: "photo" as const, image: place.image }] : []),
    ...(["promotion", "logo"] as const).flatMap((kind) => {
      const asset = eligible.find((cover) => cover.kind === kind)?.asset;
      return asset
        ? [{ kind, image: { ...asset, creditUrl: asset.sourcePage } }]
        : [];
    }),
  ];
}

export function illustrationFor(
  place: Pick<DiscoveryPlace, "id" | "category" | "name">,
) {
  const food = foodForPlace(place.id);
  if (food?.venueType === "food-market" || /\bmarket\b/i.test(place.name))
    return "market";
  if (food?.primary === "cafe" || food?.venueType === "bakery") return "cafe";
  if (/food/i.test(place.category)) return "dining";
  if (/\b(beach|island|cove|lagoon|coast|shoal|surf|reef)\b/i.test(place.name))
    return "coast";
  if (
    place.category === "Parks & markets" ||
    /\b(garden|park)\b/i.test(place.name)
  )
    return "park";
  if (place.category === "Culture") return "heritage";
  if (place.category === "Nature") return "nature";
  return "attraction";
}
