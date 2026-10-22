# Google accounts and personal saving

## Release status and remaining setup

Lakbay is a standalone project. Google-only authentication uses Better Auth 1.7.12, persistent SQLite storage, private complete-trip snapshots, explicit saves, revision conflicts, bookmarks, and account-scoped recovery drafts. Native Next.js on **Vercel uses Turso/libSQL**. The optional Sites Worker can still use its existing Cloudflare D1 binding. No Cloudflare binding, Sites account, or ChatGPT account is needed on Vercel.

On 22 October 2026, the public Vercel session endpoint returned `{"enabled":false,"user":null}`. The previous code required both valid Google configuration **and** `accountDatabase()` from the Sites Worker. Native Next.js never invoked that Worker, so the D1 binding was always absent even with all four Google variables set. The old `db/index.ts` also imported `cloudflare:workers`; it now uses the host-independent backend. Google configuration by itself does not provide a database.

The new readiness gate checks configuration at request time, connects to the selected database, checks every required table/column and enabled foreign keys, and verifies write access with a transaction that changes no rows. Success is cached for at most 15 seconds per server instance; failed checks are retried. It never creates schema during requests, enables fake sessions, or stores production data in a Vercel filesystem. Missing setup preserves guest planning and exports.

The user's explicit Google-only instruction supersedes the starter's ChatGPT sign-in integration. Lakbay does not authenticate a personal account from `oai-authenticated-user-*` headers and does not offer a separate password. First Google sign-in creates the account; Google handles email verification, account registration and password recovery. No Google Workspace domain restriction is configured, so personal accounts are supported.

## Exact Vercel setup

The user has provisioned Turso and configured all six Production variables. Database table/migration status is not yet known: provisioning a database does not run this project's migration. Follow the authenticated migration commands below, push this source update, and redeploy. The provisioning notes remain for future environments. Use a **libSQL-compatible database endpoint**, as supported by the [TypeScript SDK](https://docs.turso.tech/sdk/ts/reference) and [Drizzle adapter](https://orm.drizzle.team/docs/get-started/turso-new).

### Continue with the existing Production database

In **PowerShell on your computer**, run these commands in `C:\Users\Ryzen\Desktop\itenerary planner\lakbay`, using the account that owns the Vercel project:

```powershell
Set-Location 'C:\Users\Ryzen\Desktop\itenerary planner\lakbay'
npm ci
npx vercel login
npx vercel link
npx vercel env pull .env.production.local --environment=production
npm run db:check -- --account-env .env.production.local
```

During `vercel link`, choose the **existing** Lakbay project whose Production domain is `lakbay-itinerary-planner-psi.vercel.app`. Do not create another project. `vercel env pull` downloads the variables through your authenticated account; it does not require posting credentials in chat. `.env.production.local` and `.vercel/` are already ignored by Git. This separate file avoids overwriting local development configuration. The migration scripts do not print credentials; already-exported shell environment values take precedence over the file, so use a fresh shell without another database's exported values.

`db:check` reports the applied and pending migration names and probes schema/connectivity/write access. On an empty database, expect `Pending migrations: 0000_shiny_umar` and `Account database: database_schema_missing`, with a nonzero exit. That is an actionable setup result. Then run:

```powershell
npm run db:migrate -- --account-env .env.production.local
npm run db:check -- --account-env .env.production.local
```

Success should report `Applied migrations: 0000_shiny_umar`, `Pending migrations: none` and `Account database: ready`. The migration creates `user`, `account`, `session`, `verification`, `personal_trips`, `itinerary_stops`, and `bookmarks`, plus the migration ledger. A repeat run does not create duplicate tables or users. Mismatched/unknown migration history stops before changing schema. Existing untracked tables need a backup and explicit reconciliation; do not drop them to force setup through.

