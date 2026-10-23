# Targeted photo-only enrichment

Completed 23 October 2026 in the Philippines/Taipei timezone. Source-review dates use UTC: 22 October 2026. This is a follow-up to the earlier 332-place enrichment, not a restart.

Starting gaps: **148**. Reviewed all **148** in five batches of 25 and a final batch of 23. Added **25** individually licensed, visually reviewed photographs. Final coverage: **209/332** locations, with **123** gaps. There are no pending checklist entries; remaining gaps need supplied files/permission or a resolved source/identity review. This is not a claim that no reusable photograph exists anywhere for those places.

| Destination | Before | Added | Final coverage | Remaining |
| --- | ---: | ---: | ---: | ---: |
| Siargao | 5/30 | 2 | 7/30 | 23 |
| Boracay | 7/28 | 1 | 8/28 | 20 |
| Baguio | 13/30 | 2 | 15/30 | 15 |
| Davao | 13/31 | 2 | 15/31 | 16 |
| Bohol | 17/30 | 1 | 18/30 | 12 |
| Batanes | 18/30 | 3 | 21/30 | 9 |
| Palawan | 26/45 | 4 | 30/45 | 15 |
| Iloilo | 23/31 | 2 | 25/31 | 6 |
| Manila | 26/32 | 5 | 31/32 | 1 |
| Cebu | 29/35 | 2 | 31/35 | 4 |
| Sagada | 7/10 | 1 | 8/10 | 2 |

## Research and selection

The missing-photo checklist was captured before publication, including earlier unsuccessful searches and rejected candidates. Siargao, Boracay, Baguio and Davao came first. Searches used exact names, municipalities, shorter/local spellings, Commons categories and relevant Wikidata image/category links, plus Flickr searches filtered to reusable licenses. Broader results and Wikidata labels were treated as candidates, not location proof. Full per-place queries, candidate URLs, metadata, identity uncertainties and rejection reasons are saved in photo-NNN-research.json and photo-NNN-decisions.json.

All 25 selected photos were delivered through Commons. Some are Commons copies of originally Flickr-licensed photographs; those file pages retain the original attribution and license-review records. Each selected individual file-page license declaration was checked, then its actual image was visually inspected. Rights metadata includes source page, original image URL, creator, exact license/link, attribution, place ID and meaningful alt text. Optimized local JPEGs have 1200-pixel maximum width and 640-pixel variants without enlarging small originals; the existing CSS may crop the displayed image. The original attribution and modification notices are preserved.

The [individual attribution audit](attribution-check.json) retains source-specified credit text, including the copyright notices supplied for Corong Corong Beach and Manila Ocean Park.

Photo-only mode was added to the existing reviewed-decision publisher because the general publisher rewrites editorial content and handles videos. In photo-only mode, only a missing photo field, image assets and photo-progress records are updated. It refuses to replace a different existing photo. Explicit visual/identity/license approval is required, noncommercial/no-derivatives/all-rights-reserved licenses are not accepted, and replaying saved decisions retains their actual review date. Existing approved descriptions, highlights, tips, source dates, videos and photographs remain unchanged.

Important rejections included the Newcoast beach photograph with no visible keyhole; portraits labeled Savidug Stone Houses/Ivatan of Batanes; Mirador bamboo grove as a substitute for St. Francis Xavier sanctuary; Abaca photos at Ayala/SM rather than Crossroads; an Eng Bee Tin storefront without proof of the 628 Ongpin branch; and Chawa metadata that said Sabtang rather than Mahatao. The Savidug entry now has an actual stone-house view from a different file. No generic province scenery, food stock photo, neighboring business or AI image was substituted.

Flickr public pages and license metadata were accessible, but live.staticflickr.com image retrieval timed out through Node and PowerShell. A farm-domain attempt also failed, and the official download endpoint tested returned 404. Unviewed image files were not approved. Source pages remain available in research records for a later targeted retry. Public venue photographs and government/media-kit pages were not assumed reusable; supplementary rights checks are documented in additional-source-notes.json. No owner was contacted.

Some photos were taken years before this review. They depict the recorded place, not a guarantee of current exhibitions, decoration, access, facilities or conditions. Neither photo approval nor a checked date verifies an activity price, opening hour, itinerary estimate or present-day safety.

## Remaining gaps and supplied photographs

The complete remaining **123-place list** is available as a [readable checklist](needs-supplied-photos.md) and [JSON with reasons, searches and rejections](needs-supplied-photos.json). The [supplied-photo guide](supplied-photo-guide.md) specifies the required image file, rights holder, permission for website publication/resizing/cropping and attribution preference. An accessible file from a suitable open-license candidate can also resolve a gap after visual/identity review; a fresh owner photo is not the only path. No upload system, admin dashboard or permission-message automation was added.

## Validation

- **checkedOn:** 2026-10-22
- **focusedBatches:** All six batches passed place-content schemas, unique IDs and image decoding/reserved-dimension checks after publication.
- **sourceReview:** All 25 published photos visually inspected; each individual Commons file-page declaration, creator and license reviewed. Source/rights evidence and rejection reasons retained in the decisions. No unreviewed Flickr image published.
- **preservation:** 82/82 unit/integration tests passed, including hashes of all non-photo editorial content, video file, original directory modules, and every previously referenced local photo asset; prior photo metadata is unchanged.
- **browser:** All 25 new photos passed card and detail-page image-loading checks at 1440 and 390 pixels on native Next.js. Local src, alt text, reserved dimensions, source credits and no horizontal overflow checked. Existing media/browser suite also passed, including fallback behavior.
- **builds:** Sites/Vinext build, native Next.js/Vercel build and TypeScript passed. The builds share .next generation; finish with the native build before typecheck.
- **lint:** All changed/new publishing/research/progress scripts and photo tests pass targeted ESLint with no warnings or errors.

The complete directory JSON/CSV exports and public place-image credits were regenerated after each batch. Current totals are in public/data/place-enrichment-progress.json under photoPass; its historical enrichment totals remain separate. docs/place-enrichment/remaining-gaps.json has the current photo gaps while retaining video/source-gap records.

Maintenance commands (from the lakbay directory):

```powershell
node scripts/publish-place-enrichment-batch.mjs docs/place-enrichment/photo-only/photo-NNN-decisions.json
npm run validate:places -- --batch photo-NNN
node scripts/place-enrichment-progress.mjs
node scripts/photo-pass-progress.mjs
npm run export:directory
npm test
npm run build
npm run build:vercel
npm run typecheck
```

Use the publisher only for reviewed decisions. Research helpers do not publish candidates. The init command refuses to reset an existing checklist. Current-day source caches avoid duplicate requests; a later day requires a fresh source fetch. The preservation baseline is specific to this photo-only pass; an intentional future editorial change must be reviewed as such rather than silently changing that audit record.

For browser verification, run the native production server on port 5180 after the native build, then `$env:LAKBAY_TEST_ORIGIN="http://localhost:5180"; node tests/photo-pass-browser.mjs` and `npm run test:places:browser`. Account-session responses are disabled test fixtures in the photo-only suite; it performs no live account/database writes or Google login.

The handoff’s npm aliases were absent in the committed package file; export:directory, validate:places and test:places:browser were restored. Sharp, already used by the image pipeline, is now explicitly declared as a development dependency so the optimization scripts do not depend on a transitive install. No paid API, new environment variable or database migration was introduced.

Changes are saved locally. Commit/push them to GitHub and deploy Vercel to publish this photo pass. No deployment or production write was performed.
