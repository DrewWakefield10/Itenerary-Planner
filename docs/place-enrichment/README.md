# Discover content and media enrichment

**Detail-cover behavior:** [Instagram cover preview](instagram/cover-preview.md) now reuses the original post widget when no approved cover photo exists. Nine existing places qualify. The preview is opt-in, keeps all official controls and the original link, and does not change photo-gap counts.

**Latest Instagram pass:** [implementation and research handoff](instagram/README.md), [destination/category coverage](instagram/coverage.md). There are 37 reviewed posts for 36 of 426 locations; 9 places with missing covers now have an Instagram resource. All 37 official widgets rendered at their recorded checks, with initial images/posters visually reviewed. The catalog-source audit covers all 426 places; exact-post discovery remains open for 390 without an approved resource. Instagram does not close any of the 212 licensed-photo gaps. Historical research totals below remain separate.

**Current catalog:** the later [food-directory expansion](../food-directory/README.md) adds 94 places, bringing the complete directory to 426 descriptions and 214 places with photos (212 documented photo overlays plus two retained legacy images). There are 212 current photo gaps. Food additions contributed five approved images; the original 515 video associations remain unchanged.

**Historical photo follow-up:** the targeted photo-only pass reviewed its original 148 gaps and added 25 photos, reaching 209/332 with 123 gaps in that cohort. See [photo-only results, source limits and supplied-photo checklist](photo-only/README.md). Its checklist and the earlier counts below are preserved as history, separately from new food records.

Completed catalog research pass: 22 October 2026 UTC (23 October in the Philippines). Active brief: attachment `2e4af148-0c8c-4064-8daf-25d5854fcc71/Pasted text.txt`. Lakbay is standalone. Catalog inclusion does not establish partnership or popularity.

## What is complete

The actual Discover DOM order is filters → Spots to discover with pagination → Gaining attention. Native responsive YouTube players live below each place overview/highlights, followed by practical information and expandable sources/credits. Save Place, Plan a Trip and Add to My Trip stay near the top. Unknown admission is not inferred from a zero planning allowance; durations remain estimates.

Stage A researched eight examples including Jaro Plaza and Plaza Libertad, then passed project checks before expansion. Stage B saved twelve batches of 25 and one of 24. All 332 accepted physical locations now have separate card summaries, expanded overviews and recorded source/media research outcomes. Original directory records, stable IDs, catalog stops, bookmarks and saved itinerary snapshots are preserved.

Coverage: 332 descriptions improved; 178 new licensed photographs plus six retained photos (184 places with a photo); 515 video associations across 299 places. There are 148 photo gaps and 33 places without selected videos. All card summaries are within the 25–45-word guide. Only 19 overviews reach 100 words; other overviews are deliberately shorter where evidence was limited. Do not equate a completed research pass with complete media coverage or fresh verification of every practical fact.

| Destination | Reviewed descriptions | Places with photos | Places with videos |
| --- | ---: | ---: | ---: |
| Palawan | 45 | 26 | 44 |
| Cebu | 35 | 29 | 33 |
| Manila | 32 | 26 | 32 |
| Siargao | 30 | 5 | 25 |
| Bohol | 30 | 17 | 29 |
| Boracay | 28 | 7 | 26 |
| Baguio | 30 | 13 | 27 |
| Iloilo | 31 | 23 | 26 |
| Davao | 31 | 13 | 26 |
| Batanes | 30 | 18 | 21 |
| Sagada | 10 | 7 | 10 |

## Evidence and limitations

- Display/search/export overlays preserve original directory facts, planner stops and saved itinerary snapshots.
- All 332 entries received an editorial and media research pass. Retained earlier source dates are not represented as fresh source verification; some blocked sources support only a short overview.
- Licensed exact-place photographs were not found for every location. Missing photographs use the existing fallback.
- Videos were checked against official metadata, descriptions and embed eligibility, not full footage. Streaming playback did not advance in the headless test; external YouTube links remain available.
- Current admission, opening hours, access and practical conditions remain unknown or estimated unless independently sourced. A reviewed description does not verify adjacent facts.

Every selected video was opened through official YouTube metadata/watch data and checked for an accessible description and embed eligibility. Relevance notes identify the exact place; recorded start times come from verified author chapters. Full footage was not reviewed. A real no-cookie player displayed a thumbnail during Stage A, but streaming did not advance in the headless browser. Do not describe these as fully reviewed or claim end-to-end playback. Final layout tests verify exact place IDs, native iframe attributes, ratios, external links and mobile behavior; network-limited embeds retain a visible YouTube fallback.

Final contact-sheet review corrected a flower close-up incorrectly associated with the tarsier center, a Fort San Pedro image incorrectly associated with Cebu National Museum, a memorial close-up at Roxas market, and other poor subject matches. Rejected video IDs and reasons are retained in batch outcomes. Final approved decisions match the shipped overlays.

Source dates are retained when using previously accepted facts. A response status alone is not factual verification. Batch link reports and per-record sourceReachabilityIssues record blocked or unavailable sources. The final 204-link correction pass had 152 HTTP 200 responses, 48 HTTP 429 responses, two HTTP 403 responses, one HTTP 404 and one timeout. Local optimized photos decode and load independently of remote throttling. Current admission, hours, accessibility, travel time and access remain independently sourced, estimated or unknown.

