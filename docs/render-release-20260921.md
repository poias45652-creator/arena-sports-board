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

## v173-render.2: retain today's cards after first pitch

The future-only board filter accidentally removed every NPB card after the 13:00 starts. When the remaining 17:00 game was cancelled, the empty automatic date also prevented a fresh dated pregame request on reload.

Keep today's fixtures after their scheduled start, including live source cards. Use an explicit Taipei date when no schedule is available, and load today's pregame feed independently of the card list. Tomorrow remains selectable; cancelled/postponed games and previous-day fixtures remain excluded. Fixture matching still distinguishes doubleheaders. Started games retain their team and pitcher details but cannot generate new pregame predictions or selections.

Validation: 46 related regression tests passed, including the reported 14:17 scenario, empty-feed date selection, midnight rollover, tomorrow selection, live-odds deduplication, and cancellation handling. Rendering the actual React board at 14:17 produced all three non-cancelled NPB cards with logos and the recommendation button disabled.
