# Itinerary selection

The active update is category-accurate itinerary generation, not the interrupted 150-place research expansion. Existing IDs and source records are preserved.

## Classification and eligibility

`lib/catalog/place-types.ts` explicitly classifies stable catalog IDs using their existing reviewed identities/descriptions. These editorial types are independent of expense categories and the broad directory browsing groups. No keyword classifier turns a beach bar into a beach or every food venue into a café. Islands, beaches, markets, shops, museums and other types are distinct; multi-purpose venues may have several supported types. Unclassified places cannot fulfill an exact-type request. Classification does not establish current access or operating status and does not change any fact's source metadata or review date.

The planner's optional place-type checkboxes use OR matching. Selecting specific types takes priority over personality interests, including named must-visits that conflict with those types. With no explicit types, personalities filter appropriate types; a named must-visit can override a broad interest, but not booking, location or scheduling rules. Unmatched must-visits are reported. No interest selection means any otherwise eligible type. Beach Bum alone selects actual beaches, not islands, boardwalks or beachfront restaurants.

`candidateStops` is shared by generation, regeneration and the AI menus. It checks exact overnight base, distinct identity, candidate/manual status, package components, requested types/interests, avoid names, booking prerequisites, excursion opt-in, arrival/departure windows, accessibility constraints and known opening hours. An accepted directory identity alone does not make a place eligible for automatic scheduling. Cafe del Sol, for example, remains manual because the reviewed source did not establish its precise branch location.

Candidates use a seeded Fisher-Yates shuffle followed by stable priority ranking. Must-visits, matching interests and estimated cost retain priority; equally ranked eligible choices vary. `randomSeed` is optional: absent/null gives fresh choices; a supplied seed reproduces choices for a given catalog and request. Regeneration uses its variant in the seed and keeps locks/other days. Variation is limited when few eligible alternatives exist.

## Geography, schedules and shortages

Only one editorial cluster is used per day. When both coordinate pairs are verified, each next stop must be within 4 km of both the first and previous visit. Missing/estimated pins never establish a distance. Existing narrow editorial clusters support grouping when pins are missing; actual routes and travel times remain unverified. At least 45 minutes (or a larger recorded planning buffer) separates visits. Known closed days/hours are respected; unknown hours remain unknown. Non-local outings require opt-in and an entire non-arrival/non-departure day. Separate bases retain connection days.

Canonical IDs, aliases and package/component relationships prevent repeated catalog places across the trip. Locks remain intact during regeneration, and new stops cannot conflict with locked full-day outings or their transfer buffers. When fewer matching visits fit than the pace allows, open time and a shortage notice are retained. Explicit type counts disclose zero matches; generic meal/rest/travel placeholders have no catalog ID or place type and never count as a matching venue. Manual traveler edits/additions remain explicit choices rather than being silently filtered out.

## AI contract

The provider sends at most 24 eligible catalog candidates per day and can receive `{dayIndex, stopIds}` selections alongside the existing title/day-title/notes response. It accepts no model-authored activities, source statuses, coordinates, prices or schedules. Editorial-only responses remain compatible.

Every selection must belong to that day's supplied menu. The application transactionally rebuilds the full proposal using trusted catalog facts and the same scheduler. Wrong IDs, wrong base/type, repeated canonical places, overlapping package components, connection-day changes, excess pace, closed hours, geographic conflicts and choices that cannot fit are rejected. Any invalid proposal retains the catalog draft unchanged and displays an explicit fallback notice. Invalid provider JSON/schema responses still return an error with the saved draft preserved. Accepted activities retain per-fact sources; generated scheduling and cost allowances remain estimates.

Request/activity schema defaults keep older saves/imports compatible. Exact types and seeds round-trip with trip backups; activity snapshots are not reclassified from today's catalog. Renaming a place clears its catalog identity and types.

## Validation and remaining work

`tests/selection.test.ts` covers 21 types across all 13 selectable bases (273 combinations), seed repeatability/variation, broad Beach Bum behavior, negative beach-bar cases, booking/hours/manual exclusions, cluster distance/buffers, shortages, regeneration locks, invalid and accepted AI selections, canonical duplicates, evidence preservation and old imports. `tests/selection-browser.mjs` checks desktop/mobile controls, actual café generation, shortage notices, reload and JSON restore. Provider calls use deterministic fixtures; live model credentials were not available for an end-to-end external AI call.

The earlier research expansion remains at 332 accepted listings (200 original + 132 additions), with 18 pending: Sagada 10, Iloilo 4, Davao 4. The exact interrupted-research state and resumption steps are in `expansion-progress.md`. No new unreviewed entries were invented for this generation update. Unknown pins, hours, admission and transport details remain labeled as estimates or unverified.

Local verification on 22 October 2026: all 65 unit tests and catalog validation passed; all eight pre-existing browser suites passed, and the new ninth selection suite passed at desktop and 390 px mobile sizes, including backup restore. Screenshots were inspected. Vinext/Sites and native Next.js production builds and the final type check passed. Existing nonblocking build notices remain: a client chunk exceeds 500 kB, Vinext cannot statically classify some routes, and Next ignores a lockfile outside this repository. Deployment results are reported separately rather than inferred from local tests.
