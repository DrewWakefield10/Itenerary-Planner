import {
  selectableDestinations,
  destination,
  templates,
  type Destination,
} from "./destinations";
import {
  directoryListings,
  groupForBase,
  searchText,
  categoryForPlace,
} from "./catalog/directory";
import { typesForStop, type PlaceType } from "./catalog/place-types";
import { foodForPlace } from "./catalog/food";
import type { DirectoryCandidate } from "./catalog/directory-schema";
import { adviceArticle } from "./travel-advice";

export const exploreInterests = [
  { value: "All", label: "All" },
  { value: "Beaches", label: "Beaches" },
  { value: "Food", label: "Food & cafés" },
  { value: "Culture", label: "Culture" },
  { value: "Nature", label: "Nature" },
  { value: "City", label: "City experiences" },
  { value: "Mountains", label: "Mountains" },
  { value: "Adventure", label: "Adventure" },
];
const interestTypes: Record<string, PlaceType[]> = {
  Beaches: ["beach"],
  Culture: ["museum", "heritage", "church"],
  Nature: [
    "beach",
    "garden",
    "park",
    "island",
    "waterfall",
    "cave",
    "lake",
    "river",
    "trail",
    "viewpoint",
    "wildlife",
  ],
  City: ["museum", "heritage", "church", "park", "market", "shopping"],
  Mountains: ["trail", "viewpoint", "waterfall"],
  Adventure: ["trail", "cave", "activity", "island"],
};
export function placesForGuide(slug: string) {
  const group = groupForBase(slug);
  return directoryListings.filter(
    (p) =>
      p.destination_group === group &&
      (group !== "Palawan" ||
        slug === "palawan" ||
        (p.planning?.base_slug || p.itinerary_base_slug) === slug),
  );
}
export function matchesExploreInterest(d: Destination, interest: string) {
  const places = placesForGuide(d.slug);
  if (interest === "All") return true;
  if (interest === "Food") return places.some((p) => !!foodForPlace(p.id));
  // Older Explore links retain their planning lenses, without treating them as
  // verified affordability, family accessibility or popularity claims.
  if (["Budget", "Family", "Hidden Gems"].includes(interest))
    return d.tags.includes(interest) && places.length > 0;
  if (interest === "Mountains" && !d.tags.includes("Mountains")) return false;
  const types = interestTypes[interest];
  return (
    !!types &&
    places.some(
      (p) =>
        typesForStop(p.id).some((t) => types.includes(t)) &&
        (interest !== "City" ||
          /\bcity\b/i.test(p.city_municipality || "") ||
          p.destination_group === "Manila"),
    )
  );
}
export function exploreDestinations({
  category = "All",
  search = "",
  saved,
}: { category?: string; search?: string; saved?: string[] } = {}) {
  const query = searchText(search);
  return selectableDestinations.filter(
    (d) =>
      matchesExploreInterest(d, category) &&
      searchText(
        `${d.name} ${d.province || ""} ${d.region} ${d.description}`,
      ).includes(query) &&
      (!saved || saved.includes(d.slug)),
  );
}
export const discoverForDestination = (slug: string) => {
  const group = groupForBase(slug);
  return group
    ? "/discover?" + new URLSearchParams({ destination: group })
    : "/discover";
};
export function guideHighlights(slug: string): DirectoryCandidate[] {
  return placesForGuide(slug)
    .filter((p) => categoryForPlace(p) !== "Food & drink")
    .slice(0, 3);
}
export const guideFood = (slug: string) =>
  placesForGuide(slug)
    .filter((p) => !!foodForPlace(p.id))
    .slice(0, 2);
export const startersForDestination = (slug: string) =>
  templates.filter((t) => t.slugs.includes(slug));
export const planDestination = (slug: string) =>
  destination(slug)?.legacyOnly
    ? "/explore?q=Palawan"
    : `/planner?destinations=${encodeURIComponent(slug)}`;
export function retiredGuidesTarget(
  params: Record<string, string | string[] | undefined>,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    for (const v of Array.isArray(value)
      ? value
      : value === undefined
        ? []
        : [value])
      query.append(key, v);
  query.delete("view");
  return "/explore/advice" + (query.size ? "?" + query : "");
}
export function exploreRouteTitle(path: string, view?: string) {
  if (
    path === "/explore" ||
    path === "/templates" ||
    path === "/explore/advice"
  )
    return `${view === "advice" || path === "/templates" || path === "/explore/advice" ? "Travel advice" : "Explore destinations"} — Lakbay`;
  if (path.startsWith("/destinations/")) {
    const d = destination(path.split("/")[2]);
    return d
      ? `${d.name} destination guide — Lakbay`
      : "Destination not found — Lakbay";
  }
  if (path.startsWith("/explore/advice/")) {
    const article = adviceArticle(path.split("/")[3]);
    return article
      ? `${article.title} — Lakbay`
      : "Travel advice not found — Lakbay";
  }
  const titles: Record<string, string> = {
    "/discover": "Discover places",
    "/planner": "Plan a Trip",
    "/my-trips": "My Trips",
    "/saved-places": "Saved Places",
    "/account": "Account",
    "/profile": "Preferences & photo credits",
  };
  return `${titles[path] || (path.startsWith("/discover/") ? "Place details" : path.startsWith("/trips/") ? "Your itinerary" : "Page not found")} — Lakbay`;
}
