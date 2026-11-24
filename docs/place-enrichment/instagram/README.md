# Instagram photo galleries and research handoff

The catalog contains 426 places. At the start of the November 24, 2026 pass, 216 places had approved covers and 210 did not. Twelve [cover-candidate batches](cover-candidates/) record searches for all 210 places, including actual municipalities, reviewed posts and remaining permission needs. Eleven cover gaps have a reviewed Instagram post. The other 199 still need an exact-place post or approved image. These public-index searches could not exhaust all public location tags or verify every search lead.

The current [coverage report](coverage.md) counts published posts independently of photographs. Burnham Park has two distinct reviewed photos, an aerial view and lakeside cycling. Easter Weaving Room and Tayangban Cave Pool each gained one reviewed post. These four posts rendered in their official individual widgets on the check date. Standalone publication permission was undocumented, so this pass added no cover photographs.

## Place pages and Discover

Licensed photos stay in the cover. Where no licensed photo exists, the compass placeholder remains. The gallery sits below the cover credit beside the overview on desktop, and stacks before the overview on mobile. It shows up to five distinct posts, excluding any that duplicate the cover. Posts open through an original Instagram link even if a widget is blocked. No Instagram iframe or runtime is requested until the visitor chooses **Load Instagram posts**. Discover may link to a gallery without loading Instagram.

A documented reuse grant or suitable license can support a local inline photograph. Store the photographer, credited source and permalink, rights evidence, original approved file source, alt text, dimensions and any modifications. For a cover, publish the approved asset through the existing reviewed photo workflow; the gallery removes matching photos. Keep Instagram CDN assets and screenshots out of the photo pipeline.

## Current official embedding method

Official references checked November 24, 2026:

- [Meta: Embed button](https://developers.facebook.com/documentation/instagram-platform/embed-button) (page reports updated June 30, 2026).
- [Meta: Embed an Instagram post / oEmbed](https://developers.facebook.com/documentation/instagram-platform/oembed) (page reports updated May 15, 2026).
- [Meta: Instagram oEmbed API reference](https://developers.facebook.com/docs/graph-api/reference/instagram-oembed/).
- The [official runtime](https://www.instagram.com/embed.js) specifies a 326 px minimum. The current API documentation also describes responsive width and a maximum of 658 px.

This implementation uses the **manual post markup + official `embed.js` + `instgrm.Embeds.process()`** method. It does not call oEmbed or need a Meta developer app, API credentials, a paid service, new environment variables or migrations. Only eligible public content can render; owner embed settings, removal, age restrictions, sign-in, network policy and browser privacy settings can prevent it. An Instagram or Meta account does not grant access to every post.

## Review and publishing

1. `node scripts/research-instagram.mjs init` initializes or resumes the catalog inventory. `node scripts/research-instagram.mjs instagram-001` scans the listed public publisher sources for individual links, caches ordinary public responses locally and saves **unapproved** candidates. It stops retrying a rate-limited host within a run. Instagram source profiles are not automatically collected. Do not equate this scan with exact-place verification.
2. Review the original public post or official widget together with a place-specific publisher/venue reference. Resolve municipality and branch; do not rely on an article heading, general destination hashtag or an account name alone. `candidate-decisions.json` records concrete rejected, inaccessible and uncertain associations. `supplemental-research.json` records additional sources and a 20-location missing-photo follow-up.
3. Save a reviewed decision under `decisions/`, with `mode: "instagram-only"`, batch ID, actual checked date and entries. Each entry needs `decision: "approved"`, `identityReviewed: true` and one to five schema-valid `posts`. Manual embeds additionally need a public-post review. Use `link-only` when relevance is verified but embedding is unavailable. Unknown account or exact-place identity stays unpublished.
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

## Validation and deployment

Browser tests check desktop alignment, mobile order and swipe, keyboard controls, the one-post and empty states, blocked loading, filtered Discover, and the absence of third-party requests before opt-in. The fixture checks failure independently of the editorial records. Real embeds may become unavailable.

Push the release commit to the Vercel project's production branch and check the build and a place detail on the deployment. Run the existing Vercel build command (`npm run build:vercel`). The gallery uses the existing public embed script and needs no new environment variables or migrations.
