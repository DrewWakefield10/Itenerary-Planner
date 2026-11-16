import { mkdir, writeFile } from "node:fs/promises";
import { discoveryPlaces } from "../lib/discovery";
import { destinationGroups } from "../lib/catalog/directory";
import {
  googleMapsTarget,
  mapsReferences,
  validateMapsReferences,
} from "../lib/google-maps";

// Offline only. No key, network requests, matching API, catalog writes or auto-approval.
// Keep completed reviews; refresh this queue when independent catalog data changes.
const reviews = validateMapsReferences(mapsReferences, discoveryPlaces);
const places = discoveryPlaces.filter((place) => place.directory);
const entries = places.map((place) => {
  const target = googleMapsTarget(place, reviews);
  const review = reviews.find((record) => record.lakbayId === place.id);
  return {
    lakbayId: place.id,
    name: place.name,
    destination: place.directory!.destination_group,
    cityMunicipality: target.municipality,
    independentlyVerifiedCoordinates: !!target.point,
    googleMatchStatus: target.reviewed
      ? "verified"
      : review?.status || "unresolved",
    googlePlaceId: target.reviewed?.placeId ?? null,
    checkedOn: review?.checkedOn ?? null,
    reason:
      review?.reviewNote ??
      "No Google place match has been reviewed. Search links are useful planning aids, not verified pins.",
    searchUrl: target.searchUrl,
    directionsUrl: target.directionsUrl,
  };
});
const progress = {
  generatedAt: new Date().toISOString(),
  note: "Queue generation is not location verification. Google Places, Details and Photos API requests: 0. No coordinates are inferred or copied from Google.",
  total: entries.length,
  verifiedGoogleMatches: entries.filter(
    (entry) => entry.googleMatchStatus === "verified",
  ).length,
  verifiedCatalogPins: entries.filter(
    (entry) => entry.independentlyVerifiedCoordinates,
  ).length,
  destinations: Object.fromEntries(
    destinationGroups.map((group) => {
      const locations = entries.filter((entry) => entry.destination === group);
      return [
        group,
        {
          total: locations.length,
          verifiedGoogleMatches: locations.filter(
            (entry) => entry.googleMatchStatus === "verified",
          ).length,
          verifiedCatalogPins: locations.filter(
            (entry) => entry.independentlyVerifiedCoordinates,
          ).length,
        },
      ];
    }),
  ),
  entries,
};
await mkdir("public/data", { recursive: true });
await writeFile(
  "public/data/google-maps-progress.json",
  JSON.stringify(progress, null, 2) + "\n",
);
console.log(
  `${progress.total} places with Maps links; ${progress.verifiedCatalogPins} independently verified pins; ${progress.verifiedGoogleMatches} reviewed Google IDs. No network requests.`,
);
