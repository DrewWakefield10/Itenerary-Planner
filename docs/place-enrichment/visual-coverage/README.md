# Discover visual coverage

The November 25, 2026 Taipei-time audit found 210 of 426 listings without approved photo covers. Eleven of those 210 already had reviewed Instagram posts. The previously reported 199 counted places missing both. Photo source records use the repository’s UTC check date.

| Visual or coverage count | Locations |
| --- | ---: |
| New real location photographs | 5 |
| Total real location photographs | 221 |
| Authorized promotional graphics in use | 0 |
| Approved business logos in use | 0 |
| Original category illustrations in use | 205 |
| Still missing a real photograph | 205 |
| Reviewed Instagram gallery or post link | 39 |
| Instagram gallery or link and no photo cover | 10 |
| Neither a real cover nor a reviewed Instagram post | 195 |

See the [destination totals](summary.json) and [full gap checklist](checklist.json).

## What was reviewed

Six previous image-delivery failures were retried. All six images decoded and their individual Flickr pages supplied license metadata. Four passed the visual and location review. The Baguio café images were too indistinct to use as exact venue covers. [Download retries](00-download-retries.json) · [Reviewed photo decisions](visual-001-decisions.json)

A new open-source lead provided a fifth photo, the dining room at the Rico’s Lechon Mandaue branch. The selected file names Mandaue and another photo in the same series shows the branch name on a sign. [Reviewed branch photo](visual-002-decisions.json)

The other 204 places each reached at least one public search index. Saved batches start with 24 public attractions and 10 businesses. Query files keep source URLs, inaccessible requests, leads, and exact-identity decisions. The business batch also records publisher pages and known Instagram links where applicable. Search results do not establish ownership, branch identity, or exhaustion of every source. [Attraction pilot](research-01-attractions.json) · [Business pilot](research-02-businesses.json)

## Strong unresolved leads

- **Secret Lagoon, El Nido.** The open-license Panoramio photograph shows the adjacent Miniloc beach. An enclosed lagoon view is still needed. [Commons source](https://commons.wikimedia.org/wiki/File:Secret_lagoon_beach_on_Miniloc_island_-_panoramio_-_Tuderna.jpg)
- **Iwahig Firefly Watching, Puerto Princesa.** The CC BY-SA photo shows rapids in the watershed. The tour uses the ferry-area reach, which is unverified in that photo. [File page](https://commons.wikimedia.org/wiki/File:Iwahig_River,_Puerto_Princesa_City.jpg) · [City tourism listing](https://citytourism.puertoprincesa.ph/iwahig-firefly-watching/)
- **Lemon Grass, Ayala Center Cebu.** The Commons photo identifies the SM Seaside branch. An exact Ayala Center photo is still needed. [Commons source](https://commons.wikimedia.org/wiki/File:Lemon_Grass_at_SM_Seaside_City_(2024-08-11).jpg)
- **GoodTaste, Otek Street.** The official trademark gazette identifies the logo and branch. It supplies no directory reuse grant. See the [business pilot](research-02-businesses.json).
- **Kermit Siargao.** The official press page lists media coverage. The venue reserves its image rights, and a directory reuse grant was not established. [Official press page](https://www.kermitsiargao.com/press)

## Publishing

The photo decisions use the existing editorial publisher with the visual-pass checklist. The pipeline produces responsive local JPEGs, retains individual credits and records source and license links.

```powershell
node scripts/publish-place-enrichment-batch.mjs docs/place-enrichment/visual-coverage/visual-001-decisions.json
npm run export:directory
node scripts/place-enrichment-progress.mjs
npm run progress:instagram
node scripts/cover-photo-progress.mjs
npm run validate:places
```

Add a promotional or logo record to `lib/catalog/place-cover-assets.json` only after reviewing identity and permission to publish and resize the exact asset. Record the rights holder, individual source, original file URL, reuse evidence and credit. Use a local optimized asset under `public/images/place-covers/`. The UI preserves proportions and the original logo colors. Illustrations are shared original compositions with existing Lucide icons. No place photography is synthesized.

Vercel builds the production branch with the existing configuration. There are no new credentials, migrations or paid services. Gallery embedding stays opt-in and separate from cover approval.
