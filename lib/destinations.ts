import {
  defaultFactSources,
  type FactSources,
  type SourceMetadata,
  type SourcedLink,
} from "./sources";
export type Stop = {
  name: string;
  lat: number;
  lng: number;
  category: string;
  cost: number;
  minutes: number;
  outdoor: boolean;
  cluster: string;
  locationDetails: string;
  accessibility: string;
  transport: string;
  sources: FactSources;
  advisories: SourcedLink[];
};
export type Destination = {
  slug: string;
  name: string;
  region: string;
  caption: string;
  description: string;
  tags: string[];
  days: number;
  daily: number;
  lat: number;
  lng: number;
  season: string;
  transport: string;
  food: string;
  stops: Stop[];
  locationDetails: string;
  accessibility: string;
  sources: FactSources;
  advisories: SourcedLink[];
};
const s = (
  name: string,
  lat: number,
  lng: number,
  category: string,
  cost: number,
  cluster: string,
  outdoor = true,
  minutes = 90,
): Stop => ({
  name,
  lat,
  lng,
  category,
  cost,
  cluster,
  outdoor,
  minutes,
  locationDetails: "Location context has not been independently checked.",
  accessibility:
    "Accessibility has not been verified. Confirm step-free access and individual needs with the venue or operator.",
  transport:
    cluster === "boat"
      ? "Boat operator, terminal, permit, and conditions must be confirmed."
      : "Local movement allowance only; route and actual travel time unverified.",
  sources: defaultFactSources(),
  advisories: [],
});
const seeds: Omit<
  Destination,
  "locationDetails" | "accessibility" | "sources" | "advisories"
