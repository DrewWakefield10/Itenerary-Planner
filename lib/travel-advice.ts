import { officialTravelLinks, officialAdvisories } from "./destinations";

// Editorial planning checklists distilled from the existing planner/Essentials.
// No current timetable, entry rule, price or weather claim is introduced.
export const travelAdvice = [
  {
    slug: "transport",
    title: "Getting between places",
    summary:
      "Choose overnight bases, leave room for transfers and confirm the actual service.",
    basis: "Existing destination transport notes and connection-day behavior.",
    sections: [
      {
        title: "Start with your overnight bases",
        text: "Separate bases need a transfer. El Nido, Coron and Puerto Princesa are distinct choices; nearby stops within a base stay ordinary visits. The planner reserves connection days between selected bases.",
      },
      {
        title: "Confirm the journey",
        text: "Before booking, confirm terminals, dates, schedules, baggage, accessibility, permits and the final transfer to your accommodation directly with the operator. Lakbay does not book transport or provide live timetables.",
      },
      {
        title: "Leave room for change",
        text: "Keep flexibility around arrivals and marine connections. Check current official notices and operator updates. Forecasts are planning signals; they do not establish outdoor or marine safety.",
      },
    ],
    resources: officialAdvisories,
  },
  {
    slug: "budgeting",
    title: "Make room in your budget",
    summary:
      "Use the planner’s allowances as a starting point, then replace them with confirmed costs.",
    basis:
      "Existing planner budget categories, group allowances and reserve controls.",
    sections: [
      {
        title: "Decide what the allowance includes",
        text: "Choose a total or per-person budget and whether to include flights and accommodation. Keep food, activities, local transport and connections in view when comparing destinations.",
      },
      {
        title: "Treat examples as estimates",
        text: "Destination daily allowances and itinerary costs are illustrative planning estimates. They are not current quotes or proof of an admission fee. Confirm prices, inclusions and payment methods with each provider.",
      },
      {
        title: "Keep a reserve",
        text: "Use the planner’s reserve setting for changes and extra costs. After generating a trip, compare planned and actual spending in Budget. Avoid counting a flexible meal allowance and a named meal twice.",
      },
    ],
    resources: [],
  },
  {
    slug: "packing",
    title: "Pack for your own trip",
    summary:
      "A short checklist for documents, comfortable days and useful backups.",
    basis:
      "Existing generated-trip packing checklist and editable Essentials view.",
    sections: [
      {
        title: "Documents and useful copies",
        text: "Prepare identification and required documents, booking confirmations and transport details. Keep offline copies, chargers, a power bank, cash and a payment backup suited to your trip.",
      },
      {
        title: "Comfort and personal needs",
        text: "Choose clothing and comfortable footwear for the planned activities. Consider rain and sun protection, personal care essentials, and your usual medication and first-aid supplies. Confirm individual access needs with venues.",
      },
      {
        title: "Make the checklist yours",
        text: "A generated itinerary includes an editable packing checklist in Essentials. Add your own items and confirmed local emergency contacts. A general checklist does not assess personal entry requirements.",
      },
    ],
    resources: [],
  },
  {
    slug: "preparation",
    title: "Before you set off",
    summary:
      "Review documents, booking details, access needs and current official information.",
    basis:
      "Existing itinerary Essentials preparation and official-source links.",
    sections: [
      {
        title: "Check the requirements for you",
        text: "Requirements depend on your route, nationality and circumstances. Confirm accepted identification with your operator. For international arrival, consult the official portals for passport, visa and applicable eTravel procedures; this guide is not an entry assessment.",
      },
      {
        title: "Check each practical detail",
        text: "Confirm permits, environmental fees, baggage rules, insurance, accessibility and terminal transfers directly. A checked source date records when a source was reviewed and does not guarantee it remains current.",
      },
      {
        title: "Keep the itinerary flexible",
        text: "Review forecast availability and official advisories. Use the itinerary’s existing Plan B preview when plans change; only an explicit acceptance applies a replacement. Export a backup and save account trips explicitly when you want them stored privately.",
      },
    ],
    resources: officialTravelLinks,
  },
];
export const adviceArticle = (slug: string) =>
  travelAdvice.find((a) => a.slug === slug);
