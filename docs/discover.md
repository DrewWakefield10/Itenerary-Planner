# Discover: editorial places and Wikimedia readership

`/discover` contains 332 accepted physical locations across 11 browsing destinations plus the existing overnight-base guides (200 original records and 132 saved additions; 18 additions remain pending). Explore Destinations, destination/category/interest filters, and name/description/municipality search compose into one paginated directory. Each detail preserves actual administrative fields and fact-specific source statuses. The homepage retains its compact selection. See [current counts](directory-progress.md), [expansion progress](expansion-progress.md), [itinerary selection](itinerary-selection.md) and [research and maintenance guide](catalog-contributing.md).

## Editorial editing workflow

Maintain the `lib/catalog/directory-*.json` candidate modules and run `npm run export:directory`. The old curated `lib/discovery-data.ts` remains the explicitly reviewed image/article allowlist, following `DiscoveryPlace`. There is no CMS, admin account, or public write endpoint. Use a stable `id`; retain it when revising a record. Select the correct `baseSlug`, and for spots the exact existing `stopName`. Review identity, location, and practical claims separately. The existing catalog retains price, duration, accessibility, transport, and opening-hours metadata; a reviewed discovery does not verify adjacent facts.

Every entry needs a real source, platform, factual summary, explanation of what that source supports, reason for selection, and actual review date. Add `reviewExpiresOn` for time-sensitive entries; expired entries remain readable but cannot be added until reviewed again. TikTok, Facebook, YouTube, tourism websites, Wikipedia, and other sources are supported. An optional `originalPostUrl` links to the original creator's content. This release seeds tourism/institutional and Wikipedia sources, not unverified social examples. Do not download or rehost social videos. A manual post is a **Selected discovery**, never automatic evidence of trending.

For new spots, first add a properly sourced catalog stop or extend the explicit reviewed conversion; never fuzzy-match names or guess a base. Keep source URLs and dates honest. Add a photo only with reuse permission and append source/author/license/resize information to both image-credit files. No image is preferable to an unrelated destination photograph.

To monitor readership, review the exact canonical English Wikipedia article and add its title and actual review date in `wikipedia`. The initial eight articles cover the five bases and the three Baguio park stops. Cebu City is matched to the city, not Cebu island. Coron uses the municipality article (including its town on Busuanga), not Coron Island. Readership for a municipality/city is broader than a particular hotel area or attraction. Places without Wikipedia articles remain eligible for editorial discovery.

## Wikimedia provider and methodology

Official documentation reviewed 19 October 2026:

