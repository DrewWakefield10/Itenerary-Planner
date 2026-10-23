# Cover photo follow-up — 23 October 2026

**Partial result: 2 new photographs; 216/426 places now have a cover and 210 remain unresolved.** This does not complete the request for photographs everywhere.

Production was checked directly: its public directory had 426 records, 214 covers and 212 gaps; sampled existing assets returned image/jpeg with HTTP 200. The gaps are real catalog gaps. This follow-up leaves all existing photos, descriptions, videos, Instagram posts, stable IDs and personal records unchanged.

## Published

- Mount Ampacao, Sagada: a mountain view from the documented climb, photographed by Caitriana Nicholson; CC BY-SA 2.0. The separate portrait candidate was rejected.
- Museo Dabawenyo Event Center, Davao City: the museum’s Central 911 exhibit, photographed by Herbertkikoy in August 2026; CC BY-SA 4.0. It is an exhibit photograph, not a claim about today's display.

Individual Commons file-page license declarations and descriptions were read, both selected photographs were visually inspected, and the existing pipeline produced local JPEGs at up to 1200 px plus 640 px variants. Attribution, source/original URLs, review dates, alt text and dimensions are retained in the photo overlay and exports. Existing cards and detail pages share that overlay.

## Research and exact blockers

All 212 gaps received another source search, saved in nine batches (eight of 24 and one of 20). Earlier searches and candidates are linked rather than overwritten. The Flickr search omitted newer reusable licenses: it now includes IDs 11 and 12 (CC BY 4.0 / CC BY-SA 4.0), verified against [Flickr's official license list](https://www.flickr.com/services/api/flickr.photos.licenses.getInfo.html). Individual source review is still required; a search match is never approval.

- Many exact venue/branch searches returned no candidates. Broader searches produced unrelated namesakes, wrong branches, neighboring attractions and photographs that do not identify the listed place.
- Several promising Flickr photos have readable individual rights pages, but live.staticflickr.com image downloads timed out in Node, Windows HTTP and Chrome. They have not been visually approved or published. See candidate-reviews.json for the exact URLs and source metadata. The issue is not an authentication setting in Lakbay.
- Commons searches by the Flickr IDs located a public Commons copy of the Baker’s Hill zipline view, but the image's bakery-versus-Mitra-Ranch identity remains uncertain, so it was rejected. Eng Bee Tin's exact branch and Casa Vallejo's restaurant-versus-hotel frontage also remain unresolved.
- Openverse follow-up queries were mostly network timeouts; the Pacifico query returned no candidates. Unsplash search results identified Maasin River candidates, but individual source-page access was unavailable (HTTP 401/429), so no image from those results was approved. A public WordPress image rendition request also returned HTTP 429. No rate-limit or access control was bypassed.

This is not proof that no reusable photographs exist elsewhere. New searches may resolve some gaps. For the remaining venues, an owner/traveler photograph with documented permission is the reliable next input. Do not fill them with a neighboring business, generic scene, Instagram CDN extraction or an invented photograph.

## Current coverage

| Destination | Covers | Total | Remaining |
| --- | ---: | ---: | ---: |
| Palawan | 31 | 66 | 35 |
| Cebu | 32 | 51 | 19 |
| Manila | 31 | 49 | 18 |
| Siargao | 7 | 36 | 29 |
| Bohol | 18 | 36 | 18 |
| Boracay | 8 | 28 | 20 |
| Baguio | 16 | 35 | 19 |
| Iloilo | 26 | 38 | 12 |
| Davao | 16 | 39 | 23 |
| Batanes | 21 | 32 | 11 |
| Sagada | 10 | 16 | 6 |

## Resume and supply photographs

[Remaining-photo CSV](remaining-photos.csv) and [JSON](remaining-photos.json) identify every unresolved place and its saved decision. For each supplied photograph, record the stable place ID, image file, photographer/rights holder, permission for website publication and resizing/cropping, and attribution preference. See the existing [supplied-photo guide](../photo-only/supplied-photo-guide.md). No owners were contacted, no upload system was added, and no new environment variables, paid APIs or database migrations are needed.

`checklist.json` and `baseline.json` are the starting inventory and preservation evidence; do not recreate them on resume. `cover-NNN-research.json` contains unapproved candidates. Only explicit entries in `cover-NNN-decisions.json` may be published. The shared publisher supports `mode: "cover-photos"` without changing the historical 148-place checklist.

```powershell
node scripts/research-cover-gaps.mjs
node scripts/publish-place-enrichment-batch.mjs docs/place-enrichment/cover-completion/cover-NNN-decisions.json
npm run export:directory
node scripts/place-enrichment-progress.mjs
npm run progress:instagram
node scripts/cover-photo-progress.mjs
npm run validate:places
npm test
```

After a production preview is running, set LAKBAY_TEST_ORIGIN and run `node tests/cover-photos-browser.mjs`. Final validation evidence is in validation.json. Changes must be pushed and deployed to update Vercel; this pass did not publish a deployment.
