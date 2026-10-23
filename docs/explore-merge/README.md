# Explore and Travel Guides merge

Active brief: attachment 4519e02e-28f7-41b2-8dc2-3be96c3d7fb8, reviewed 23 October 2026. Preserve the established cream/teal journal and the standalone Google/Turso account model.

## Implementation inventory

- The former Travel Guides index was `/templates`; it contained eight demo trip starters, not practical article detail pages. All eight are retained in Explore’s Travel advice view and associated with their destination pages.
- `/explore` remains the destination landing page, covering 13 planning bases across all 11 browsing groups. El Nido, Coron and Puerto Princesa are grouped under Palawan, with independent guide and planner links. The ambiguous legacy Palawan slug remains readable without becoming a new planner selection.
- `/explore/advice` contains four concise planning checklists distilled from existing planner/Essentials material, followed by the retained starters. `/explore/advice/transport`, `/budgeting`, `/packing` and `/preparation` provide readable detail pages. Existing official-resource metadata and dates are reused; no current fares, schedules, rules or safety assessments are invented.
- `/destinations/[slug]` stays canonical for existing destination guides. Existing descriptions, location/transport/season/accessibility notes, budget estimates and source labels are preserved. Three relevant place cards and up to two food links lead into the existing Discover detail pages; See all places applies the exact browsing destination filter.
- `/templates` permanently redirects to `/explore/advice`, preserving query parameters and browser fragments. `/explore?view=advice` is also accepted as an alias. Separate index paths keep page titles correct during production prefetch/navigation. No former article routes were found, so none are fabricated or redirected indiscriminately.
- Plan a Trip stays separate. New links prefill an empty planner. A differing saved draft gets the shared confirmation dialog with replace/add choices, optional suggested duration and Keep my draft/Escape. Until explicit acceptance, its storage remains unchanged. Three-base and duration constraints still validate. Malformed drafts are retained until an explicit Start a new planner draft action.

## Validation

Implementation and focused validation are complete. All 104 unit/integration tests, TypeScript, the Sites/Vinext build and native Vercel build pass. Production browser checks cover the merged flow at desktop/mobile sizes, correct route titles, permanent redirects and query/hash preservation, Back/Forward, all eight starters, destination-to-Discover filtering, planner preview/Escape/acceptance/reload, malformed-draft recovery and exact saved-trip preservation. Existing account/bookmark, Discover, Palawan generation/maps/import/export, foundation navigation and Discover auto-scroll browser suites pass on the native production preview.

Account browser checks use UI network fixtures; a live personal Google login or production Turso write was not performed. Existing source dates, uncertainty labels and planning estimates remain independent. The new practical articles are checklists distilled from existing application material, not freshly verified transport/entry/price assessments.

Focused merge lint has no errors (the existing native-image and planner ARIA warnings remain). The account-provider file retains three pre-existing effect-state lint errors; the comparison with HEAD shows no new findings and one resolved link-rule error. The strict static UI audit retains the same seven inherited wrapper findings. See validation.json, lint-comparison.json and ui-audit.json for the exact scope; this is not a claim that full repository lint/audit is clean.

To repeat the focused browser check, start a preview, set `LAKBAY_TEST_ORIGIN` to its localhost URL, then run `npm run test:explore:browser`. Other checks use the existing npm scripts. Preserve prior media/catalog work; no enrichment research needs repeating for this merge.

No authentication backend, ownership check, database schema, stable place ID, trip snapshot, bookmark record, generation constraint or media overlay is changed by this merge. No paid service, new environment variable or migration is required. A GitHub push and Vercel deployment are needed to publish local changes.
