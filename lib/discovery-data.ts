import type {DirectoryCandidate} from "./catalog/directory-schema";
import type { SourceMetadata } from "./sources";

export type DiscoveryPlace = {
  id: string;
  kind: "base" | "spot";
  name: string;
  baseSlug: string | null;
  directory?: DirectoryCandidate;
  category: string;
  /** Exact, reviewed mapping into the itinerary catalog. Never fuzzy-match. */
  stopName?: string;
  stopId?: string;
  interests?: string[];
  description: string;
  reason: string;
  platform:
    | "Tourism website"
    | "Wikipedia"
    | "TikTok"
    | "Facebook"
    | "YouTube"
    | "Other";
  source: SourceMetadata;
  supports: string;
  reviewedOn: string | null;
  reviewExpiresOn?: string;
  originalPostUrl?: string;
  coordinates?: { lat: number; lng: number; source: SourceMetadata };
  locationSource?: SourceMetadata;
  image?: { src: string; alt: string; creditUrl: string };
  /** Canonical English article reviewed as describing this exact place. */
  wikipedia?: { title: string; reviewedOn: string };
};
const reviewedOn = "2026-10-19";
const source = (sourceName: string, sourceUrl: string): SourceMetadata => ({
  sourceName,
  sourceUrl,
  dateChecked: reviewedOn,
  status: "verified",
});
const wiki = (title: string) => ({ title, reviewedOn });
const parks = source(
  "City Government of Baguio — Tourist spots",
  "https://infoboard.baguio.gov.ph/tourists-spots",
);
const casa = source(
  "Casa Gorordo Museum — official visitor information",
  "https://www.casagorordomuseum.org/",
);
const wikipedia = (title: string) =>
  source(
    `Wikipedia — ${title}`,
    `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replaceAll(" ", "_"))}`,
  );
const photo = (slug: string, alt: string) => ({
  src: `/images/${slug}.jpg`,
  alt,
  creditUrl: "/image-credits.txt",
});

