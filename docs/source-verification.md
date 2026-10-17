# Travel source metadata

Reviewed on **18 October 2026**. Dates refer to review of the linked source, not publication date, a live feed, or a guarantee of continued accuracy.

| Fact reviewed | Source | Scope |
| --- | --- | --- |
| Burnham is listed among Baguio's parks and attractions | [City Government of Baguio — VISITA](https://visita.baguio.gov.ph/) | Destination context and Burnham stop context only; no precise coordinates, prices, hours, or accessibility verification. |
| Cebu's National Museum is at Plaza Independencia, near Fort San Pedro | [National Museum inauguration article, 31 July 2023](https://www.nationalmuseum.gov.ph/2023/07/31/nmp-inaugurates-component-museum-in-cebu/) | Location context only. The article's historic museum hours and free admission claim are not applied to the Fort or used as current prices. |
| El Nido is in northern Palawan; Puerto Princesa provides overland access | [Travel Philippines — El Nido](https://app.philippines.travel/interests/el-nido) | Geographic context and existence of overland access only. Old transport durations, operators, schedules, and prices are not adopted. |
| Official tropical cyclone bulletin page | [DOST-PAGASA](https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin) | Page identity/link only. No current bulletin or safety assessment is stored. |
| Official traveler information portals | [eTravel](https://etravel.gov.ph/), [Bureau of Immigration](https://immigration.gov.ph/) | Portal identity/links only. No traveler-specific entry or visa requirements are verified. |

All seed prices, including zero-cost placeholders, remain **estimates**. Proposed times/durations remain estimates. Exact coordinates, accessibility, opening hours, booking availability, most local transport guidance, seasons, and food suggestions remain **unverified** unless their particular field says otherwise. Unreviewed facts have a null checked date and no supporting URL; URLs are never inferred from a destination name.

`lib/sources.ts` defines the shared Zod metadata schema and per-fact defaults. `sources.location` applies to `locationDetails`; `sources.coordinates` applies separately to latitude/longitude. Price metadata applies to the numeric allowance, never to the location. The legacy activity `source` string and `provenance` remain available as context and generation origin.

New trips snapshot relevant destination facts in `destinationInfo`, as well as each activity's fact sources and official advisory links. Browser persistence, JSON import/export, read-only snapshots, undo, duplication, and regeneration preserve these fields. Printed journals include source URLs. Older trips default to unverified facts/estimated allowances without dates and receive no retroactive verification from today's seeds.

Activity editing clears only the evidence affected by an edit. Replacing a seed stop copies that stop's evidence; generated descriptions and proposed schedules remain unverified/estimated. Renaming a place clears its location context and related verification. Locked/unaffected items retain their metadata. A Plan B replacement starts with conservative defaults. Source URL imports allow HTTP(S) only, and a verified fact requires a source name, URL, and valid checked date.

To extend the curated set, inspect the source and record exactly which statement it supports in `lib/destinations.ts`. Never advance check dates as part of generation or attach a location source to an estimated fee.

Casa Gorordo Museum's [official visitor page](https://www.casagorordomuseum.org/) was also reviewed on 18 October 2026 for its published Monday–Saturday 09:00–17:00 hours. Activities store these hours with their own source, separate from `sources.schedule` for the proposed visit time and duration. Fees remain estimates. See [rain planning](rain-planning.md) for how these hours constrain suggestions and what still needs confirmation.