>[] = [
  {
    slug: "palawan",
    name: "Palawan",
    region: "MIMAROPA",
    caption: "A little closer to paradise.",
    description:
      "Limestone cliffs, quiet coves, and water in a hundred shades of blue. Start your Palawan chapter in El Nido, with slow mornings and room for the unexpected.",
    tags: ["Beaches", "Nature", "Adventure"],
    days: 5,
    daily: 2800,
    lat: 11.179,
    lng: 119.392,
    season:
      "Marine trips depend on local conditions and coast guard clearance. Leave flexibility for rain.",
    transport:
      "El Nido is the base. Puerto Princesa requires a separate long overland transfer. Confirm arrival airport and transport before booking.",
    food: "Fresh fish, grilled vegetables, and market meals.",
    stops: [
      s("El Nido town walk", 11.18, 119.391, "Culture", 0, "town"),
      s("Corong Corong beach", 11.163, 119.395, "Beaches", 0, "town"),
      s("Local market & lunch", 11.173, 119.397, "Food", 300, "town", false),
      s(
        "Big Lagoon — optional guided outing",
        11.157,
        119.321,
        "Adventure",
        1800,
        "boat",
        true,
        300,
      ),
      s("Lio beach afternoon", 11.205, 119.415, "Beaches", 300, "lio"),
    ],
  },
  {
    slug: "siargao",
    name: "Siargao",
    region: "CARAGA",
    caption: "Find your own island rhythm.",
    description:
      "Salt in your hair, coconut roads, and long afternoons in General Luna. There is as much joy in slowing down as there is in catching a wave.",
    tags: ["Beaches", "Adventure", "Nature", "Hidden Gems"],
    days: 4,
    daily: 2400,
    lat: 9.784,
    lng: 126.158,
    season:
      "Rain and surf vary by coast and month. Check local conditions before water activities.",
    transport:
      "Base around General Luna. Arrange a separate airport transfer and confirm transport locally.",
    food: "Kinilaw, fresh fruit, and island cafes.",
    stops: [
      s("General Luna waterfront", 9.784, 126.159, "Nature", 0, "town"),
      s("General Luna market", 9.783, 126.158, "Food", 250, "town", false),
      s("Cloud 9 boardwalk area", 9.81, 126.165, "Beaches", 150, "cloud9"),
      s("Catangnan coastal afternoon", 9.805, 126.157, "Nature", 0, "cloud9"),
    ],
  },
  {
    slug: "cebu",
    name: "Cebu",
    region: "CENTRAL VISAYAS",
    caption: "History with a side of adventure.",
    description:
      "An island of many chapters. This starter itinerary stays in Cebu City, pairing heritage streets with generous plates of local food. The photo shows Kawasan Falls, a separate excursion.",
    tags: ["Culture", "Food", "Family", "Adventure"],
    days: 3,
    daily: 1800,
    lat: 10.294,
    lng: 123.902,
    season:
      "Keep indoor alternatives for rain. Marine and countryside outings need separate planning.",
    transport:
      "Seed stops stay in Cebu City. Kawasan, Moalboal, and Oslob require separate travel days. Verify onward ferry terminals and schedules.",
    food: "Cebu lechon, puso, and bakery snacks.",
    stops: [
      s("Fort San Pedro", 10.292, 123.905, "Culture", 100, "heritage"),
      s("Magellan’s Cross area", 10.294, 123.902, "Culture", 0, "heritage"),
      s(
        "Cebu heritage food break",
        10.296,
        123.903,
        "Food",
        300,
        "heritage",
        false,
      ),
      s(
        "Casa Gorordo Museum area",
        10.3,
        123.906,
        "Culture",
        200,
        "heritage",
        false,
      ),
    ],
  },
  {
    slug: "bohol",
    name: "Bohol",
    region: "CENTRAL VISAYAS",
    caption: "Little wonders, lasting memories.",
    description:
      "Coastal afternoons in Panglao, with a separate countryside day if time permits. Leave space between Bohol’s far-apart sights. The Chocolate Hills photo is inspiration for an additional outing.",
    tags: ["Nature", "Family", "Beaches"],
    days: 3,
    daily: 2300,
    lat: 9.55,
    lng: 123.774,
    season:
      "Expect changing tropical conditions. Check local weather before excursions.",
    transport:
      "Panglao is the base. Chocolate Hills needs a separately confirmed vehicle and full-day allowance.",
    food: "Grilled seafood, vegetable dishes, and calamay.",
    stops: [
      s("Alona beach walk", 9.55, 123.774, "Beaches", 0, "alona"),
      s("Panglao local lunch", 9.554, 123.774, "Food", 300, "alona", false),
      s("Danao beach afternoon", 9.543, 123.759, "Nature", 100, "danao"),
      s("Panglao town plaza", 9.578, 123.746, "Culture", 0, "town"),
    ],
  },
  {
    slug: "boracay",
    name: "Boracay",
    region: "WESTERN VISAYAS",
    caption: "Barefoot is a state of mind.",
    description:
      "White Beach mornings and glorious sunsets. Walk between beach stations and keep your days delightfully uncomplicated.",
    tags: ["Beaches", "Family", "Budget"],
    days: 3,
    daily: 2400,
    lat: 11.963,
    lng: 121.925,
    season:
      "Beach conditions vary between coasts. Verify local advisories and boat transfers.",
    transport:
      "Confirm your gateway airport and Caticlan jetty connection. Airport-to-island prices are not live quotes.",
    food: "Seafood, fruit shakes, and casual local eateries.",
    stops: [
      s("White Beach — Station 2", 11.961, 121.925, "Beaches", 0, "whitebeach"),
      s(
        "D’Mall food stroll",
        11.962,
        121.927,
        "Food",
        350,
        "whitebeach",
        false,
      ),
      s("White Beach — Station 1", 11.969, 121.921, "Beaches", 0, "whitebeach"),
      s("Bulabog beach walk", 11.966, 121.93, "Nature", 0, "bulabog"),
    ],
  },
  {
    slug: "baguio",
    name: "Baguio",
    region: "CORDILLERA",
    caption: "Take the scenic, cooler route.",
    description:
      "Pine-scented air, creative corners, and warm cups of coffee. A compact city escape for market wandering and unhurried park mornings.",
    tags: ["Mountains", "Food", "Budget", "Culture"],
    days: 3,
    daily: 1400,
    lat: 16.403,
    lng: 120.596,
    season:
      "Bring layers and rain protection. Mountain road disruptions can change access.",
    transport:
      "Confirm your bus terminal and current journey time. Stops are grouped in central Baguio; travel into the city is separate.",
    food: "Strawberry treats, local vegetables, and Cordillera coffee.",
    stops: [
      s("Burnham Park", 16.409, 120.596, "Nature", 0, "central"),
      s("Baguio Public Market", 16.416, 120.596, "Food", 200, "central", false),
      s("Baguio Cathedral area", 16.412, 120.599, "Culture", 0, "central"),
      s(
        "Session Road cafe break",
        16.412,
        120.598,
        "Food",
        200,
        "central",
        false,
      ),
    ],
  },
  {
    slug: "batanes",
    name: "Batanes",
    region: "CAGAYAN VALLEY",
    caption: "Where the wind tells stories.",
    description:
      "Stone houses and open horizons. Begin in Basco and let local guidance and weather shape your island time.",
    tags: ["Nature", "Culture", "Hidden Gems", "Mountains"],
    days: 4,
    daily: 3200,
    lat: 20.449,
    lng: 121.97,
    season:
      "Exposed island conditions can interrupt travel. Keep contingency days.",
    transport:
      "Verify flights into Basco. Other islands need separately confirmed boat transport; none is assumed here.",
    food: "Seasonal vegetables and Ivatan cooking.",
    stops: [
      s("Basco town walk", 20.449, 121.97, "Culture", 0, "basco"),
      s("Basco local lunch", 20.451, 121.97, "Food", 350, "basco", false),
      s("Basco lighthouse area", 20.451, 121.963, "Nature", 100, "basco"),
      s("Basco heritage streets", 20.45, 121.972, "Culture", 0, "basco"),
    ],
  },
  {
    slug: "iloilo",
    name: "Iloilo",
    region: "WESTERN VISAYAS",
    caption: "Come hungry. Leave happy.",
    description:
      "Heritage, river walks, and bowls worth traveling for. Get to know Iloilo one neighborhood and one delicious stop at a time.",
    tags: ["Food", "Culture", "Budget", "Family"],
    days: 3,
    daily: 1500,
    lat: 10.697,
    lng: 122.564,
    season: "Plan indoor food and heritage alternatives for rainy afternoons.",
    transport:
      "Group stops by neighborhood and arrange transport between districts. Airport transfers need a separate allowance.",
    food: "La Paz batchoy and pancit molo.",
    stops: [
      s("Iloilo River Esplanade", 10.7, 122.55, "Nature", 0, "molo"),
      s("Molo Church & plaza", 10.697, 122.544, "Culture", 0, "molo"),
      s(
        "Molo neighborhood food stop",
        10.697,
        122.545,
        "Food",
        250,
        "molo",
        false,
      ),
      s("Jaro plaza & heritage area", 10.721, 122.558, "Culture", 0, "jaro"),
    ],
  },
  {
    slug: "davao",
    name: "Davao",
    region: "DAVAO REGION",
    caption: "A fresh perspective down south.",
    description:
      "City parks, colorful markets, and distinctive local flavors. Use Davao City as a gentle introduction to the region.",
    tags: ["Nature", "Food", "Family"],
    days: 3,
    daily: 1700,
    lat: 7.073,
    lng: 125.613,
    season:
      "Check local forecasts and destination notices for excursions outside the city.",
    transport:
      "Stops stay in central Davao. Mountain and island excursions require separate transport verification.",
    food: "Durian, pomelo, and grilled tuna.",
    stops: [
      s("People’s Park", 7.073, 125.613, "Nature", 0, "central"),
      s("San Pedro Cathedral area", 7.064, 125.61, "Culture", 0, "central"),
      s(
        "Davao local food break",
        7.068,
        125.611,
        "Food",
        250,
        "central",
        false,
      ),
      s(
        "Museo Dabawenyo area",
        7.063,
        125.611,
        "Culture",
        100,
        "central",
        false,
      ),
    ],
  },
  {
    slug: "sagada",
    name: "Sagada",
    region: "CORDILLERA",
    caption: "Make room for mountain mornings.",
    description:
      "A slow mountain stay built around village walks and local food. Guided caves and hikes should be confirmed with the local tourism office.",
    tags: ["Mountains", "Adventure", "Culture", "Hidden Gems"],
    days: 3,
    daily: 1600,
    lat: 17.084,
    lng: 120.9,
    season:
      "Mountain rain affects trails and roads. Guided activities require current local advice.",
    transport:
      "Allow full travel days into and out of Sagada. Avoid demanding hikes after a long road arrival.",
    food: "Mountain coffee and home-style meals.",
    stops: [
      s("Sagada village walk", 17.084, 120.9, "Culture", 0, "village"),
      s("Church of Saint Mary area", 17.085, 120.902, "Culture", 0, "village"),
      s(
        "Sagada coffee & local lunch",
        17.084,
        120.901,
        "Food",
        250,
        "village",
        false,
      ),
      s(
        "Village craft browsing",
        17.083,
        120.9,
        "Culture",
        100,
        "village",
        false,
      ),
    ],
  },
  {
    slug: "manila",
    name: "Manila",
    region: "NATIONAL CAPITAL REGION",
    caption: "Old streets, new discoveries.",
    description:
      "Trace stories through Intramuros and take your time between heritage stops. Plan each neighborhood as its own small adventure.",
    tags: ["Culture", "Food", "Budget"],
    days: 2,
    daily: 1800,
    lat: 14.59,
    lng: 120.975,
    season: "Heat and rain call for shade, water, and indoor breaks.",
    transport:
      "Traffic is variable. Intramuros stops are grouped; cross-city transfers need extra time.",
    food: "Filipino classics and nearby Binondo specialties.",
    stops: [
      s("Fort Santiago area", 14.594, 120.97, "Culture", 200, "intramuros"),
      s("Manila Cathedral area", 14.592, 120.973, "Culture", 0, "intramuros"),
      s(
        "Intramuros lunch break",
        14.589,
        120.975,
        "Food",
        300,
        "intramuros",
        false,
      ),
      s(
        "San Agustin Museum area",
        14.589,
        120.975,
        "Culture",
        250,
        "intramuros",
        false,
      ),
    ],
  },
];
// These dates record an actual source review on 18 October 2026. Do not advance
// dates automatically during generation or infer verification for adjacent facts.
const reviewed = (sourceName: string, sourceUrl: string): SourceMetadata => ({
  sourceName,
  sourceUrl,
  dateChecked: "2026-10-18",
  status: "verified",
});
const baguioSource = reviewed(
  "City Government of Baguio — VISITA",
  "https://visita.baguio.gov.ph/",
);
const cebuSource = reviewed(
  "National Museum of the Philippines — Cebu museum inauguration",
  "https://www.nationalmuseum.gov.ph/2023/07/31/nmp-inaugurates-component-museum-in-cebu/",
);
const elNidoSource = reviewed(
  "Travel Philippines — El Nido",
  "https://app.philippines.travel/interests/el-nido",
);
export const officialAdvisories: SourcedLink[] = [
  {
    label: "PAGASA tropical cyclone bulletin page",
    source: reviewed(
      "DOST-PAGASA",
      "https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin",
    ),
  },
];
export const officialTravelLinks: SourcedLink[] = [
  {
    label: "Official eTravel portal",
    source: reviewed(
      "Philippine Travel Information System",
      "https://etravel.gov.ph/",
    ),
  },
  {
    label: "Bureau of Immigration portal",
    source: reviewed("Bureau of Immigration", "https://immigration.gov.ph/"),
  },
];
const checkedLocations: Record<
  string,
  { text: string; source: SourceMetadata }
