# Instagram resources: implementation and research handoff

Lakbay is standalone. This optional stable-ID overlay works for every catalog category and does not change trip snapshots, account storage, bookmarks, place identities, descriptions, YouTube associations or licensed cover photos.

The current catalog has **426 locations**, **214 approved cover photographs** and **212 photo gaps**. The source inventory covers the whole catalog, in missing-photo-first batches of 20 (the final remainder is six). It is a publisher-reference audit, **not a completed search of all Instagram posts**. Many publisher pages contain no individual social links. Some sources return errors, time out or are inaccessible; this is not evidence that no post exists. Exact-post research remains open for uncovered places. The generated [coverage report](coverage.md), `public/data/instagram-progress.json` and `checklist.json` give current counts, destination/category breakdowns, per-location gaps and batch status.

## What ships

**Detail-cover update:** [cover behavior and validation](cover-preview.md). When an approved photo is absent, the first eligible reviewed original post can appear in the cover area behind **Load Instagram preview**. It stays a full, uncropped widget with a visible **View original on Instagram** link, and is omitted from the lower section to avoid duplication. Other posts retain their own opt-in action. All photo counts remain independent.

- `lib/catalog/place-instagram.json` contains only explicit reviewed decisions. Each entry records its stable place ID, canonical permalink, public account, relevance, actual UTC check date, supporting references, limitations and individual embed-check status.
- Supported links are HTTPS `instagram.com/p/{shortcode}/` and `/reel/{shortcode}/`. Tracking parameters are stripped. Profiles, stories, lookalike domains, credentials, arbitrary HTML, scripts, unknown IDs, duplicate associations, future dates and more than three posts per location are rejected.
- The detail page loads local resources lazily in the eligible cover preview or after videos. Cards never contain widgets. **Load Instagram preview** and **Load Instagram posts** explicitly request the shared official third-party runtime for their own resources. Consent copy explains the connection. Native source links work without loading anything from Instagram.
- The official SDK processes validated post markup in its own DOM container. No API-generated HTML is injected. Script failure supports explicit retry; blocked or removed posts retain source links. A screen narrower than the official 326 px widget minimum uses links, avoiding clipped controls. Resizing and navigation clean up widget DOM.
- Official controls and attribution remain intact. Successful SDK loading alone never establishes that a particular post works. An embed is not a licensed photograph and never closes a photo gap. No Instagram image files or CDN assets are downloaded, extracted or republished.

## Current official embedding method

Public documentation reviewed **2026-10-22 UTC**:

