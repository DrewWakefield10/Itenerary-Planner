# Lakbay directory behavior

The geographic brief (21 October 2026, 11 browsing groups) remains authoritative for locations. The account brief and the user's Google-only clarification (22 October 2026) govern personal saving: no ChatGPT account or separate password is required. `docs/accounts.md`, `lib/auth.ts`, `lib/account-api.ts` and `lib/account-store.ts` define identity, data lifecycle, ownership, idempotency and revision policy. No billing or public account-trip sharing is introduced.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Select/Listbox | Native labeled select in existing planner and directory | Current mobile/keyboard browser convention | Platform-owned popup geometry | Directory browser test, keyboard and narrow popup |
| Date | Existing native date/time fields | ISO date-only trip schema | Platform-owned date/time picker | Existing planner and import tests |
| Form | Existing Zod schemas and inline error region | `lib/trip.ts` and discovery preview | Inline error, preserve values | Preview rejection and storage tests |
| Scrollbar | Global `app/globals.css` | DESIGN.md runtime mapping | Browser forced-colors fallback | Computed styles and mobile overflow |
| CRUD | `lib/account-store.ts`, `lib/discovery-planning.ts`, `lib/trip-storage.ts` | Account brief and `docs/accounts.md` | Explicit cloud save; local guest draft; accepted location preview | Account integration/browser and discovery tests |
| Toast | Existing inline notice/status regions | `docs/accounts.md` | Persistent failure, saved, unsaved and session states | Account browser retry and recovery checks |

## Flow ledger

- Explore a destination: select a destination button or filter; update the same combined result set. Category, interest, name/description/municipality search compose with it. Filters and page are URL-restorable; filter edits reset pagination. Empty results offer Clear all filters.
- Browse details: cards link to stable `/discover/[id]`; real city/municipality and administrative address are separate from browsing group. Legacy catalog links remain readable but are not counted as accepted directory entries.
- Editorial place content and media live in separate stable-ID overlays. They may improve directory display/search/exports, but must never regenerate or rewrite saved trip snapshots or bookmark records. Photos carry original/source/license/creator metadata; metadata-only video checks are explicitly distinguished from footage review. Video sections are absent without an available, place-matched record. Practical unknowns stay unknown; itinerary budget allowances and estimated durations remain labeled as estimates.
- View map: only a supplied point is plotted. Missing coordinates are stated. Nearby requires a compatible local overnight base and verified pins; no cross-destination nearby lists or inferred routes.
- Add a place: only reviewed compatible stop mappings enable the existing dialog. Preview does not mutate storage. Confirm & add rebuilds validation against the current saved trip. Failure leaves the trip and user's choices intact; cancel/Escape does not save. Never silently choose a different base.
- Download: static CSV and JSON exports include all accepted records and their sources. Candidate decisions and progress are separate exports.

## State and accessibility

Use real buttons and links, visible focus, labeled native selects, and text result counts in a status region. Filters are local and synchronous; remote readership loading/failure does not block the directory. Its existing abortable request and freshness rules remain separate from catalog acceptance. Dialogs use the established native HTML dialog surface, accessible title, focus containment and restoration; browser alert/confirm/prompt are not used. English UI, peso amounts, and original local names are preserved. Reduced motion follows global styles.
