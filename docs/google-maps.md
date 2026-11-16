# Google Maps for existing Lakbay places

Implementation reviewed against official Google documentation on **16 November 2026**.
No Google Cloud configuration, billing, credentials, production environment or deployment was changed by this task.

## Enabled and disabled

- Every one of the 426 accepted directory places has **Open in Google Maps** and **Get directions** on its existing detail page. Links are key-free and contain the exact catalog name, independently reviewed address when available, actual city/municipality, province and country. They do not request the traveler's location inside Lakbay. Google handles the origin and route after the link is opened.
- Optional **Maps Embed API** is implemented behind both a build-time switch and a browser key. The traveler explicitly chooses **Load Google map**. With no reviewed Google ID it shows **search results**, not a claimed verified marker. Only independently verified coordinates can center that search. Reviewed Google IDs use place mode. Attribution, branding, advertisements and controls remain in the complete, uncropped widget.
- Existing Leaflet detail and itinerary maps remain available. Approximate catalog pins are labeled and do not center Google searches or enable nearby distances.
- No Places API, Place Details, Photos, Geocoding, Routes, Maps JavaScript API, arbitrary-query proxy or automatic matching request exists in the website. There are no retries or API calls from cards. Setting an unrelated Places key cannot enable these services.
- Existing local licensed photographs, credits, Instagram opt-in behavior, immutable catalog records, exports, stable IDs, authentication, bookmarks and saved-trip snapshots are unchanged. Google maps and embeds do not count as approved cover photographs.

The starting data has **29 coordinate pairs, 11 independently verified pins and 397 missing pairs** among 426 places. There are currently **zero manually reviewed Google IDs**. This release makes all places findable through Maps links and supports address-based Google map search after configuration; it does **not** claim to have verified the remaining coordinates. `public/data/google-maps-progress.json` records every unresolved match, with null check dates until actual review. Generating this queue does not verify anything.

## Exact private setup for Vercel

No API key is necessary for ordinary links or existing Leaflet maps. No Maps key was found in the local environment files (names inspected without printing values). The connected Vercel lookup returned project-not-found, so the remote production environment could not be independently inspected.

To enable only the no-charge Embed service:

