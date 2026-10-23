# Instagram detail-cover preview

The existing licensed cover photograph remains preferred. When it is absent, a detail page may use its first reviewed, public-post, manual-embed resource as an opt-in cover preview. Link-only/unavailable or unreviewed resources are ineligible. Without either resource, the existing compass artwork remains. A temporary failure to download an approved cover does not reclassify the image or replace it with Instagram.

The cover uses the existing Instagram component and shared on-demand loader. **Load Instagram preview** is a compact native button; it is disabled until hydration can handle activation. No Instagram script, frame or asset is requested beforehand. The **View original on Instagram** link is visible before loading and remains available after errors. Script failure offers an explicit retry; blocked/unavailable posts retain the source link and neutral fallback guidance. Neither a loaded script nor a blank frame is reported as successful content rendering.

The official widget has natural full height and a 326–658 px supported width. There is no crop, fixed maximum height, overlay, mask, extracted image URL, hotlinked CDN asset or rehosted photograph. Official branding, attribution, links and controls stay inside the untouched original frame. At narrow tablet/laptop widths the cover layout stacks; below the widget minimum, use the original link. The selected post is omitted from the lower Instagram section; additional resources remain separately opt-in.

## Current official guidance

The public [Meta Embed Button documentation](https://developers.facebook.com/documentation/instagram-platform/embed-button) and [Instagram oEmbed documentation](https://developers.facebook.com/documentation/instagram-platform/oembed) were retrieved normally over HTTPS on **23 October 2026 UTC**, both HTTP 200. They describe embedding eligible public original posts using the official markup/runtime, responsive height, and manual processing through `instgrm.Embeds.process()`. Private/inactive/age-restricted content and owner-disabled embeds are unsupported. The runtime uses a 326 px minimum; documented maximum width is 658 px. This implementation uses the manual widget, with no oEmbed API call or new credential requirement. No placement-specific cover API is used: this is an ordinary full post embedded in the cover area's document flow.

## Current availability

Nine existing missing-photo locations have an eligible reviewed resource:

- Sohoton Cove
- Little Taj
- Ili-Likha
- Craft 1945
- Muchos Boracay
- Dinibeach Bar & Restaurant
- Piece of Sky
- Spotted Pig Cafe — Catangnan
- Glasshouse Coffee — Oboza

Source metadata and check dates were retained; eligibility for an attempted preview does not establish that a post remains public or embeddable. It does not close a licensed-photo gap. The catalog remains **426 locations, 214 approved cover photographs, 212 photo gaps**, with **37 Instagram resources for 36 locations**. There are still 390 locations without an approved Instagram resource. No descriptions, images, videos, accounts, bookmarks, trip snapshots or migrations were changed for this update.

## Checks

`tests/instagram.test.ts` checks photo preference, eligible record selection, unavailable/link-only exclusions and existing data preservation. `tests/instagram-cover-browser.mjs` exercises keyboard activation, opt-in privacy, full 1100 px fixture frames without clipping/masks, 320/390/820/1440 px layouts, original links, duplicate suppression, missing resources and script failure. `tests/instagram-browser.mjs` also confirms independent cover/lower-section opt-in while sharing one SDK request. Network fixtures do not establish real post availability; separate real-widget visual checks are recorded in `cover-preview-validation.json`.

Run with a project preview:

```powershell
$env:LAKBAY_TEST_ORIGIN = 'http://localhost:5192'
npm run test:instagram:browser
npm test
```

Both build profiles must remain supported. Run the Sites build before the native Vercel build, then TypeScript; their generated route-type files should not be mixed. No new environment variables, paid service, database changes or source-data republishing are needed. Commit/push the intended changes and redeploy Vercel to publish this behavior.
