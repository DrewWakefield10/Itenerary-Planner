import expansion from "./directory-expansion.json";
import foodAdditions from "./directory-food.json";
import {foodForPlace,matchesFoodFilter} from "./food";
import {placeContent} from "./place-content";
import {mergeCommittedDirectory} from "./directory-import";
import luzon from "./directory-luzon.json";
import visayas from "./directory-visayas.json";
import islands from "./directory-islands.json";
import type {
  DirectoryCandidate,
  DirectoryGeography,
} from "./directory-schema";
export { destinationGroups, directoryCategories } from "./directory-schema";
export type {
  DirectoryCandidate,
  DirectoryGeography,
} from "./directory-schema";
export const originalDirectoryCandidates = [
  ...islands,
  ...visayas,
  ...luzon,
] as DirectoryCandidate[];
export const directoryCandidates=mergeCommittedDirectory(originalDirectoryCandidates, [...expansion,...foodAdditions] as DirectoryCandidate[]);
export const directoryListings = directoryCandidates.filter(
  (p) => p.status === "accepted",
);
// Correct the live presentation without rewriting immutable research snapshots.
// The reviewed farm identity does not establish a named dining venue.
export const categoryForPlace=(p:DirectoryCandidate)=>p.id==="bohol-green-thumb-farm"?"Nature":p.category;
export const directoryTargets: Record<string, number> = {
  Palawan: 45,
  Cebu: 35,
  Manila: 32,
  Siargao: 30,
  Bohol: 30,
  Boracay: 28,
  Baguio: 30,
  Iloilo: 35,
  Davao: 35,
  Batanes: 30,
  Sagada: 20,
};
export const directoryGroupImages: Record<string, string> = {
  Palawan: "palawan",
  Cebu: "cebu",
  Manila: "manila",
  Siargao: "siargao",
  Bohol: "bohol",
  Boracay: "boracay",
  Baguio: "baguio",
  Iloilo: "iloilo",
  Davao: "davao",
  Batanes: "batanes",
  Sagada: "sagada",
};
export const groupForBase = (slug: string | null) =>
  slug && ["el-nido", "coron", "puerto-princesa", "palawan"].includes(slug)
    ? "Palawan"
    : Object.keys(directoryTargets).find((g) => g.toLowerCase() === slug) ||
      null;
export function geographyOf(p: DirectoryCandidate): DirectoryGeography {
  const {
    destination_group,
    region,
    province,
    city_municipality,
    barangay,
    address,
    latitude,
    longitude,
    sources,
  } = p;
  return structuredClone({
    destination_group,
    region,
    province,
    city_municipality,
    barangay,
    address,
    latitude,
    longitude,
    sources,
  });
}
export const addressLabel = (p: DirectoryGeography) =>
  [p.address, p.barangay, p.city_municipality, p.province, p.region]
    .filter((v, i, a) => v && a.indexOf(v) === i)
    .join(", ");
export const searchText = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export function filterDirectory({
  group = "all",
  category = "all",
  interest = "all",
  search = "",
  foodType = "all",
}: {
  group?: string;
  category?: string;
  interest?: string;
  search?: string;
  foodType?: string;
} = {}) {
  const query = searchText(search);
  const cafeQuery=/^(cafe|cafes)$/.test(query);
  const coffeeQuery=/^(coffee|coffee shop|coffee shops)$/.test(query);
  const diningQuery=/^(dining|restaurant|restaurants)$/.test(query);
  const foodQuery=query==="food";
  return directoryListings.filter(
    (p) =>
      matchesFoodFilter(p.id,foodType) &&
      (!cafeQuery||matchesFoodFilter(p.id,"cafe")) &&
      (!coffeeQuery||foodForPlace(p.id)?.suitability.includes("coffee")) &&
      (!diningQuery||matchesFoodFilter(p.id,"meal")) &&
      (!foodQuery||!!foodForPlace(p.id)) &&
      (group === "all" || p.destination_group === group) &&
      (category === "all" || categoryForPlace(p) === category) &&
      (interest === "all" || p.interests.includes(interest)) &&
      searchText(
        [
          p.name,
          ...(p.aliases||[]),
          p.description,
          placeContent(p.id)?.summary,
          ...(placeContent(p.id)?.overview||[]),
          p.destination_group,
          p.city_municipality,
          p.province,
          p.barangay,
          p.address,
          ...(foodForPlace(p.id)?.specialties||[]),
          ...(foodForPlace(p.id)?.suitability||[]),
        ]
          .filter(Boolean)
          .join(" "),
      ).includes(cafeQuery||coffeeQuery||foodQuery||diningQuery?"":query),
  );
}
