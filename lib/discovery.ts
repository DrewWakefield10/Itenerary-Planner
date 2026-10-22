import { destination, selectableDestinations, destinationImage, type Stop } from "./destinations";
import { discoverySeeds, type DiscoveryPlace } from "./discovery-data";
export { type DiscoveryPlace } from "./discovery-data";
import {directoryListings,geographyOf} from "./catalog/directory";
import {placeContent} from "./catalog/place-content";
const curated=new Map(discoverySeeds.map(p=>[p.id,p]));
const basePlaces:DiscoveryPlace[]=selectableDestinations.map(base=>curated.get(`base-${base.slug}`)||{
  id:`base-${base.slug}`,kind:"base",name:base.name,baseSlug:base.slug,category:"Overnight base",
  description:base.locationDetails,reason:"An overnight base with its own stops and separate excursions.",
  platform:"Other",source:base.sources.location,supports:"Fact-specific review status applies; this is not a trend.",reviewedOn:base.sources.location.dateChecked,
  image:{src:destinationImage(base.slug),alt:base.name,creditUrl:"/image-credits.txt"},
});
// Compatibility details are retained for saved links and package previews, but
// only accepted, unique physical locations enter the public directory count.
const catalogPlaces:DiscoveryPlace[]=selectableDestinations.flatMap(base=>base.stops.map(s=>({
  ...(curated.get(s.id)||{id:s.id,kind:"spot" as const,name:s.name,baseSlug:base.slug,category:s.category,
    description:s.description,reason:s.mode==="local"?"A stop in the itinerary collection.":"A separate outing; confirm transfers and access.",
    platform:"Other" as const,source:s.sources.description,supports:"Itinerary catalog entry; check individual facts before visiting.",reviewedOn:s.sources.description.dateChecked}),
  stopId:s.id,stopName:s.name,interests:s.interests,
})));
export const discoveryPlaces:DiscoveryPlace[]=[...basePlaces,...directoryListings.map(p=>{
  const original=curated.get(p.id)||curated.get(p.catalog_stop_id||"");
  const editorial=placeContent(p.id);
  return {
    id:p.id,kind:"spot" as const,name:p.name,baseSlug:p.itinerary_base_slug,category:p.category,
    stopId:p.catalog_stop_id||undefined,description:editorial?.summary||p.description,editorial,interests:p.interests,directory:p,
    reason:"Reviewed location identity and municipality. Check each practical detail separately.",
    platform:original?.platform||"Other" as const,source:editorial?{sourceName:editorial.sources[0].name,sourceUrl:editorial.sources[0].url,dateChecked:editorial.sources[0].checkedOn,status:p.sources.identity.status}:p.sources.identity,
    supports:"Identity and municipality were reviewed. Prices, opening hours, accessibility and current access have independent review statuses.",
    reviewedOn:editorial?.sources[0].checkedOn||p.reviewed_on,...(editorial?.photo?{image:{...editorial.photo,creditUrl:editorial.photo.sourcePage}}:original?.image?{image:original.image}:{}),...(original?.wikipedia?{wikipedia:original.wikipedia}:{}),
    ...(p.latitude!==null&&p.longitude!==null?{coordinates:{lat:p.latitude,lng:p.longitude,source:p.sources.coordinates}}:{}),
  };
})];
export const discoveryPlace=(id:string)=>discoveryPlaces.find(p=>p.id===id)||catalogPlaces.find(p=>p.id===id);
export const reviewExpired = (place: DiscoveryPlace, now = new Date()) =>
  !!place.reviewExpiresOn &&
  place.reviewExpiresOn < now.toISOString().slice(0, 10);

export function discoveryStop(place: DiscoveryPlace): Stop | null {
  if (place.kind !== "spot" || (place.directory && !place.stopId)) return null;
  const stop = (place.baseSlug?destination(place.baseSlug)?.stops:selectableDestinations.flatMap(d=>d.stops))?.find(
    (s) => place.stopId ? s.id === place.stopId : s.name === place.stopName,
  );
  if (!stop) return null;
  const result = structuredClone(stop);
  if(place.directory){
    result.geography=geographyOf(place.directory);
    result.lat=place.directory.latitude;result.lng=place.directory.longitude;
    result.sources.coordinates=structuredClone(place.directory.sources.coordinates);
  }
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
export function placeCoordinates(place: DiscoveryPlace) {
  const stop = discoveryStop(place);
  const base = place.kind==="base"?destination(place.baseSlug):undefined;
  const point =
    place.coordinates ||
    (place.kind === "spot" && stop
      ? { lat: stop.lat, lng: stop.lng, source: stop.sources.coordinates }
      : base
        ? { lat: base.lat, lng: base.lng, source: base.sources.coordinates }
        : null);
  return point && point.lat!==null && point.lng!==null ? {lat:point.lat,lng:point.lng,source:point.source} : null;
}
export function verifiedPlaceCoordinates(place:DiscoveryPlace) {
  const point=placeCoordinates(place);
  return point?.source.status==="verified"?point:null;
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
      .filter((p) => p.kind === "spot" && p.id !== origin.id && discoveryStop(p)?.mode==="local")
      .flatMap((place) => {
        const point = verifiedPlaceCoordinates(place);
        if (!point) return [];
        const km = straightLineKm(center, point);
        return km <= 15 ? [{ place, km }] : [];
      })
      .sort((a, b) => a.km - b.km),
  };
}