// Editorial seed file: all claims below were reviewed, not scraped social trends.
// Practical details are inherited fact by fact from the mapped catalog stop.
export const discoverySeeds: DiscoveryPlace[] = [
  {
    id: "base-baguio",
    kind: "base",
    name: "Baguio",
    baseSlug: "baguio",
    category: "Overnight base",
    description:
      "A city base for Burnham Park and the Leonard Wood Road parks.",
    reason:
      "Selected for several reviewed park stops within one overnight base.",
    platform: "Tourism website",
    source: parks,
    supports: "The city directory identifies these attractions in Baguio.",
    reviewedOn,
    image: photo("baguio", "Burnham Park in Baguio"),
    wikipedia: wiki("Baguio"),
  },
  {
    id: "base-cebu",
    kind: "base",
    name: "Cebu City",
    baseSlug: "cebu",
    category: "Overnight base",
    description:
      "A city base for heritage stops near Plaza Independencia and Parian.",
    reason: "Selected for heritage places with institutional visitor sources.",
    platform: "Tourism website",
    source: source(
      "National Museum of the Philippines — Cebu",
      "https://www.nationalmuseum.gov.ph/2023/07/31/nmp-inaugurates-component-museum-in-cebu/",
    ),
    supports:
      "The museum locates its Cebu site at Plaza Independencia near Fort San Pedro.",
    reviewedOn,
    image: photo("discover-fort-san-pedro", "Fort San Pedro in Cebu City"),
    wikipedia: wiki("Cebu City"),
  },
  {
    id: "base-el-nido",
    kind: "base",
    name: "El Nido",
    baseSlug: "el-nido",
    category: "Overnight base",
    description: "An overnight base at the northern end of mainland Palawan.",
    reason: "Selected as an explicit Palawan base, with its own catalog stops.",
    platform: "Wikipedia",
    source: wikipedia("El Nido, Palawan"),
    supports:
      "The article identifies El Nido in northern mainland Palawan; readership is about the municipality, not bookings.",
    reviewedOn,
    image: photo("palawan", "Limestone islands in Bacuit Bay, El Nido"),
    wikipedia: wiki("El Nido, Palawan"),
  },
  {
    id: "base-coron",
    kind: "base",
    name: "Coron",
    baseSlug: "coron",
    category: "Overnight base",
    description:
      "Use Coron town on Busuanga as the overnight base; Coron Island is a separate place.",
    reason:
      "Selected to help distinguish a town stay from offshore excursions.",
    platform: "Wikipedia",
    source: wikipedia("Coron, Palawan"),
    supports:
      "The article covers Coron municipality and its town on Busuanga, not only Coron Island. Readership covers the municipality.",
    reviewedOn,
    image: photo("coron", "Coron town and port seen from Mount Tapyas"),
    wikipedia: wiki("Coron, Palawan"),
  },
  {
    id: "base-puerto-princesa",
    kind: "base",
    name: "Puerto Princesa",
    baseSlug: "puerto-princesa",
    category: "Overnight base",
    description:
      "A city-proper base for Plaza Cuartel and nearby heritage streets.",
    reason: "Selected for a compact city stay with a city-tourism source.",
    platform: "Tourism website",
    source: source(
      "Puerto Princesa City Tourism — Plaza Cuartel",
      "https://citytourism.puertoprincesa.ph/plaza-cuartel/",
    ),
    supports:
      "City Tourism places Plaza Cuartel on Taft Street in the city proper.",
    reviewedOn,
    image: photo("puerto-princesa", "Puerto Princesa City Baywalk"),
    wikipedia: wiki("Puerto Princesa"),
  },
  {
    id: "baguio-burnham-park",
    kind: "spot",
    name: "Burnham Park",
    baseSlug: "baguio",
    stopName: "Burnham Park",
    category: "Park",
    description: "A historic urban park in downtown Baguio.",
    reason:
      "Selected as a central park stop and a reference point for nearby discoveries.",
    platform: "Wikipedia",
    source: wikipedia("Burnham Park (Baguio)"),
    supports:
      "The article supports the park's identity, downtown setting, and reference coordinates; it does not verify activity fees or current access.",
    reviewedOn,
    coordinates: {
      lat: 16.41056,
      lng: 120.59472,
      source: wikipedia("Burnham Park (Baguio)"),
    },
    image: photo("baguio", "Burnham Park, Baguio"),
    wikipedia: wiki("Burnham Park (Baguio)"),
  },
  {
    id: "baguio-botanical-garden",
    kind: "spot",
    name: "Baguio Botanical Garden",
    baseSlug: "baguio",
    stopName: "Baguio Botanical Garden",
    category: "Garden",
    description: "A garden on Leonard Wood Road in Baguio.",
    reason: "Selected for the same local park cluster as Wright Park.",
    platform: "Tourism website",
    source: parks,
    supports:
      "The city directory supports the garden's identity and Leonard Wood Road location.",
    reviewedOn,
    image: photo("discover-baguio-botanical-garden", "Baguio Botanical Garden"),
    wikipedia: wiki("Baguio Botanical Garden"),
  },
  {
    id: "baguio-wright-park",
    kind: "spot",
    name: "Wright Park",
    baseSlug: "baguio",
    stopName: "Wright Park",
    category: "Park",
    description: "A park on Romulo Drive near The Mansion in Baguio.",
    reason: "Selected as a local park stop while staying in Baguio.",
    platform: "Tourism website",
    source: parks,
    supports:
      "The city directory identifies Wright Park near The Mansion; paid activities and current access are not verified.",
    reviewedOn,
    image: photo("discover-wright-park", "Wright Park in Baguio"),
    wikipedia: wiki("Wright Park (Baguio)"),
  },
  {
    id: "cebu-fort-san-pedro",
    kind: "spot",
    name: "Fort San Pedro",
    baseSlug: "cebu",
    stopName: "Fort San Pedro",
    category: "Heritage site",
    description:
      "A heritage fort near the National Museum's Plaza Independencia site in Cebu City.",
    reason:
      "Selected for a Cebu City heritage day, using an institutional location reference.",
    platform: "Tourism website",
    source: source(
      "National Museum of the Philippines — Cebu",
      "https://www.nationalmuseum.gov.ph/2023/07/31/nmp-inaugurates-component-museum-in-cebu/",
    ),
    supports:
      "The museum identifies Fort San Pedro near its Plaza Independencia site; this does not verify fort admission or hours.",
    reviewedOn,
    image: photo("discover-fort-san-pedro", "Fort San Pedro, Cebu City"),
  },
  {
    id: "cebu-casa-gorordo",
    kind: "spot",
    name: "Casa Gorordo Museum",
    baseSlug: "cebu",
    stopName: "Casa Gorordo Museum area",
    category: "Museum",
    description:
      "A museum at 35 E. Aboitiz Street in Cebu City, with a shop and café described on its official website.",
    reason:
      "Selected for its official visitor information and a possible indoor visit.",
    platform: "Tourism website",
    source: casa,
    supports:
      "The museum's own site gives its address, regular Monday–Saturday hours, shop, and café. Special closures and current admission still need confirmation.",
    reviewedOn,
    locationSource: casa,
    image: photo("discover-casa-gorordo", "Casa Gorordo Museum, Cebu City"),
  },
  {
    id: "puerto-princesa-plaza-cuartel",
    kind: "spot",
    name: "Plaza Cuartel",
    baseSlug: "puerto-princesa",
    stopName: "Plaza Cuartel",
    category: "Heritage site",
    description:
      "A historic former garrison site on Taft Street in Puerto Princesa.",
    reason:
      "Selected for a city-proper heritage stop with local tourism information.",
    platform: "Tourism website",
    source: source(
      "Puerto Princesa City Tourism — Plaza Cuartel",
      "https://citytourism.puertoprincesa.ph/plaza-cuartel/",
    ),
    supports:
      "City Tourism identifies the historic site and address; its older transport prices are not treated as current quotes.",
    reviewedOn,
    image: photo("discover-plaza-cuartel", "Plaza Cuartel in Puerto Princesa"),
  },
];
