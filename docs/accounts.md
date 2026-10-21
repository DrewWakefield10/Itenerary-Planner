# Google accounts and personal saving

## Release status and remaining setup

The account implementation is complete in the project: Google-only authentication through Better Auth 1.7.12, a Cloudflare D1 backend, private complete-trip snapshots, explicit saves, revision conflicts, bookmarks, and account-scoped recovery drafts. The production environment had **no Google OAuth configuration** when inspected. Until it is configured, account sign-in controls are hidden, account APIs fail closed, and visitors can still browse, generate, edit and export guest drafts. No fake login or demo account endpoint is shipped.

The user's explicit Google-only instruction supersedes the starter's ChatGPT sign-in integration. Lakbay does not authenticate a personal account from `oai-authenticated-user-*` headers and does not offer a separate password. First Google sign-in creates the account; Google handles email verification, account registration and password recovery. No Google Workspace domain restriction is configured, so personal accounts are supported.

To activate production login:

1. In the [Google Cloud Console](https://console.cloud.google.com/), create/select the organization's project. Configure Google Auth Platform branding and an **External** audience, rather than an Internal-only Workspace audience. Supply the organization's approved support and policy information where Google requires it. No legal policy or domain ownership has been invented in this project.
2. Create a **Web application** OAuth client for production. Register this exact authorized redirect URI:

   `https://lakbay-travel-journal.m1st021.chatgpt.site/api/auth/callback/google`

   Use the corresponding origin `https://lakbay-travel-journal.m1st021.chatgpt.site` for authorized origins if requested. Keep production and local testing clients separate. Only `openid`, `email`, and `profile` are requested; no Gmail, Drive or other Google data permissions are needed. If Google requires a verified domain you control, attach that domain to the Site and consistently update the canonical origin and callback. Follow [Google's web-server OAuth setup](https://developers.google.com/identity/protocols/oauth2/web-server) and [production setup guidance](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance).
3. Add these **server-side production environment values** in the Site's runtime environment settings, then deploy/restart the Worker so it receives them:

   | Key | Value |
   | --- | --- |
   | `BETTER_AUTH_URL` | `https://lakbay-travel-journal.m1st021.chatgpt.site` (or the single canonical custom origin; no path) |
   | `BETTER_AUTH_SECRET` | A stable, cryptographically random secret of at least 32 characters; keep it private |
   | `GOOGLE_CLIENT_ID` | The production Web application client ID from Google |
   | `GOOGLE_CLIENT_SECRET` | That client's secret; keep it private |

   Do not send secrets in chat, commit them, put them in `.openai/hosting.json`, or prefix them with `NEXT_PUBLIC_`. Use the runtime secret fields for the two secrets. Rotating the Better Auth secret invalidates existing sessions and encrypted OAuth credentials.
4. During Google testing, add the intended personal Google test accounts to the project's audience. Before general use, complete the Google publishing/branding steps appropriate to that project. This cannot be completed without the Google project's owner and credentials.
5. Allow anonymous access to the **browsing Site shell** so a ChatGPT account is not required at the hosting boundary. This was requested by the user. Personal trips and bookmarks remain protected by Google sessions and owner-scoped APIs. No account data is made public by opening the shell. Public snapshot generation and viewing are disabled; JSON backup export remains available.
6. Verify a live Google sign-in with two personal Google accounts: save a guest trip, refresh, open it in a fresh signed-in browser, edit and save it, bookmark a place, sign out, and verify that the other account gets no access to the first account's IDs. OAuth and UI fixtures passed, but no claim is made that a real Google consent screen has been tested without credentials.

See [Better Auth's Google instructions](https://better-auth.com/docs/authentication/google), [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), and [session management](https://better-auth.com/docs/concepts/session-management).

## Storage, identity and ownership

`.openai/hosting.json` opts into the `DB` D1 binding. `db/schema.ts` and the generated, schema-only `drizzle/0000_shiny_umar.sql` migration create:

- Better Auth's `user`, `account`, `session` and `verification` records, with identity/session indexes and cascading user relationships.
- `personal_trips`, keyed by `(owner_id, id)`, containing the complete validated snapshot, revision, last mutation ID and server-created/updated UTC timestamps.
- `itinerary_stops`, indexed by location ID, with ordered day/stop indexes, activity IDs, selected catalog IDs and saved names. The composite trip foreign key cascades on deletion.
- `bookmarks`, keyed by `(owner_id, place_id)`, retaining a useful name, description and administrative summary even if the listing disappears.

The request-scoped Worker binding in `lib/account-context.ts` makes D1 available without a global per-user variable. Every account operation obtains the user from Better Auth's verified database session. All trip/bookmark queries bind that authenticated owner. The browser cannot choose an owner through JSON, headers, path or query parameters. Platform identity headers are ignored. No direct database endpoint or public trip-read endpoint exists.

Sessions use the library's HttpOnly cookies, Secure cookies on HTTPS, state and PKCE protections, and database session validation with cookie caching disabled. Sessions last 30 days and renew after a day of use. The session endpoint forwards cookie refreshes. Sign-out revokes the session and clears private recovery state; cross-tab notifications and focus/visibility refreshes recheck identity. OAuth credentials are encrypted by Better Auth. Logs do not print OAuth codes, tokens or account details.

Trips are loaded from their snapshot, **never generated again**. Sources, estimates, place types, request preferences, dates, costs, notes, stop order and unknown coordinates remain in that snapshot. Missing catalog entries show an availability notice without replacing their saved descriptions. Duplicating a trip creates a new stable ID and preserves the itinerary. Deletion requires an explicit app dialog and a matching saved revision.

## Save and recovery contract

- Guests use the existing browser-local draft store. The editor explicitly says the trip is not yet stored in an account. It can be exported without login.
- Save Trip preserves the draft and pending action in the same browser tab, starts top-level Google OAuth, returns to the trip and completes the save. Bookmark sign-in uses the same pending-action mechanism. Cancelling or failing login preserves the guest draft and allows retry.
- Trip ID plus owner is the durable identity. Repeated identical saves and retrying the last mutation ID do not create duplicate trips or revisions. Bookmark uniqueness is enforced by the database key.
- Account edits use an explicit **Save Changes** action. In-tab recovery drafts use `sessionStorage` under owner-specific keys; saved account snapshots are not mirrored into the shared guest store. A successful first account save removes the former guest copy. Browser-local guest data is not silently imported into an account.
- Revision checks reject stale updates/deletes, including restored drafts based on an older server revision. The user can retry, reload the account version or save a separate copy. D1 batches atomically update the snapshot and stop index, with conditional guards preventing partial index replacement after a revision conflict.
- Saving, saved, unsaved, offline/error and expired-session states are distinct. Later edits made during a save remain unsaved rather than being overwritten by the response. In-app navigation uses a confirmation dialog; actual unload uses `beforeunload` while account edits are unsaved.
- Expired sessions conceal private content and preserve an owner-bound recovery draft. Re-authenticating the same owner restores it. Switching owners clears old private drafts and does not transfer them or pending private saves into the new account. Sign-out clears private recovery drafts. Blocking browser recovery storage does not disable an otherwise valid backend session, but it prevents redirect recovery; the editor explains when an export is needed.
- Account trips are available through My Trips across devices. Browser drafts remain explicitly device-local. Saved Places supports removal and the existing destination-compatible add-to-trip preview, followed by explicit confirmation against the latest saved revision. Neither preview nor dismissal mutates the trip.

API responses are private/no-store. Mutations require same-origin requests and valid sessions. Input is validated and bounded; trips are limited to 1 MB. Owner ID, created/updated timestamps and revisions returned by the server are not authorization inputs from the browser. Native Next/Vercel builds continue to support guest planning; account persistence in this release requires the Sites/Cloudflare Worker D1 binding rather than a filesystem database.

## Local development and migrations

The migration was generated with `npm run db:generate` and applied to the local preview database. Sites applies committed pending migrations during deployment. Do not create tables during requests, seed demo users in migrations, edit applied migrations, or replay an already-applied SQL file.

For a fresh local checkout, build once, then apply the migration once:

```powershell
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_shiny_umar.sql
npm run dev
```

For local real Google login, use a separate development OAuth client and register exactly the origin you use, such as `http://127.0.0.1:5173/api/auth/callback/google`. Put the four environment keys in an ignored local environment file; restart the preview. No credentials are required for ordinary guest planning or tests. Production never uses the starter's local ChatGPT identity emulator for Lakbay accounts.

Zod was upgraded to satisfy the maintained authentication library's peer dependency. Existing itinerary/catalog validation explicitly imports `zod/v3`, preserving its prior semantics; the authentication library uses its supported Zod 4 APIs.

## Validation evidence

- `npm test`: 72 unit/integration tests, including seven account tests against real SQLite running the committed migration. Tests cover exact snapshot/stop-index preservation, a reopened database connection, two owners, unknown/expired/forged sessions, CSRF, untrusted owner IDs, bookmarks, idempotency, revision conflicts and cascade deletion.
- `npx tsx tests/accounts-worker.ts`: additionally passed against the actual local Worker and persistent Miniflare D1 database, using isolated signed session fixtures. It verifies HTTP save/retry/edit, two-owner isolation, stale revisions, bookmark uniqueness and deletion; it cleans up the two local fixture users afterwards. It is hard-coded to localhost and `--local`, with no production test-login endpoint. This caught and fixed the development variable bridge: Vite now forwards only the four auth values to local Worker vars during serve, never into production build output. The production platform injects its own runtime values.
- The Google test invokes the actual Better Auth OAuth handler with signed fixture ID tokens and controlled token/JWKS responses. It exercises state, PKCE, verified personal account creation, session restoration and logout. This is not a production Google credential test.
- `node tests/accounts-browser.mjs`: guest-to-Google save without content loss, private editor, failed saves/retry, dates/notes, session recovery, reload, bookmarks including a guest's pending bookmark, immutable directory preview/dismissal/accepted account addition, duplicate/delete confirmation, account switching and desktop/390 px layouts. Browser transport uses fixtures; backend authorization is covered separately by the real auth/SQLite integration tests.
- The nine existing browser suites passed, including questionnaire, editing/maps/budget, JSON/PDF backups, sources/legacy imports, rain alternatives, overnight bases, directory and exact category selection. Snapshot-sharing tests now assert that no public sharing control exists.
- `premium-ui.json` declares the UI ownership map. The strict static audit was run and its unchanged results are saved in `account-ui-audit.json`: seven actionless-button flags in inherited wrappers. Reviewed evidence shows real delegated actions (`asChild` links, library-owned dialog/calendar behavior, and forwarded component props). They are scanner false positives, not a claimed clean exit. Product form/textarea findings were fixed. The audit does not replace browser testing.

Final local checks passed: all 72 tests, both Sites/Vinext and native Next.js production builds, and the final TypeScript check. Ten browser suites passed, including the new account suite; the actual Worker/D1 HTTP integration passed separately. Production build output was checked to contain no local authentication variable bindings or fixture identities. Deployment outcomes are reported in the task handoff. The external blocker is the missing Google Console/OAuth configuration described above; the code does not bypass it or offer nonfunctional sign-in controls.