## Storage and maintenance

- `lib/catalog/place-content.json`: summaries, overview paragraphs, sourced highlights/tips, full licensed photo metadata.
- `lib/catalog/place-videos.json`: separate official video metadata, relevance, date, availability and review limitations, keyed by stable place ID.
- `public/data/place-enrichment-progress.json`: independent description/photo/video outcomes, notes, word counts, link issues and completed batch IDs. There are no unreviewed catalog entries left in nextBatch.
- `docs/place-enrichment/batch-NNN-decisions.json` and `completed-batches/`: final editorial choices, outcomes and rejected candidates. `research-batches/` contains unapproved candidates; search matches are not approval.
- `public/data/lakbay-locations.json` and `.csv`: regenerated complete accepted directory with additional editorial/media columns; original description and practical fact metadata retained.
- `public/place-image-credits.txt`: generated creator/source/original/license/attribution records. `/image-credits.txt` retains the earlier destination and seed-photo credits.
- `work/place-research/` (ignored): cached full source/video descriptions and image candidates for resuming limited searches; do not publish unreviewed candidates.

For targeted follow-up research, use `node scripts/research-enrichment-batch.mjs OFFSET 25` and `scripts/research-place-content.mjs`. Inspect identities, source evidence and rights before editing explicit decisions. Publish reviewed choices with `node scripts/publish-place-enrichment-batch.mjs DECISIONS.json`, then run `npm run validate:places -- --batch batch-NNN --links`, update progress and regenerate exports. Do not rerun completed research merely to fill media quotas. Sources do not imply current operation or prices.

```powershell
npm run validate:places
node scripts/place-enrichment-progress.mjs
npm run export:directory
npm test
npm run build
npm run build:vercel
npm run typecheck
```

Browser suites require a running server. `npm run test:browser` covers the six baseline flows on the existing Vinext preview. For native Next production on local port 5173, use `$env:LAKBAY_TEST_ORIGIN="http://localhost:5173"`, then `npm run test:places:browser`, `node tests/discover-browser.mjs`, and `npm run test:accounts:browser`. The original origin checks remain enabled.

## Validation and delivery

- **unitIntegration:** 80/80 passed, including catalog categories/geography/scheduling, original record integrity, saved-trip immutability and account ownership
- **builds:** Sites/Vinext and native Next.js/Vercel builds passed; TypeScript passed
- **browsers:** Six baseline suites passed on Vinext; final place-media, Discover and account browser suites passed on native Next.js (desktop/mobile). Account flow uses UI network fixtures, not a live Google login.
- **localProductionOrigin:** Use http://localhost:5173 for native Next.js browser tests so browser Origin matches the local production request URL; use LAKBAY_TEST_ORIGIN for Discover/media/account suites. No origin guard was bypassed.
- **images:** All 182 metadata-rich image records decoded; reserved dimensions match. Six original seed photos are retained (four also have rich records). Contact sheets visually reviewed.
- **links:** Saved batch reports distinguish reachability from factual verification. Final correction pass: 204 links, 152 HTTP 200, 48 rate-limited, two HTTP 403, one HTTP 404, one timeout. Optimized local images still load.
- **video:** 515 associations have official metadata/description/embed-eligibility checks. Full footage and end-to-end streaming playback are not verified; native players have external fallback links.
- **lint:** New media/data/schema/export/test files have no ESLint errors; one expected native-img recommendation. Modified existing Discover/bookmark components retain the same seven pre-existing lint errors as HEAD (confirmed against copies of HEAD).
- **audit:** Seven inherited wrapper findings remain in ui-audit.json; no new audit findings.

The two original components retain seven pre-existing ESLint errors; no new lint errors were introduced. The expected native-img warning reflects the local, pre-optimized, dual-framework image pipeline. The strict UI audit retains its seven inherited wrapper findings, documented in ui-audit.json.

GitHub push and Vercel deployment remain. No secrets or environment files were modified, no production writes were made, and this update requires no new environment variables, migrations or paid services. Preserve the user’s pre-existing .gitignore edits. The older expansion shortfall of 18 new identities is outside this enrichment task and is still recorded separately in docs/expansion-progress.md.

## Remaining content work

- 148 places still need an exact-place photograph with documented reuse rights.
- 33 places have no selected video; some other places have one resource rather than two or three. Relevance is not inferred to meet a quota.
- Many overviews are shorter than 100 words because supporting detail was limited; nine entries explicitly record limited-evidence status.
- Review unavailable sources when access returns. The old Davao CPDO Sectoral Studies URL is now 404; the official current download index is https://cpdoapps.davaocity.gov.ph/requirements, but the replacement PDF could not be reviewed in this pass.
- Verify playback in a normal browser/network and perform live Google sign-in after deployment if desired; fixtures do not establish a successful production login.
- Commit/push the changes and deploy to Vercel. No additional environment variables, paid APIs or migrations are required for this Discover update.