If Vercel marks a secret non-exportable and writes a placeholder, the pull command cannot recover that secret. Put the existing Turso URL and read/write token directly into the ignored local environment file using your local editor, or run the scripts in your own secure environment where those two variables are available. Never paste credentials into chat or commit the file. See [Vercel's environment pull behavior](https://vercel.com/docs/cli/env#how-vercel-env-pull-merges-into-an-existing-file).

After migrations, push the prepared source commit to `main`. Confirm the Git integration creates a new Production deployment of that commit with the six variables; if it does not, redeploy that new commit in Vercel. Redeploying the old D1-only commit alone cannot fix this issue. Confirm the Google callback is `https://lakbay-itinerary-planner-psi.vercel.app/api/auth/callback/google` and the public session endpoint reports `enabled: true` / `readiness: ready` before attempting live login.

The continuation audit confirmed that GitHub `main` was still `802fd2b` and the public endpoint still returned the old `{"enabled":false,"user":null}` shape. The current workspace had no Turso environment values or environment files, Vercel CLI reported `Logged out`, and no browser session was available. Therefore live migration status, migration application and Google consent could not be verified here. This is an access limitation, not evidence that the new database's tables are missing. The code and automated tests are prepared for GitHub without bypassing readiness.

### Provisioning reference for another environment

1. Sign in to [Turso Cloud](https://app.turso.tech/), create a database named `lakbay-production`, and choose a region close to the Vercel function region. Copy its database URL and generate a **read/write database authentication token**. Use the database token, not an organization/platform API token. The URL should look like `libsql://<database>-<organization>.turso.io` (the equivalent HTTPS endpoint also works).
2. Alternatively, after installing the [Turso CLI](https://docs.turso.tech/cli/introduction), run:

   ```text
   turso auth login
   turso db create lakbay-production --wait
   turso db show lakbay-production --url
   turso db tokens create lakbay-production --expiration 90d
   ```

   Rotate the token in Vercel before that expiration. Do not use `--read-only`.
3. In Vercel, open **Project Settings > Environment Variables**. Set these six server-side values for **Production** (never `NEXT_PUBLIC_`):

   | Key | Value |
   | --- | --- |
   | `TURSO_DATABASE_URL` | The new database's `libsql://...` URL |
   | `TURSO_AUTH_TOKEN` | Its read/write database token |
   | `BETTER_AUTH_URL` | `https://lakbay-itinerary-planner-psi.vercel.app` |
   | `BETTER_AUTH_SECRET` | Keep the existing stable random secret, at least 32 characters |
   | `GOOGLE_CLIENT_ID` | Existing Google Web application client ID |
   | `GOOGLE_CLIENT_SECRET` | Existing matching client secret |

   `BETTER_AUTH_URL` must be the canonical root origin: HTTPS, no path, query, fragment or embedded credentials. Vercel deployments reject localhost auth origins. Preview deployments do not inherit Production variables. Use a separate database and OAuth origin/client for previews if needed.
4. In the local repository, create an ignored `.env.local` containing **only the two Turso values** above, or set them securely in the shell environment. Then run:

   ```text
   npm ci
   npm run db:migrate
   npm run db:check
   ```

   Both commands should finish with `Account database: ready`. The migration command creates the seven real tables and an immutable hash ledger (`lakbay_migrations`). Re-running it applies only pending migrations; a failure rolls back that migration. Never manually replay an already-applied file or edit its contents. A database with existing untracked tables requires a backup and schema reconciliation; the script deliberately fails instead of dropping or overwriting data. Do not run migrations automatically in request handlers or as an unconditional build step against preview/production databases.
5. Check the Google client settings below. Push this implementation to the Vercel-linked repository and **redeploy Production after adding the variables**. `vercel.json` runs `npm run build:vercel`; leave Output Directory unset. The two account routes explicitly use the Node.js runtime and dynamic, uncached responses. No `NODE_ENV`/`VERCEL_ENV` shortcut enables accounts, and build time does not freeze the readiness result.
6. Visit `https://lakbay-itinerary-planner-psi.vercel.app/api/account/session`. Before login the expected result is `{"enabled":true,"readiness":"ready","user":null}`. A failure returns a non-secret reason:

   | `readiness` | Action |
   | --- | --- |
   | `auth_configuration_invalid` | Check the four auth variables, secret length, root HTTPS origin, then redeploy |
   | `database_not_configured` | Add both Turso variables to this deployment's environment, then redeploy |
   | `database_configuration_invalid` | Supply a remote `libsql://` or HTTPS origin, not a file or connection URL with credentials/path |
   | `database_unavailable` | Check endpoint, token validity/expiration, networking and database availability |
   | `database_schema_missing` | Run `npm run db:migrate`; all expected columns and foreign keys are required |
   | `database_write_unavailable` | Use a read/write token; check database quotas/permissions |

   No token, database URL, secret or user information from an unsigned request is included in these diagnostics. A concurrent failure after readiness still returns an error and never reports a successful save.

Existing D1 data is not silently copied to Turso. If the earlier Site contains real saved trips, retain it and back it up before a separate, reviewed migration. Guest browser drafts also belong to their original browser origin; exported JSON can be imported on the new origin.

## Google Console setup

1. In the [Google Cloud Console](https://console.cloud.google.com/), create/select the organization's project. Configure Google Auth Platform branding and an **External** audience, rather than an Internal-only Workspace audience. Supply the organization's approved support and policy information where Google requires it. No legal policy or domain ownership has been invented in this project.
2. Create a **Web application** OAuth client for production. Register this exact authorized redirect URI:

   `https://lakbay-itinerary-planner-psi.vercel.app/api/auth/callback/google`

   Use the corresponding origin `https://lakbay-itinerary-planner-psi.vercel.app` for authorized JavaScript origins. Keep production and local testing clients separate. Only `openid`, `email`, and `profile` are requested; no Gmail, Drive or other Google data permissions are needed. If Google requires a verified domain you control, attach that domain in Vercel and consistently update the canonical origin and callback. Follow [Google's web-server OAuth setup](https://developers.google.com/identity/protocols/oauth2/web-server) and [production setup guidance](https://developers.google.com/identity/protocols/oauth2/production-readiness/policy-compliance).
3. Keep these **server-side production environment values** in Vercel:

   | Key | Value |
   | --- | --- |
   | `BETTER_AUTH_URL` | `https://lakbay-itinerary-planner-psi.vercel.app` (or the single canonical custom origin; no path) |
   | `BETTER_AUTH_SECRET` | A stable, cryptographically random secret of at least 32 characters; keep it private |
   | `GOOGLE_CLIENT_ID` | The production Web application client ID from Google |
   | `GOOGLE_CLIENT_SECRET` | That client's secret; keep it private |

   Do not send secrets in chat, commit them, put them in `.openai/hosting.json`, or prefix them with `NEXT_PUBLIC_`. Use the runtime secret fields for the two secrets. Rotating the Better Auth secret invalidates existing sessions and encrypted OAuth credentials.
4. During Google testing, add the intended personal Google test accounts to the project's audience. Before general use, complete the Google publishing/branding steps appropriate to that project. This cannot be completed without the Google project's owner and credentials.
5. Keep ordinary browsing public. Personal trips and bookmarks remain protected by Google sessions and owner-scoped APIs. Public snapshot generation and viewing are disabled; JSON backup export remains available.
6. Verify a live Google sign-in with two personal Google accounts: save a guest trip, refresh, open it in a fresh signed-in browser, edit and save it, bookmark a place, sign out, and verify that the other account gets no access to the first account's IDs. OAuth and UI fixtures passed, but no claim is made that a real Google consent screen has been tested without credentials.

See [Better Auth's Google instructions](https://better-auth.com/docs/authentication/google), [Drizzle adapter](https://better-auth.com/docs/adapters/drizzle), and [session management](https://better-auth.com/docs/concepts/session-management).

## Storage, identity and ownership

`lib/account-database.ts` selects the request's D1 binding when hosted on the existing Worker, otherwise the persistent remote libSQL client. `db/schema.ts` and the unchanged, schema-only `drizzle/0000_shiny_umar.sql` migration create:

- Better Auth's `user`, `account`, `session` and `verification` records, with identity/session indexes and cascading user relationships.
- `personal_trips`, keyed by `(owner_id, id)`, containing the complete validated snapshot, revision, last mutation ID and server-created/updated UTC timestamps.
- `itinerary_stops`, indexed by location ID, with ordered day/stop indexes, activity IDs, selected catalog IDs and saved names. The composite trip foreign key cascades on deletion.
- `bookmarks`, keyed by `(owner_id, place_id)`, retaining a useful name, description and administrative summary even if the listing disappears.

The request-scoped Worker binding in `lib/account-context.ts` is optional. Vercel uses `@libsql/client/web` over remote HTTP and Drizzle's native libSQL adapter, sharing a cached connection but never a cached per-user identity. Every account operation obtains the user from Better Auth's verified database session. All trip/bookmark queries bind that authenticated owner. The browser cannot choose an owner through JSON, headers, path or query parameters. Platform identity headers are ignored. No direct database endpoint or public trip-read endpoint exists.

Sessions use the library's HttpOnly cookies, Secure cookies on HTTPS, state and PKCE protections, and database session validation with cookie caching disabled. Sessions last 30 days and renew after a day of use. The session endpoint forwards cookie refreshes. Sign-out revokes the session and clears private recovery state; cross-tab notifications and focus/visibility refreshes recheck identity. OAuth credentials are encrypted by Better Auth. Logs do not print OAuth codes, tokens or account details.

Trips are loaded from their snapshot, **never generated again**. Sources, estimates, place types, request preferences, dates, costs, notes, stop order and unknown coordinates remain in that snapshot. Missing catalog entries show an availability notice without replacing their saved descriptions. Duplicating a trip creates a new stable ID and preserves the itinerary. Deletion requires an explicit app dialog and a matching saved revision.

## Save and recovery contract

- Guests use the existing browser-local draft store. The editor explicitly says the trip is not yet stored in an account. It can be exported without login.
- Save Trip preserves the draft and pending action in the same browser tab, starts top-level Google OAuth, returns to the trip and completes the save. Bookmark sign-in uses the same pending-action mechanism. Cancelling or failing login preserves the guest draft and allows retry.
- Trip ID plus owner is the durable identity. Repeated identical saves and retrying the last mutation ID do not create duplicate trips or revisions. Bookmark uniqueness is enforced by the database key.
- Account edits use an explicit **Save Changes** action. In-tab recovery drafts use `sessionStorage` under owner-specific keys; saved account snapshots are not mirrored into the shared guest store. A successful first account save removes the former guest copy. Browser-local guest data is not silently imported into an account.
- Revision checks reject stale updates/deletes, including restored drafts based on an older server revision. The user can retry, reload the account version or save a separate copy. D1 batches or libSQL write transactions atomically update the snapshot and stop index, with conditional guards preventing partial index replacement after a revision conflict.
- Saving, saved, unsaved, offline/error and expired-session states are distinct. Later edits made during a save remain unsaved rather than being overwritten by the response. In-app navigation uses a confirmation dialog; actual unload uses `beforeunload` while account edits are unsaved.
- Expired sessions conceal private content and preserve an owner-bound recovery draft. Re-authenticating the same owner restores it. Switching owners clears old private drafts and does not transfer them or pending private saves into the new account. Sign-out clears private recovery drafts. Blocking browser recovery storage does not disable an otherwise valid backend session, but it prevents redirect recovery; the editor explains when an export is needed.
- Account trips are available through My Trips across devices. Browser drafts remain explicitly device-local. Saved Places supports removal and the existing destination-compatible add-to-trip preview, followed by explicit confirmation against the latest saved revision. Neither preview nor dismissal mutates the trip.

API responses are private/no-store. Mutations require same-origin requests and valid sessions. Input is validated and bounded; trips are limited to 1 MB. Owner ID, created/updated timestamps and revisions returned by the server are not authorization inputs from the browser. Native Next/Vercel account persistence requires the configured and migrated remote database; it never uses an ephemeral filesystem database.

## Optional Sites/Cloudflare local development

The migration was generated with `npm run db:generate` and applied to the local preview database. Sites applies committed pending migrations during deployment. Do not create tables during requests, seed demo users in migrations, edit applied migrations, or replay an already-applied SQL file.
For a fresh local checkout, build once, then apply the migration once:

```powershell
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_shiny_umar.sql
npm run dev
```

For local real Google login, use a separate development OAuth client and register exactly the origin you use, such as `http://127.0.0.1:5173/api/auth/callback/google`. Put the four environment keys in an ignored local environment file; restart the preview. No credentials are required for ordinary guest planning or tests. Production never uses the starter's local ChatGPT identity emulator for Lakbay accounts.

Zod was upgraded to satisfy the maintained authentication library's peer dependency. Existing itinerary/catalog validation explicitly imports `zod/v3`, preserving its prior semantics; the authentication library uses its supported Zod 4 APIs.

## Earlier D1 validation evidence

- `npm test`: 72 unit/integration tests, including seven account tests against real SQLite running the committed migration. Tests cover exact snapshot/stop-index preservation, a reopened database connection, two owners, unknown/expired/forged sessions, CSRF, untrusted owner IDs, bookmarks, idempotency, revision conflicts and cascade deletion.
- `npx tsx tests/accounts-worker.ts`: additionally passed against the actual local Worker and persistent Miniflare D1 database, using isolated signed session fixtures. It verifies HTTP save/retry/edit, two-owner isolation, stale revisions, bookmark uniqueness and deletion; it cleans up the two local fixture users afterwards. It is hard-coded to localhost and `--local`, with no production test-login endpoint. This caught and fixed the development variable bridge: Vite now forwards only the four auth values to local Worker vars during serve, never into production build output. The production platform injects its own runtime values.
- The Google test invokes the actual Better Auth OAuth handler with signed fixture ID tokens and controlled token/JWKS responses. It exercises state, PKCE, verified personal account creation, session restoration and logout. This is not a production Google credential test.
- `node tests/accounts-browser.mjs`: guest-to-Google save without content loss, private editor, failed saves/retry, dates/notes, session recovery, reload, bookmarks including a guest's pending bookmark, immutable directory preview/dismissal/accepted account addition, duplicate/delete confirmation, account switching and desktop/390 px layouts. Browser transport uses fixtures; backend authorization is covered separately by the real auth/SQLite integration tests.
- The nine existing browser suites passed, including questionnaire, editing/maps/budget, JSON/PDF backups, sources/legacy imports, rain alternatives, overnight bases, directory and exact category selection. Snapshot-sharing tests now assert that no public sharing control exists.
- `premium-ui.json` declares the UI ownership map. The strict static audit was run and its unchanged results are saved in `account-ui-audit.json`: seven actionless-button flags in inherited wrappers. Reviewed evidence shows real delegated actions (`asChild` links, library-owned dialog/calendar behavior, and forwarded component props). They are scanner false positives, not a claimed clean exit. Product form/textarea findings were fixed. The audit does not replace browser testing.

The preceding results describe the earlier D1 release. For the Vercel update, `tests/vercel-accounts.test.ts` additionally exercises actual libSQL migrations and rollback, schema/write readiness failures, exact snapshots after reconnect, private two-owner storage, revision checks, bookmark uniqueness, real Better Auth Google OAuth with signed token/JWKS fixtures, and the remote HTTP backend without a D1 binding. File databases and HTTP protocol fixtures exist only in tests; production rejects file database URLs. The Google fixture is not a live Google consent-screen test. A real Turso endpoint/token and a personal Google browser session are required for final live verification.

## Vercel update validation (22 October 2026)

- `npm test`: 77 tests, including the five new libSQL/Vercel tests. `npm run test:accounts` runs all 12 focused D1/libSQL account tests.
- Continuation checks additionally confirm read-only applied/pending migration inspection, repeat migration behavior, restoration of the same account/trip/bookmark after logout and another Google OAuth sign-in, and two signed-in owners' read/delete/bookmark isolation through the actual libSQL HTTP client with controlled transport fixtures. `npm test`, the focused backend ESLint check, native build and typecheck passed. No remote credentials were used in these tests.
- `npm run build:vercel` and `npm run typecheck`: passed. Native Next.js marks both account handlers dynamic; readiness is evaluated at runtime.
- With an intentionally unconfigured native production server (`node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 5173`), `node tests/vercel-readiness-browser.mjs` verified the actual uncached disabled session response, 503 from sign-in, guest planning, standalone copy, and 1440/390 px layouts, without API fixtures.
- The complete account browser suite passed against that native server using `$env:LAKBAY_TEST_ORIGIN='http://localhost:5173'; npm run test:accounts:browser`. This UI suite uses account transport fixtures; real storage/auth are covered by the integration tests above. Native Next normalizes loopback request URLs to `localhost`, so the test uses that matching origin for CSRF checks. The existing foundation browser suite also passed.
- The strict UI audit remains at the same seven documented inherited wrapper flags; no new finding was introduced by this copy change.

No Vercel deployment or remote database operation was performed from this checkout. The user has now provisioned the database and all six Production variables. The public deployment still needs this source update, a migration status check/application as needed, and a new deployment. Verify actual personal Google consent, save/reload on another device, and two-account privacy after that external setup; fixture success is not a claim of live storage.
