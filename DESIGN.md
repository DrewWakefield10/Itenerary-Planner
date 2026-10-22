---
version: alpha
name: Lakbay travel journal
description: A Philippine travel notebook with a practical, sourced directory and traveler-controlled itinerary.
colors:
  primary: "#167d8d"
  marine: "#164b65"
  paper: "#fffbf3"
  sand: "#f6ecd8"
  accent: "#f48b52"
  ink: "#263238"
  muted: "#657068"
  line: "#dcd7c8"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
  body:
    fontFamily: "DM Sans, sans-serif"
  handwriting:
    fontFamily: "Caveat, cursive"
spacing:
  page-max: "1200px"
  section: "70px"
omitted:
  - section: rounded
    reason: Existing component-specific shapes remain in the canonical stylesheet; this feature does not replace them.
  - section: components
    reason: Runtime component classes remain canonical; ownership is documented below and in UX-CONTRACT.md.
---

# Lakbay design context

## Overview

Preserve the established illustrated travel-journal identity: paper notes, local photographs, serif destination names, restrained handwritten accents. The product serves English-speaking travelers planning Philippine visits, often on a phone. Discover is a product directory; the homepage retains its editorial travel-journal register. This update adds geographic clarity, not a redesign.

The visual signature is a collection of destination photo tabs leading into sourced place cards. Counts, addresses, and source status must remain legible and factual. Avoid travel-booking claims, generic dashboard metrics, and images representing one attraction as another.

## Colors

Runtime tokens in `app/globals.css` are canonical (Model B). Frontmatter mirrors `--teal`, `--marine`, `--paper`, `--sand`, `--orange`, `--ink`, `--muted`, and `--line` respectively. Teal marks active filters and primary actions; orange provides the existing visible focus outline. Status is always text, never color alone. No new theme is introduced.

## Typography

`--serif`, `--sans`, and `--hand` map to display, body, and handwriting above. Directory facts and source labels use the body face; page and place headings use the serif. Long administrative names and source links wrap. Preserve original Philippine spelling and diacritics; search normalizes diacritics without rewriting stored names.

## Layout

The existing `.page`, `.section`, `.discovery-grid`, `.paper-note`, and `.discovery-detail-grid` own width and spacing. Destination tabs use a responsive grid; the complete directory paginates at 12 records. Filters remain visible native controls with labels. The document owns scrolling; dialogs have bounded inner scrolling.

Discover puts filtered, paginated Spots to discover before the unchanged readership section in DOM order. Place details lead with the actual municipality and a documentary photograph, followed by overview/highlights, place-specific videos, practical notes, and expandable sources/credits. The existing cream/teal notebook remains canonical. Video players use YouTube's own privacy-enhanced iframe surface in a two-column desktop, one-column mobile grid; controls are never recreated. Every player reserves 16:9 space and has an external fallback link. Photography reserves space and falls back to the compass without substituting another place's photo.

## Elevation & Depth

Keep existing paper borders and photographic framing. New filter controls do not add a competing shadow or overlay system.

## Shapes

Reuse `.button`, `.button.secondary`, and `.text-link`. Destination selectors are real buttons with selected, hover, disabled, and focus states.

## Components

| Surface | Canonical implementation |
| --- | --- |
| Directory cards, filters, details | `components/discover.tsx` and existing discovery CSS |
| Source status and review explanation | `components/source-indicator.tsx` |
| Add preview and explicit acceptance | `components/discovery-add-dialog.tsx`, `lib/discovery-planning.ts` |
| Map | Lazy `components/trip-map.tsx`; no fabricated pins or routes |
| Global scrollbar | `app/globals.css`, using existing muted/paper/teal/marine tokens |

## Do's and Don'ts

Keep browsing groups distinct from municipalities and overnight bases. Reuse licensed local assets with their existing credits; use the compass fallback when no matching place photo exists. Do not let an accepted identity imply verified prices, hours, accessibility, or travel safety. Preserve source metadata in snapshots and require explicit acceptance for itinerary additions.

The planner keeps precise place-type controls in an optional native disclosure below travel interests. Reuse labeled native checkboxes in the existing responsive form grid. Explain that types take priority over broad interests and shortages retain open time. Keep free time distinct from catalog venues; no decorative or structural redesign accompanies selection changes.

Account surfaces preserve the travel-journal palette, photography, typography and paper-note controls. My Trips distinguishes private account trips from browser drafts; Saved Places is an ordinary responsive list of private bookmarks. Google is the sole account provider. No password form or hosted ChatGPT sign-in is shown. Explicit Save Trip/Save Changes, revision conflict recovery, session-expiry recovery, and app-owned delete/navigation dialogs follow `docs/accounts.md` and `UX-CONTRACT.md`. Public snapshot sharing is disabled. Native date/time and select popups retain platform-owned geometry; new modal names and cancellation behavior reuse the existing HTML dialog pattern. Account navigation truncates long display names without hiding their accessible text.
