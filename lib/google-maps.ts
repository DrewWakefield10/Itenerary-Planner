import { z } from "zod/v3";
import references from "./catalog/google-maps-references.json";
import { destination } from "./destinations";
import { verifiedPlaceCoordinates, type DiscoveryPlace } from "./discovery";

// Google IDs are references, never replacements for Lakbay IDs or coordinates.
// No Places, Details, Photos, Geocoding or Routes API client runs on the website.
const httpsUrl = z
  .string()
  .url()
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  });
export const mapsReferenceSchema = z
  .object({
    lakbayId: z.string().min(1),
    expectedName: z.string().min(1),
    expectedMunicipality: z.string().min(1),
    expectedAddress: z.string().nullable(),
    status: z.enum(["verified", "ambiguous", "rejected", "unresolved"]),
    placeId: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .max(512)
      .nullable(),
    checkedOn: z.string().date(),
    evidenceUrls: z.array(httpsUrl).min(1),
    reviewNote: z.string().min(20),
  })
  .strict()
  .superRefine((record, context) => {
    if (record.status === "verified" && !record.placeId)
      context.addIssue({
        code: "custom",
        message: "A reviewed match needs a Google place ID",
      });
    if (
      record.status === "verified" &&
      (!record.evidenceUrls.some(isGoogleMapsUrl) ||
        !record.evidenceUrls.some((url) => !isGoogleMapsUrl(url)))
    )
      context.addIssue({
        code: "custom",
        message:
          "A reviewed match needs a Maps source and independent location evidence",
      });
  });
export type MapsReference = z.infer<typeof mapsReferenceSchema>;
export const mapsReferences = z.array(mapsReferenceSchema).parse(references);

function isGoogleMapsUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      (url.hostname === "www.google.com" && url.pathname.startsWith("/maps")) ||
      url.hostname === "maps.google.com" ||
      url.hostname === "maps.app.goo.gl"
    );
  } catch {
    return false;
  }
}

export function mapsMunicipality(place: DiscoveryPlace): string {
  // A browsing group (e.g. Manila or Davao) must not replace the actual city.
  return (
    place.directory?.city_municipality ||
    (place.kind === "base" ? destination(place.baseSlug)?.name : "") ||
    ""
  );
}

export function reviewedMapsReference(
  place: DiscoveryPlace,
  records = mapsReferences,
) {
  const matches = records.filter((record) => record.lakbayId === place.id);
  if (matches.length !== 1) return null;
  const record = matches[0];
  const parsed = mapsReferenceSchema.safeParse(record);
  if (
    !parsed.success ||
    record.status !== "verified" ||
    !record.placeId ||
    record.expectedName !== place.name ||
    record.expectedMunicipality !== mapsMunicipality(place) ||
    record.expectedAddress !== (place.directory?.address ?? null) ||
    record.checkedOn > new Date().toISOString().slice(0, 10) ||
    records.some(
      (other) =>
        other.lakbayId !== place.id &&
        other.status === "verified" &&
        other.placeId === record.placeId,
    )
  )
    return null;
  return record;
}

export function validateMapsReferences(
  records: unknown,
  places: DiscoveryPlace[],
) {
  const parsed = z.array(mapsReferenceSchema).parse(records);
  const ids = new Set<string>();
  for (const record of parsed) {
    if (ids.has(record.lakbayId))
      throw new Error(`Duplicate Maps review: ${record.lakbayId}`);
    ids.add(record.lakbayId);
    const place = places.find((place) => place.id === record.lakbayId);
    if (!place) throw new Error(`Unknown Lakbay ID: ${record.lakbayId}`);
    if (
      record.expectedName !== place.name ||
      record.expectedMunicipality !== mapsMunicipality(place) ||
      record.expectedAddress !== (place.directory?.address ?? null)
    )
      throw new Error(`Location changed; re-review ${record.lakbayId}`);
    if (record.checkedOn > new Date().toISOString().slice(0, 10))
      throw new Error(`Future review date: ${record.lakbayId}`);
    if (record.status === "verified" && !reviewedMapsReference(place, parsed))
      throw new Error(
        `Conflicting or invalid Google place match: ${record.lakbayId}`,
      );
  }
  return parsed;
}

export function googleMapsTarget(
  place: DiscoveryPlace,
  records = mapsReferences,
) {
  const directory = place.directory;
  const municipality = mapsMunicipality(place);
  const point = verifiedPlaceCoordinates(place);
  const reviewed = reviewedMapsReference(place, records);
  // Only independently reviewed address parts narrow the query. Keep branch
  // names intact. Google search results are never accepted as a verified pin.
  const parts = [
    place.name,
    directory?.sources.address.status === "verified" ? directory.address : null,
    municipality,
    directory?.province,
    "Philippines",
  ];
  const unique = [
    ...new Set(
      parts
        .filter((part): part is string => !!part?.trim())
        .map((part) => part.trim()),
    ),
  ];
  const query = unique.join(", ");
  const search = new URL("https://www.google.com/maps/search/");
  search.searchParams.set("api", "1");
  search.searchParams.set("query", query);
  const directions = new URL("https://www.google.com/maps/dir/");
  directions.searchParams.set("api", "1");
  directions.searchParams.set("destination", query);
  if (reviewed?.placeId) {
    search.searchParams.set("query_place_id", reviewed.placeId);
    directions.searchParams.set("destination_place_id", reviewed.placeId);
  }
  const canSearch =
    !!municipality &&
    (place.kind === "base" ||
      (directory?.sources.identity.status === "verified" &&
        directory.sources.municipality.status === "verified"));
  return {
    query,
    municipality,
    searchUrl: search.href,
    directionsUrl: directions.href,
    reviewed,
    point,
    mode: reviewed ? ("place" as const) : ("search" as const),
    canEmbed: !!reviewed || canSearch,
  };
}

export type GoogleMapsTarget = ReturnType<typeof googleMapsTarget>;
export type MapsEmbedConfig = { enabled: boolean; key: string };
export function mapsEmbedConfig(
  enabled: string | undefined,
  key: string | undefined,
): MapsEmbedConfig {
  return {
    enabled: enabled === "true" && !!key?.trim(),
    key: key?.trim() || "",
  };
}
export function googleMapsEmbedUrl(
  target: GoogleMapsTarget,
  config: MapsEmbedConfig,
) {
  if (!config.enabled || !config.key || !target.canEmbed) return null;
  const url = new URL(`https://www.google.com/maps/embed/v1/${target.mode}`);
  url.searchParams.set("key", config.key);
  url.searchParams.set(
    "q",
    target.reviewed ? `place_id:${target.reviewed.placeId}` : target.query,
  );
  if (!target.reviewed && target.point) {
    // A reviewed independent point biases search; it does not prove a Google match.
    url.searchParams.set("center", `${target.point.lat},${target.point.lng}`);
    url.searchParams.set("zoom", "15");
  }
  return url.href;
}
