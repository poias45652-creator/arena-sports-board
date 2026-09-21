# Render v173-render.1

Port the verified daily international pregame changes to the existing Render app.

- Select pregame feeds by fixture date, including next-day KBO games.
- Fetch dated PlaySport preview pages and preserve original observation timestamps. Captured public snapshots provide a dated fallback, never a new observation time.
- Canonicalize NPB team names before joining logos, records, odds and fixtures. Keep doubleheaders distinct.
- Match verified, team-specific pitcher aliases while continuing to invalidate genuinely changed starters.
- Exclude cancelled/postponed fixtures from analysis; keep missing-source details in the administrator panel.
- Retain the existing 60% starter weight, Render authentication, PostgreSQL storage, login cover and Turnstile settings.

KBO snapshots for 2026-09-22 contain team records but no published starters or complete bullpen tables. These inputs cannot produce recommendations. Runtime source access must still succeed to keep daily data current; an open page polls pregame data every five minutes. An all-day background scheduler is not enabled by this release. CPBL official pages are not requested.

Validation: `npm test` passed 109 checks; `npm run build` passed the production Next.js compilation and TypeScript check; `node tests/run-render-http-smoke.mjs` passed 19 HTTP checks with an isolated PostgreSQL fixture.
