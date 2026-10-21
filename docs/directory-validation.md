# Directory validation — 21 October 2026

The final dataset has 250 real-place candidate records: 200 accepted, 35 rejected, and 15 unresolved. Every destination meets its editorial target. Accepted identity and municipality evidence are independent from admission, hours, transport, accessibility and coordinate evidence.

## Checks completed

- `npm run export:directory`: candidate schema, stable IDs, duplicate accepted names, stop references, combined JSON/CSV, progress and destination batch snapshots passed.
- `npm run validate:catalog`: seed structure, coordinates, per-fact source consistency, aliases, parents, price units and package/component relationships passed.
- `npm test`: 51 tests passed, including all 13 overnight bases, itinerary uniqueness, opening hours, full-day excursions, independent metadata, exact-base additions, stale previews and old trip imports.
- Eight browser suites passed: foundation, planner, interactive editing, portability, sources, weather alternatives, travel bases and Discover. The first five and remaining three were run in sequence after the weather fixture was updated to request its specific test attraction. The final directory browser check also covers 11 destination selectors, combined filters, municipality search, pagination/URL restoration and bounds, actual Makati/San Vicente labels, outlying browse-only entries, mobile targets/overflow, lazy map loading, dismissal, explicit acceptance, persistence and source links.
- CSV parsed with Python's standard CSV reader and compared with JSON: the same 200 accepted IDs.
- `npm run build`, `npm run build:vercel`, and `npm run typecheck` passed on the final runtime code.
- Frontend strict project audit and DESIGN.md lint passed with no blocking findings. Changed directory files were formatted; no browser alert/confirm/prompt or placeholder links were introduced.
- Desktop and 390px mobile screenshots were visually inspected. Existing journal styling, local licensed images, and fallback art remain consistent.

Passing structure/tests is not factual verification. Source review notes are in directory-luzon.md, directory-visayas.md and directory-islands.md; exact decisions remain in the combined candidate export.

## Known limits

27 accepted locations have sourced reference pins; the other 173 have no fabricated fallback pin. 146 street/venue addresses are unknown. Practical itinerary seed details exist for 162 records; five have a sourced admission amount, while other entry prices remain unknown and budget allowances remain estimates. 156 records have both a stop reference and an approved overnight-base mapping; package components and uncertain-access venues have additional add restrictions. Outlying places without a base mapping remain browse-only rather than being inserted into a city itinerary.

Regular hours, current access, reservations and transport require traveler confirmation. No current weather advisory, accessibility guarantee or booking availability is inferred. Malcapuya and Banana Island remain unresolved for municipality and are excluded from accepted counts. Build tools report a large catalog JavaScript chunk and an unrelated lockfile outside this repository; both production builds complete successfully. No framework, database, billing, or audience change was made.
