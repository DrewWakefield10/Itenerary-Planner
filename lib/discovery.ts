import { destination, type Stop } from "./destinations";
import { discoverySeeds, type DiscoveryPlace } from "./discovery-data";
export { type DiscoveryPlace } from "./discovery-data";
export const discoveryPlaces = discoverySeeds;
export const discoveryPlace = (id: string) =>
  discoveryPlaces.find((p) => p.id === id);
export const reviewExpired = (place: DiscoveryPlace, now = new Date()) =>
  !!place.reviewExpiresOn &&
  place.reviewExpiresOn < now.toISOString().slice(0, 10);

export function discoveryStop(place: DiscoveryPlace): Stop | null {
  if (place.kind !== "spot") return null;
  const stop = destination(place.baseSlug)?.stops.find(
    (s) => s.name === place.stopName,
  );
  if (!stop) return null;
  const result = structuredClone(stop);
  if (place.coordinates) {
    result.lat = place.coordinates.lat;
    result.lng = place.coordinates.lng;
    result.sources.coordinates = { ...place.coordinates.source };
  }
  if (place.locationSource) {
    result.locationDetails = place.description;
    result.sources.location = { ...place.locationSource };
  }
  return result;
}
export function verifiedPlaceCoordinates(place: DiscoveryPlace) {
  const stop = discoveryStop(place);
  const base = destination(place.baseSlug);
  const point =
    place.coordinates ||
    (place.kind === "spot" && stop
      ? { lat: stop.lat, lng: stop.lng, source: stop.sources.coordinates }
      : base
        ? { lat: base.lat, lng: base.lng, source: base.sources.coordinates }
        : null);
  return point?.source.status === "verified" ? point : null;
}
export function straightLineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const rad = (n: number) => (n * Math.PI) / 180;
  const x =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) *
      Math.cos(rad(b.lat)) *
      Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}
export function nearbyDiscoveries(
  baseSlug: string,
  originId?: string,
  now = new Date(),
) {
  const candidates = discoveryPlaces.filter(
    (p) => p.baseSlug === baseSlug && !reviewExpired(p, now),
  );
  const origin = originId
    ? candidates.find((p) => p.id === originId)
    : candidates.find(
        (p) => p.kind === "base" && verifiedPlaceCoordinates(p),
      ) || candidates.find((p) => verifiedPlaceCoordinates(p));
  const center = origin && verifiedPlaceCoordinates(origin);
  if (!origin || !center) return { origin: null, spots: [] };
  return {
    origin,
    spots: candidates
      .filter((p) => p.kind === "spot" && p.id !== origin.id)
      .flatMap((place) => {
        const point = verifiedPlaceCoordinates(place);
        if (!point) return [];
        const km = straightLineKm(center, point);
        return km <= 15 ? [{ place, km }] : [];
      })
      .sort((a, b) => a.km - b.km),
  };
}
