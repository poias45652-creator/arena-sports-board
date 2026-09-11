# Arena — original v63 on Render

This project contains the original Arena application exported from Sites v63 (source commit `983361af860520b9aa9f74e6c95c7cfffd2c49e4`), adapted for Node.js and PostgreSQL on the existing Render service. It replaces the former standalone `public/index.html` interface.

## Preserved application

Original overview, standings, teams, live scores, pregame analysis, source-market display, settlement calculations, administration pages, styles, UI components, and bundled historical sports data are retained. All 220 exported source files passed the supplied SHA-256 manifest check before adaptation. The export contains no live Sites accounts or source credentials.

## Platform changes

- Next.js runs the original React application on Node.js 24; Vinext/Cloudflare build files remain as original references only.
- The existing Render Arena username/password accounts and hashed sessions are retained. ChatGPT platform sign-in cannot be transported with the source ZIP; old sign-in paths lead to the Arena account screen.
- The PostgreSQL adapter implements the original statement/batch operations. `db/render-schema.sql` is the active additive schema; `db/schema.ts` and `drizzle/` preserve the original SQLite schema for reference.
- The original tz login generates a distinct device ID for each Arena member, verifies authorization, encrypts the returned token, and then accepts the SUPER Games page URL. Passwords are used for login only. No Device ID input is shown.
- Source quotes, analysis caches and new analysis snapshots are isolated by Arena member. Missing personal authorization never falls back to a shared source account. Original parser, pricing, settlement and analysis calculations are unchanged.
- Public historical assets are read from the bundled `public/` directory instead of a Cloudflare ASSETS binding.

## Existing Render service

Use Node.js 24, `npm ci --ignore-scripts && npm run build`, then `npm start`. The existing service's `npm install` command is also supported: postinstall builds when `RENDER=true`. Start runs additive migrations under a transaction lock, then starts the standalone server on `0.0.0.0:$PORT`.

Keep the existing `DATABASE_URL`, `TZ_BINDING_KEY`, and `ARENA_SETUP_TOKEN` values in Render. Never put them in this repository. `APP_ORIGIN` must match the public origin; Render's `RENDER_EXTERNAL_URL` is the fallback. A base64 32-byte binding key is required. Do not rotate it without a credential migration plan.

Health: `/api/health` or `/health`. First administrator setup remains available at `/login` until an administrator exists. Existing members are not promoted or overwritten.

## Verification

- `npm run test:source`: original source-authentication, member-isolation, source-error, full-game/first-half parsing and settlement regressions.
- `npm run test:analysis`: original analysis and historical-data regressions.
- `npm run build`: production compilation and type checks.
- `npm run test:render`: real PostgreSQL 18 integration using only a dedicated `arena_admin_setup_test` database on localhost or the CI postgres service. Tests verify existing account compatibility, concurrent administrator setup, rollback, session checks, and original source logic using synthetic source responses.

Real source login, live odds availability and external data refresh must still be verified in the deployed app with each member's own authorized login. Tests never use real source credentials. An upstream rejection remains an error, not a successful connection.

The original Sites service and its database are not modified. The legacy Render source_bindings table is retained; users revalidate through the original tz flow to create new verified token bindings. Existing Render members continue using their accounts. This is a request-driven application, not a separately scheduled continuous collector.
