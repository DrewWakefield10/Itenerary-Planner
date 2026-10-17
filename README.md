# Lakbay — Your Philippines, Your Adventure

A Philippine travel journal with a vintage scrapbook interface, practical itinerary planning, and honest demo mode. Built with React, TypeScript, Next-compatible App Router routes on Vinext, Zod, and Leaflet.

## Run locally

Requires Node.js 22.13 or later.

```powershell
cd "C:\Users\Ryzen\Desktop\itenerary planner\lakbay"
npm run install:ci
npm run dev
```

Open http://127.0.0.1:5173. Dependencies already exist in this checkout; installation is needed only for a fresh checkout or changed dependencies. `npm run build` creates the production Worker and browser bundles. `npm start` serves that build locally.

## What works

- Responsive scrapbook homepage; 11 Philippine destinations with local licensed photos, search, category filters, favorites, destination guides, and 8 customizable trip templates.
- Six-step questionnaire with browser-local draft persistence, multi-destination selection, adults/children, interests, budgets, emergency reserve, pace, and optional preferences.
- Deterministic demo generation; Zod-validated structured trips; grouped nearby stops; arrival/departure buffers and explicit unverified connection days.
- Day-by-day timeline with add/edit/replace/remove, time changes, accessible reorder buttons, locks, regeneration, and 20-step session undo. Conflicts and costs recalculate after changes.
- Lazy-loaded Leaflet map with numbered, selectable markers and OpenStreetMap attribution. No fabricated routes.
- Integer-peso group budgets, per-person estimates, reserves, overrun warnings, adjustable allowances, optional-cost reduction, stay allowance upgrades, and actual expense tracking.
- Manual Plan B proposals with a before/after preview and explicit confirmation. Other days and locked activities remain unchanged.
- Editable packing lists, journal notes, official travel-information links, rename/duplicate/delete, JSON export/import, read-only URL snapshots, and browser Print / Save PDF for the full itinerary.
- Optional server-side AI journal personalization and weather adapters with validation, timeout handling, and visible unavailable states.

## Configuration

No API credentials are needed for demo mode, maps, local persistence, or itinerary editing. Copy `.env.example` to `.env.local` for local configuration. Store production secrets through Sites environment settings, never in client variables or Git.

| Variable | Purpose |
| --- | --- |
| `AI_API_KEY` | Optional secret for a compatible chat-completions provider. |
| `AI_CHAT_URL` | Full HTTPS chat-completions endpoint accepting `messages`, `model`, and JSON response format. |
| `AI_MODEL` | Model identifier supported by that provider. |
| `WEATHER_ENABLED` | Set to `true` to request Open-Meteo forecasts. Defaults to disabled. |
| `WEATHER_API_KEY` | Optional Open-Meteo commercial key; switches to the customer API. Review provider terms before enabling. |

AI currently personalizes the title, day themes, and journal notes. Activity selection, schedules, regeneration, and arithmetic remain deterministic. Missing keys produce explicitly labeled demo itineraries; provider errors preserve the questionnaire and offer a manual demo fallback. Live paid-provider behavior has not been credential-tested.

Weather shows the forecast date, high temperature, rain probability, conditions, and retrieval time where available. Out-of-window dates and failures produce explicit fallback messages. Forecasts do not establish marine or outdoor safety. Provider responses were tested with fixtures; live weather is not enabled by default.

## Validation

```powershell
npm run typecheck
npm run lint
npm test
# Keep the development server running on port 5173 in another terminal:
npm run test:browser
npm run build
```

Unit tests cover low-budget Baguio, Cebu–Bohol connections, relaxed Palawan family travel, edits, locks, Plan B, missing credentials, all 11 destinations at three paces and two budget levels, malformed imports, AI response validation, and weather states. Browser tests use installed Google Chrome through Playwright and cover desktop/mobile navigation, filtering, questionnaire generation, saving, editing, map synchronization, budget tracking, packing lists, sharing, backups, and PDF printing. Generated screenshots and PDFs are ignored by Git.

## Code guide

- `app/`: shared layout, routes, styles, generation/weather HTTP handlers.
- `components/`: explorer and journal UI, questionnaire, itinerary editor, map, budgets, checklist, saved trips.
- `lib/trip.ts`: request, activity, day, and trip schemas/types.
- `lib/engine.ts`: deterministic generation, scheduling checks, budgets, regeneration, and Plan B.
- `lib/provider.ts`: optional server-only journal personalization adapter.
- `lib/destinations.ts`: illustrative seed data and templates.
- `lib/trip-storage.ts`: validated browser persistence.
- `tests/`: unit and browser scenarios.

## Data boundaries and remaining work

Costs are illustrative planning allowances, not verified fees or booking quotes. Map coordinates are approximate; opening hours, accessibility, dietary suitability, transport connections, and local requirements need confirmation. Small seed catalogs can repeat stops on longer trips. Free-text reservations and must-visit/avoid requests are retained for review; they are not guaranteed constraints. Add confirmed bookings as locked activities.

Guest data is local to each browser and origin. Clearing site data removes it; JSON exports can be restored as new trips. Shared links contain a static encoded snapshot, are not encrypted or revocable, and require access to the hosted Site. Sensitive preference fields and journal notes are omitted, but activity notes, dates, checklists, and expenses remain in the snapshot. Review before sharing. This is not multi-user collaboration or cross-device account sync.

Generation throttling is per running process/isolate (8 requests per minute per available client IP), not a distributed quota. Add durable quotas before broad paid-API use. The project does not provide booking availability, turn-by-turn routing, verified real-time advisories, personal entry-rule determinations, accounts, shared editing/voting, PWA/offline maps, push notifications, or booking integrations.

The next phase is authoritative transport/pricing data and reservation-aware scheduling, followed by authenticated persistence and group collaboration. The core guest workflow is the completed milestone; advanced Phase 5 functionality remains deferred.

## Credits and sources

Travel facts now carry individual source names, URLs, checked dates, and verified/estimate/unverified statuses. See [source review scope and maintenance notes](docs/source-verification.md). Run `node tests/sources-browser.mjs` with the local development server for the focused source-label, editing, export, sharing, and older-import browser check.

Photos and licenses: [image credits](docs/image-credits.md), also exposed in the application via `/image-credits.txt`. Fonts: Fraunces, DM Sans, and Caveat via Google Fonts. Maps: [Leaflet](https://leafletjs.com/) and [OpenStreetMap](https://www.openstreetmap.org/copyright). Destination inspiration: [Philippine Department of Tourism](https://philippines.travel/destinations). Organization reference: [Nordic Visitor](https://www.nordicvisitor.com/). Optional weather: [Open-Meteo documentation](https://open-meteo.com/en/docs). Official traveler links: [eTravel](https://etravel.gov.ph/), [Bureau of Immigration](https://immigration.gov.ph/), and [PAGASA](https://www.pagasa.dost.gov.ph/).

The retained Sites/Vinext runtime documentation is in [docs/starter-runtime.md](docs/starter-runtime.md).