> = {
  baguio: {
    text: "Baguio’s city tourism portal lists Burnham among its parks and attractions.",
    source: baguioSource,
  },
  cebu: {
    text: "The National Museum’s Cebu site is at Plaza Independencia, near Fort San Pedro in Cebu City.",
    source: cebuSource,
  },
  palawan: {
    text: "El Nido is at the northern end of Palawan.",
    source: elNidoSource,
  },
};
const checkedStops: Record<string, { text: string; source: SourceMetadata }> = {
  "Burnham Park": {
    text: "Burnham is listed among Baguio City’s parks and attractions.",
    source: baguioSource,
  },
  "Fort San Pedro": {
    text: "Fort San Pedro is near the National Museum’s Plaza Independencia site in Cebu City.",
    source: cebuSource,
  },
  "El Nido town walk": {
    text: "El Nido is at the northern end of Palawan.",
    source: elNidoSource,
  },
};
export const destinations: Destination[] = seeds.map((d) => {
  const location = checkedLocations[d.slug];
  const sources = defaultFactSources();
  if (location) sources.location = { ...location.source };
  const transport =
    d.slug === "palawan"
      ? "Puerto Princesa to El Nido is an overland journey. Confirm the operator, arrival airport, and current travel time before booking."
      : d.transport;
  // Only the existence of this overland access option was checked, not a schedule,
  // fare, service availability, or travel-time guarantee.
  if (d.slug === "palawan") sources.transport = { ...elNidoSource };
  return {
    ...d,
    transport,
    locationDetails:
      location?.text || "Location context has not been independently checked.",
    accessibility:
      "Accessibility has not been verified. Confirm step-free access and individual needs with venues and transport operators.",
    sources,
    advisories: structuredClone(officialAdvisories),
    stops: d.stops.map((stop) => {
      const checked = checkedStops[stop.name];
      return {
        ...stop,
        locationDetails: checked?.text || stop.locationDetails,
        sources: {
          ...stop.sources,
          ...(checked ? { location: { ...checked.source } } : {}),
        },
        advisories: structuredClone(officialAdvisories),
      };
    }),
  };
});
export const categories = [
  "All",
  "Beaches",
  "Mountains",
  "Food",
  "Adventure",
  "Culture",
  "Nature",
  "Hidden Gems",
  "Family",
  "Budget",
];
export const personalities = [
  "Beach Bum",
  "Mountain Explorer",
  "Food Hunter",
  "Culture Seeker",
  "Adventure Junkie",
  "Nature Lover",
  "City Wanderer",
  "Slow Traveler",
  "Hidden Gem Collector",
];
export const destination = (slug: string) =>
  destinations.find((d) => d.slug === slug);
export const peso = (n: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(n);
export const templates = [
  { title: "Baguio Weekend Escape", slugs: ["baguio"], days: 3 },
  { title: "Palawan 5-Day Adventure", slugs: ["palawan"], days: 5 },
  { title: "Siargao Island Experience", slugs: ["siargao"], days: 4 },
  { title: "Cebu & Bohol Adventure", slugs: ["cebu", "bohol"], days: 6 },
  { title: "Boracay Budget Trip", slugs: ["boracay"], days: 3 },
  { title: "Iloilo Food Tour", slugs: ["iloilo"], days: 3 },
  { title: "Manila Heritage Weekend", slugs: ["manila"], days: 2 },
  { title: "Davao Nature Escape", slugs: ["davao"], days: 3 },
];
