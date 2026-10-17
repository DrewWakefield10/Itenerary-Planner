# Rain-related planning suggestions

The first release supports **Baguio** and **Cebu City**. It offers proposals and never changes an itinerary in response to weather alone.

## Supported alternatives

| Destination | Existing seed alternative | Planning constraints |
| --- | --- | --- |
| Baguio | Session Road cafe break | Flexible 45-minute indoor cafe idea in the central planning area. A specific indoor venue, opening hours, accessibility, and dietary suitability must be confirmed. |
| Cebu City | Casa Gorordo Museum area | A 60-minute museum visit in the heritage planning area, constrained to the operator's published Monday–Saturday 09:00–17:00 hours. Guided-visit duration, admission, access, and special closures still need confirmation. |

Casa Gorordo's [official visitor page](https://www.casagorordomuseum.org/) was reviewed on **18 October 2026**. The published hours have their own source metadata, separate from estimated activity times and prices. Reviewing a webpage does not guarantee the hours remain current. All replacement costs remain seed estimates, not quotes.

## When a forecast prompts attention

The forecast must be available, match the itinerary date, and have a valid retrieval timestamp no more than six hours old (timestamps more than five minutes in the future are rejected). Past itinerary dates, missing rain information, unknown freshness, and malformed responses do not produce automatic suggestions.

A daily rain probability of **70% or more**, or a daily WMO code in **63, 65, 67, 81, 82, 95, 96, 99**, prompts a rain planning notice. These codes represent rain, showers, or thunderstorms. A high probability does not establish rain intensity; the daily aggregate does not predict rain at the exact activity time. See the [Open-Meteo daily variable documentation](https://open-meteo.com/en/docs).

Only activities explicitly tagged `heavy-rain` are identified as affected. `marine-conditions` and `heat` tags are stored for future extensions and do not trigger replacement logic in this release. Older activities without tags default to an empty list, with an explanation that absence of a tag does not establish absence of disruption. Travelers can edit these tags.

`WEATHER_ENABLED=true` enables the existing Open-Meteo integration. Without live weather, the app shows the unavailable state. Travelers can still choose **Make a Plan B → Heavy rain → Preview alternative** to report rain manually; the preview identifies this as their report, with no inferred forecast or advisory. If no curated alternative fits, the existing manual flexible-rest proposal remains available.

## Fitting and accepting a proposal

- The alternative must belong to the day's destination, share its local planning cluster, and not already be on that day.
- Approximate coordinates only reject clearly remote alternatives (over 3 km in straight-line proximity); that distance is never converted into road travel time. Missing coordinates require manual planning.
- A separate **45-minute planning buffer** is reserved on each side of the visit, using existing gaps or the original time block. These are conservative allowances, not verified route durations.
- The replacement visit must fit inside the original activity block and respect published opening days/hours. Existing overlaps, locked activities, transfer days, and insufficient time prevent a curated proposal.
- The preview shows the original/replacement names, times, visit durations, estimated group-cost difference, source indicators, and outstanding venue/transport checks. No other stops or dates move.
- **Confirm & apply** revalidates the proposal against the current trip, updates one activity, recalculates costs, and saves it. **Keep original** or **Dismiss** leaves saved data unchanged. Undo uses the existing itinerary history.

Rain suggestions are planning signals and do not establish outdoor, indoor, or marine safety. PAGASA links are provided for current official advice. The app does not fetch or interpret live official advisories, issue alerts, confirm bookings, verify local road conditions, or determine marine/heat suitability.

## Validation

`npm test` includes rain signal/freshness checks, destination and sensitivity matching, hours/buffer/conflict checks, immutable previews, accepted replacement costs, metadata serialization, and older-trip compatibility. With the local server running, `node tests/rain-browser.mjs` covers mobile preview/dismissal/acceptance, persistence, source links, stale/missing forecasts, manual reporting, and legacy records. It uses mocked weather responses; it does not claim a live forecast or advisory verification.