- [Analytics pageview reference](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/reference/page-views.html) and [official endpoint tutorial](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/tutorials/compare-page-metrics.html).
- [Access policy](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/documentation/access-policy.html), [User-Agent policy](https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy/en), and [current rate-limit guidance](https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits).
- [Query/redirect resolution](https://www.mediawiki.org/wiki/API:Query) and [pageview definitions](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/concepts/page-views.html).

The maintenance provider resolves each curated title through the Action API with `redirects=1`. Missing, disambiguation, non-article, or unexpectedly redirected titles require review; they are not guessed. The approved canonical title is requested from the documented Analytics `per-article/en.wikipedia.org/all-access/user/.../daily` endpoint. It measures human-reader traffic across access methods. Redirect-title traffic is not aggregated into canonical article traffic; other languages and other platforms are outside this initial coverage. API data is CC0; the UI links directly to each successful data response.

Compare the latest complete **UTC calendar** seven days (ending yesterday UTC) against the preceding seven days. All fourteen distinct daily observations must exist. Delayed, malformed, missing, or mismatched data is unavailable, never zero-filled. The first real refresh on 19 October locally (18 October UTC) returned incomplete coverage; the published initial snapshot honestly contains no live rankings.

Initial thresholds are a preceding-week baseline of **700** human-reader pageviews, at least **200** additional views, and at least **20%** growth. These deliberately exclude tiny baselines and small absolute changes. Percent growth is suppressed below 700, including zero. Qualifying results sort by absolute increase. This is a narrow readership signal, not proof of travel demand, visitor arrivals, bookings, or social-media popularity. The UI labels the measured coverage, retrieval time, limitations, and source. Data older than **72 hours** by retrieval time or coverage end is excluded from rankings; retained historical data stays visible in the coverage notes. The browser rechecks freshness once per minute, without upstream requests.

## Free refresh, deployment, and storage

`vercel.json` selects native Next.js; the repo also retains its Sites/Vinext build. Browser drafts remain local; the existing Google accounts save private trips and bookmarks through Turso on Vercel (see [accounts](accounts.md)). The readership snapshot is a separate checked-in file and does not use the account database. This Discover update adds no trend-source integration, paid API, database requirement, or cron configuration.

Use the practical **manual publication snapshot** workflow:

1. Run `npx tsx scripts/refresh-discovery.ts` locally (at most once daily). It computes data automatically; normal builds and visitors never call Wikimedia. No Wikimedia account, token, paid API, or billing setup is needed.
2. Inspect `lib/discovery-interest-snapshot.json`. The script atomically updates the local file and preserves each record's last successful values and timestamps on failure. Partial successes keep their actual individual coverage. Review any mapping errors before changing articles.
3. Run tests/type checks/build, then commit and redeploy normally. This checked-in file is the durable shared snapshot on both hosts. Local/serverless filesystem writes are not used for runtime persistence. Published snapshots do not change until the next deployment.

`/api/discovery` is read-only and serves only the publication snapshot with shared CDN caching (`s-maxage=3600`, stale-while-revalidate 3600; browser max-age 300). The browser checks freshness even when a cached response was once fresh. No per-card or per-visitor Wikimedia requests occur. No live snapshot means reviewed places plus an unavailable-data explanation. Test fixtures never enter the snapshot.

Requests are serial with a 400 ms gap, eight-second timeouts, a maximum of 24 requests per refresh, and at most one retry for HTTP 429/503 when the wait is at most five seconds. Longer `Retry-After` pauses the batch and is persisted; a retry cannot bypass it. Failed attempts are timestamped and the normal daily guard also applies to them. `npx tsx scripts/refresh-discovery.ts --force` explicitly bypasses the daily guard for maintenance, but never an upstream cooldown. Do not use it as a loop.

Optional local environment variables: `WIKIMEDIA_USER_AGENT` for an identifying client name/version plus a real contact URL/email; the default identifies LakbayDiscoveryBot and its Site URL. Threshold overrides are `DISCOVER_MIN_BASELINE`, `DISCOVER_MIN_GROWTH`, `DISCOVER_MIN_PERCENT`, and `DISCOVER_FRESHNESS_HOURS`; validated values are recorded in the snapshot, so displayed methodology matches calculations. Authentication or Google Trends approval is not needed. A future free scheduled refresh can use a reviewed existing job runner to update/commit this file, but none is assumed or configured here.

## Planning and location behavior

“Add to my trip” reads validated local trips and offers only ordinary days at the exact mapped base. It does not infer El Nido from legacy `palawan` days. A preview appends a new activity in an empty slot, reserves 45-minute planning buffers, checks recorded opening days/hours, and shows the group allowance and warnings. It never moves or replaces another activity. Dismissal leaves storage unchanged. Acceptance re-reads the saved trip and rejects stale previews; a successful save uses existing trip validation/storage. Practical metadata and independent estimate labels survive JSON export/import and reload.

Nearby calculations use only verified reference coordinates, within 15 km. Where a base has no verified center, a named reviewed local spot is used as the explicitly labeled origin (Burnham Park for Baguio). These are straight-line estimates, not routed distances or travel times. Approximate/unverified pins, including the current Cebu spot pins, are excluded from nearby distances. Maps load only after the traveler opens one. Zero cost allowances do not establish free admission; absent hours/accessibility remain unknown. Extra local transport and special closures require confirmation.

Validation commands: `npm test`, `npm run test:browser`, `npm run typecheck`, `npm run build`, `npm run build:vercel`. Discovery browser tests cover real unavailable data, desktop/mobile layouts, filters, lazy maps, add preview/dismiss/accept, persistence, and test-only successful/stale signal presentations.
