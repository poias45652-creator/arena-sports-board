# Arena Sports Board

Standalone Arena website for GitHub → Render, using Next.js and PostgreSQL.

## Deploy

- Node.js 24, `npm ci && npm run build`, then `npm start`.
- Set `DATABASE_URL` to a PostgreSQL connection string in the same Render region.
- Set `TZ_BINDING_KEY` to base64-encoded 32 random bytes. Keep this key stable; replacing it requires source-account rebinding.
- Set `ARENA_SETUP_TOKEN` to at least 32 random characters. This is used once to create the administrator via `/login` → First administrator setup.
- Set `APP_ORIGIN` to your HTTPS site origin if using a custom domain; otherwise Render's `RENDER_EXTERNAL_URL` is used.
- Health endpoint: `/api/health` (checks PostgreSQL).
- Startup runs idempotent database migrations under a transaction lock. No database credentials are stored in Git.

## Accounts and data

Members register independent Arena accounts and then bind their own tz account. Source passwords are used for login only; source authorizations are encrypted using AES-GCM and bound to each Arena member ID. Arena passwords use salted scrypt hashes; sessions use random opaque cookies whose hashes are stored server-side. Cookies are HTTP-only and secure in production. Incoming identity headers do not authenticate users.

Existing Sites accounts and encrypted bindings are not imported into these new accounts. The old website is retained. Existing members must register and rebind on Render. Bundled historical sports data is preserved, while live member data is stored only in PostgreSQL.

The administrator is created using the setup token from Render's private environment settings. A database constraint allows only one initial administrator; public registration never grants administrator access. There is no email verification or password recovery provider configured.

## Verification

`npm run test:source` verifies source protocol, member isolation, stale-data handling and market parsing. `npm run test:render` verifies Postgres SQL/transactions and authentication primitives using an embedded PostgreSQL engine. `npm run build` produces the production website.

## Limits

Actual source access must be verified with each member's own login on the deployed site. An upstream rejection is displayed as failure and does not trigger access-control bypasses. Updates currently run while the website is in use; this is not an independent 24-hour collector.

Render Free web services can sleep after 15 minutes of inactivity. Render Free PostgreSQL expires after 30 days and is intended for evaluation; upgrade the database before expiry for continuing use. See https://render.com/docs/free.