- [Meta: Embed button](https://developers.facebook.com/documentation/instagram-platform/embed-button) (page reports updated June 30, 2026).
- [Meta: Embed an Instagram post / oEmbed](https://developers.facebook.com/documentation/instagram-platform/oembed) (page reports updated May 15, 2026).
- [Meta: Instagram oEmbed API reference](https://developers.facebook.com/docs/graph-api/reference/instagram-oembed/).
- The [official runtime](https://www.instagram.com/embed.js) specifies a 326 px minimum. The current API documentation also describes responsive width and a maximum of 658 px.

This implementation uses the **manual post markup + official `embed.js` + `instgrm.Embeds.process()`** method. It does not call oEmbed or need a Meta developer app, API credentials, a paid service, new environment variables or migrations. Only eligible public content can render; owner embed settings, removal, age restrictions, sign-in, network policy and browser privacy settings can prevent it. An Instagram or Meta account does not grant access to every post.

A development probe of the current v26.0 public oEmbed endpoint for the starter coffee post returned HTTP 200 and embed HTML **without credentials**. Only that status/availability was checked; API metadata was not used for editorial research or persisted. This observation is not a promise of token-free access to all posts. If API-based oEmbed is introduced later, recheck current authentication, approval and usage terms instead of carrying over assumptions from older documentation. The manual path used here has no app-review configuration step.

## Review and publishing

1. `node scripts/research-instagram.mjs init` initializes or resumes the catalog inventory. `node scripts/research-instagram.mjs instagram-001` scans the listed public publisher sources for individual links, caches ordinary public responses locally and saves **unapproved** candidates. It stops retrying a rate-limited host within a run. Instagram source profiles are not automatically collected. Do not equate this scan with exact-place verification.
2. Review the original public post or official widget together with a place-specific publisher/venue reference. Resolve municipality and branch; do not rely on an article heading, general destination hashtag or an account name alone. `candidate-decisions.json` records concrete rejected, inaccessible and uncertain associations. `supplemental-research.json` records additional sources and a 20-location missing-photo follow-up.
3. Save a reviewed decision under `decisions/`, with `mode: "instagram-only"`, batch ID, actual checked date and entries. Each entry needs `decision: "approved"`, `identityReviewed: true` and one to three schema-valid `posts`. Manual embeds additionally need a public-post review. Use `link-only` when relevance is verified but embedding is unavailable. Unknown account or exact-place identity stays unpublished.
4. Publish through the existing workflow:

   ```powershell
   node scripts/publish-place-enrichment-batch.mjs docs/place-enrichment/instagram/decisions/instagram-reviewed-002.json
   ```

   The Instagram-only branch delegates to `scripts/publish-instagram-batch.ts`. It validates the full batch before writing and leaves all other media/catalog files untouched. Identical input is idempotent. A changed reviewed record requires an explicit `correctionReason`; confirmation decisions document actual browser/visual review. Do not replay superseded pre-confirmation decisions over current confirmed records.

5. Confirm the actual official frame on the corresponding Lakbay page after opt-in. Inspect the initial photograph or reel poster and record the limits of that inspection. Do not claim full carousel or footage review unless performed. Historical captions, prices, promotions and events do not update current practical information.
6. Regenerate exports and focused validation:

   ```powershell
   npm run export:directory
   npm run progress:instagram
   node scripts/place-enrichment-progress.mjs
   npx tsx --test tests/instagram.test.ts
   $env:LAKBAY_TEST_ORIGIN = 'http://localhost:5190'
   npm run test:instagram:browser
   ```

The progress command checks preservation hashes and existing image associations, and writes coverage Markdown plus separate Instagram JSON/CSV. Directory exports include an optional `instagram` array alongside independent photos/videos. Stable IDs remain the join key. No login/ownership or itinerary generation code depends on this overlay.

## Validation and remaining gaps

The starter five covered café, cultural venue, park, beach and viewpoint, including two missing-photo places. Real official widgets were then checked for each accepted post on its own Lakbay page; initial images/posters were visually inspected. The five starter posts also rendered at 390 px with no overflow and no Instagram requests before opt-in. Browser fixture tests independently cover blocked SDK, source fallback, retry, 320/390/1440 widths, resizing, navigation, hidden empty sections and retained YouTube embeds. Fixture results never mark real posts confirmed.

Remaining resources are deliberately absent when identity, branch or current public availability cannot be established. No suitable candidate in a checked page is a source-limited outcome, not an assertion of absence from Instagram. Continue from the per-place checklist and rejected-candidate reasons; request a public individual permalink when appropriate. Do not contact owners automatically, bypass login, infer locations from generic scenery, or add profile links as if they were posts. Some archived source posts are now explicitly unavailable in the official widget.

Full-footage review, exhaustive individual-post discovery and a live production Google login are not claimed. Account unit/integration and browser network-fixture regressions are recorded separately. Existing full-repository lint failures are documented in `validation.json`; new Instagram files have their own clean lint check.

## Delivery

Changes are local and uncommitted; no GitHub push or production deployment was performed. Review the combined existing work, commit the intended files and push the deployment branch. Vercel must build and redeploy that commit using the existing configuration (`npm run build:vercel`). **No Instagram configuration, new secret, database or migration is required.** Check a detail page with an approved post in production, including opt-in, mobile layout and source fallback. Google credentials and Turso setup are unchanged.