1. Open [Google Cloud Console](https://console.cloud.google.com/), select the intended project and review its billing configuration. Google's Embed setup currently requires a billing account even though Embed requests are no-charge. If you do not want to attach billing, leave embedding disabled; the links already work.
2. In **APIs & Services → Library**, enable **Maps Embed API** only for this integration. Do not enable Places, Geocoding, Routes or Maps JavaScript for this feature. Do not alter the OAuth client used for Google login.
3. In **APIs & Services → Credentials → Create credentials → API key**, create a **separate browser key** called, for example, `Lakbay Maps Embed`. Under **Application restrictions**, select **Websites (HTTP referrers)** and add exactly:

   ```text
   https://lakbay-itinerary-planner-psi.vercel.app/*
   ```

   Under **API restrictions**, choose **Restrict key → Maps Embed API**. Save the restrictions before using the key. Do not use an unrestricted key or allow other APIs. Avoid `*.vercel.app`; preview deployments should remain disabled unless individually authorized. For deliberate local development use a separate restricted development key and explicitly allow, for example, `http://localhost:5198/*`.

4. In the Lakbay **Vercel project → Settings → Environment Variables**, add these exact values in Production, privately in Vercel:

   | Variable                                | Value                             | Visibility                                     |
   | --------------------------------------- | --------------------------------- | ---------------------------------------------- |
   | `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY` | Restricted Maps Embed browser key | Intentionally public in the browser/iframe URL |
   | `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_ENABLED` | `true`                            | Public build-time switch                       |

   Do **not** reuse or change `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BETTER_AUTH_*` or `TURSO_*`. Never put OAuth, database or server secrets in a `NEXT_PUBLIC_` variable. No database migration or new server secret is required.

5. Push this implementation to the GitHub branch connected to Vercel and create a **new production deployment**. Next embeds `NEXT_PUBLIC_` values during the build; changing them without rebuilding does not update an already deployed bundle.
6. On a missing-pin place, verify both links, load the map, confirm the query municipality and check that Google controls and attribution remain visible. Test a real restricted key on the production domain. A local browser fixture does not establish API activation, billing, referrer restrictions or live matching.

To turn embedding off, set `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_ENABLED=false` and rebuild/redeploy. For an immediate provider-side stop, disable/delete the dedicated Embed key or disable Maps Embed API in Cloud Console; old bundles cannot override provider restrictions. Ordinary links and local maps continue to work.

## Controlled matching and progress

No matching runs per page visit. Start with small manual review batches from `public/data/google-maps-progress.json`, using the existing stable Lakbay ID and the name/branch/actual municipality. Consult the independent venue/local-government source already attached to that catalog record and the Google Maps result; compare known location context and verified coordinates. A similar name, top-ranked search result or single API candidate does not prove identity.

Only after review, add a record to `lib/catalog/google-maps-references.json` with these fields:

```text
lakbayId                 existing stable ID
expectedName             exact current Lakbay catalog name, including branch
expectedMunicipality     actual current city/municipality, not browsing group
expectedAddress          exact current catalog address, or null
status                   verified | ambiguous | rejected | unresolved
placeId                  Google place ID for a reviewed match, otherwise null
checkedOn                actual review date, YYYY-MM-DD
evidenceUrls             HTTPS Google Maps source and independent identity/location source
reviewNote               what established the branch/location, or why it remains unresolved
```

Do not paste a made-up place ID or a current date for an unperformed check. The schema rejects extra copied fields, missing provenance and invalid dates. The workflow rejects unknown Lakbay IDs, duplicate records, Google IDs assigned to different places, future dates and stale name/address/municipality snapshots. Non-verified records never enable a precise Google marker. If a record becomes stale, re-review it or remove it before publishing; the runtime falls back to search. A check date is review history, not a guarantee of current access or business operation. Recheck old IDs periodically; Google recommends refreshing IDs older than 12 months.

Run from the repository root:

```powershell
npm run progress:maps
npm test
```

The progress command is completely offline, preserves completed reviews and regenerates only the dedicated Maps progress export. It neither rewrites catalog JSON/CSV nor stores Google names, addresses, coordinates, reviews or photos. Review changes in Git before deployment. Place IDs are separately stored references, exempt from Google's usual content caching restrictions. No automated API matching has been enabled because no appropriate key/access was available and the user's requirement is no spending. If later implemented, use Text Search (New) with **only `places.id`** for the no-charge IDs-only SKU; adding display names, addresses or other fields can select a paid SKU. IDs alone still require human identity/branch review. Do not use Google Places coordinates to build a permanent independent location database.

## Pricing and spending boundary

Checked against the **global** price list on 16 November 2026. Prices below are USD per 1,000 events in the first paid tier after each SKU's monthly free allowance, before tax/region-specific terms. They are documentation, **not enabled services** or a promise that the Cloud project cannot incur unrelated charges.

| Feature / SKU                       | Monthly no-charge allowance | First paid tier | Lakbay state                                  |
| ----------------------------------- | --------------------------- | --------------- | --------------------------------------------- |
| Ordinary Maps URLs                  | No key/billable API request | None            | Enabled                                       |
| Maps Embed                          | Unlimited, no-charge        | None            | Implemented; requires restricted key + switch |
| Text Search Essentials (IDs Only)   | Unlimited, no-charge        | None            | No API client enabled; manual review only     |
| Place Details Essentials (IDs Only) | Unlimited, no-charge        | None            | Disabled                                      |
| Place Details Essentials            | 10,000                      | $5              | Disabled                                      |
| Text Search Pro                     | 5,000                       | $32             | Disabled                                      |
| Place Details Pro                   | 5,000                       | $17             | Disabled                                      |
| Place Details Photos                | 1,000                       | $7              | Disabled                                      |
| Geocoding                           | 10,000                      | $5              | Disabled                                      |
| Dynamic Maps / Maps JavaScript      | 10,000                      | $7              | Disabled                                      |

Relevant Google SKU identifiers: Embed `9C10-8313-F21F`; Text Search IDs Only `635D-A9DD-C520`; Details IDs Only `5C36-E272-E88F`; Details Essentials `6E05-E1C3-8D85`; Text Search Pro `4FDA-34B1-A910`; Details Pro `4ED6-464A-2AFC`; Details Photos `DCD1-FE97-8C71`.

Photos are **not an unlimited free missing-cover solution**. Obtaining photo metadata can also incur a Search/Details SKU; fetching a photo is separately counted. Photo resource names can expire and must not be cached. Attribution and delivery requirements need a dedicated compliant implementation. Downloading Google photos into local licensed assets/exports, proxying them through image optimization/CDN caches, or scraping Maps pages is not implemented.

No persistent Vercel usage limiter is claimed: **all potentially billable clients and endpoints are absent**, rather than made callable behind an ineffective per-instance counter. Google lists Embed as unlimited no-charge and supplies no daily/QPS quota for it. Its dedicated API-restricted key is essential: do not expose a key usable on paid services.

Before introducing any potentially billable service, a separate change must define the exact field-mask/SKU, obtain authorization, and implement atomic persistent reservations shared across all Vercel instances (including every attempt, timeout, retry, metadata and photo request), a conservative allowance, exhaustion fallback, server-side kill switch and abuse protection. Google per-method/per-project quotas are additional controls; minute quotas are not necessarily monthly SKU spending caps, and concurrent use from other apps can consume the same project's allowance. Cloud budget alerts are notifications, **not hard spending caps**. If zero spending cannot be enforced for an optional provider, keep it disabled. No paid sample or bulk photo fetch was run.

Places API applications also need the required public terms/privacy disclosures and Google/author attribution before enabling that separate feature. Applicable terms can differ for an EEA billing account; the Philippines catalog does not establish the Cloud account's billing region.

## Failure and privacy behavior

Links work without credentials. Missing/disabled Embed never renders an API iframe. Unresolved matches show search-mode wording. The iframe is opt-in and lazy, has a reserved 380px height and full width, preserves controls and sends the origin referrer needed for key restrictions. A known frame error removes it and leaves retry/links; a neutral delayed hint handles blocked frames, errors displayed inside Google or unavailable results. Cross-origin restrictions prevent Lakbay from inspecting Google's rendered error body: **iframe load does not prove a match, successful API response or current opening hours**. Retrying requires another explicit action. Lakbay never sends account/session/trip data or requests geolocation to build these links.

## Validation (16 November 2026)

- `npm test`: **111/111 passed**, including seven Maps tests and existing account ownership, snapshot/import, duplicate, source, food, category and itinerary tests.
- `npm run typecheck`, `npm run build` (Sites/Vinext) and `npm run build:vercel` (native Next): passed. The final builds contain no fixture key. Existing chunk-size and workspace lockfile warnings remain.
- Focused ESLint on the new TypeScript/component files and Prettier on the new files: passed.
- `npm run test:maps:browser`: passed at **1440px and 390px** on native production and Sites production without a key. Verified exact names/municipalities in links, no implicit Google iframe requests, missing-coordinate messaging, preserved Leaflet maps/attribution and no overflow.
- Optional embedding was tested on a separate local Next preview with an explicitly nonfunctional fixture key and intercepted **429/503 error responses only**. No live Google API requests or successful matches were simulated. Tests cover keyboard opt-in, reserved frame dimensions, referrer/fullscreen/lazy attributes, neutral delayed recovery, captured frame errors, manual retry/hide, retained links and no automatic retries. This caught and fixed the error-capture handler. Cross-origin rendered error bodies remain intentionally unreadable.
- Existing Explore, Discover, destination-scroll, place-content and account browser suites passed, including exact saved snapshots, bookmarks, filtering, licensed photo fallback, planner previews and mobile layouts. Account tests use UI network fixtures; no live Google account login was performed for this Maps task.
- Static premium UI audit was run and still reports the **seven existing wrapper/actionless-button findings** in unchanged `connector-error.tsx` and `components/ui` files. None concern the new Maps component; the report is at `work/google-maps/premium-audit.json` locally. No unrelated component redesign was made.

Example reproducible browser commands (run from the repository root):

```powershell
# Terminal 1: after npm run build:vercel, no Maps env variables required
npx next start --hostname localhost --port 5197
# Terminal 2
$env:LAKBAY_TEST_ORIGIN='http://localhost:5197'
npm run test:maps:browser
```

For the intercepted error-only test, stop the production preview before starting a Next dev preview. Set `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_ENABLED=true` and `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY=lakbay-browser-error-fixture-not-a-real-key` **only in that local preview shell**, run `npx next dev --hostname localhost --port 5198`, then run the browser script in a second shell with `LAKBAY_TEST_ORIGIN=http://localhost:5198` and `LAKBAY_TEST_MAPS_EMBED=true`. The script intercepts every requested Google map frame, returns error fixtures and never contacts Google. Do not deploy this fixture key. Stop the preview and rebuild without fixture variables afterwards.

Still requires external validation: an actual API-restricted Embed key, the real project's billing/API configuration and referrer restrictions, a production deployment, and human review of exact Google place matches. Ordinary Maps search URLs cannot establish a verified coordinate or correct branch by themselves.

## Official references

- [Maps URLs: key-free links, syntax and encoding](https://developers.google.com/maps/documentation/urls/get-started)
- [Embed usage and billing](https://developers.google.com/maps/documentation/embed/usage-and-billing), [setup](https://developers.google.com/maps/documentation/embed/quickstart), [supported modes/referrer policy](https://developers.google.com/maps/documentation/embed/embedding-map)
- [API key restrictions and security](https://developers.google.com/maps/api-security-best-practices)
- [Current global SKU prices](https://developers.google.com/maps/billing-and-pricing/pricing), [Places usage/quotas](https://developers.google.com/maps/documentation/places/web-service/usage-and-billing)
- [Text Search fields and SKUs](https://developers.google.com/maps/documentation/places/web-service/text-search), [place IDs](https://developers.google.com/maps/documentation/places/web-service/place-id)
- [Places policies, attribution and storage](https://developers.google.com/maps/documentation/places/web-service/policies), [photo requirements](https://developers.google.com/maps/documentation/places/web-service/place-photos)
- [Cloud budgets do not cap spending](https://cloud.google.com/billing/docs/how-to/budgets)
