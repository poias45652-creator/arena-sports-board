# Baseball background refresh — prepared, not enabled

`baseball-sync-job.json` is the prepared Render cron request. It checks CPBL, NPB and KBO public feeds every minute, independent of an open browser. Existing source caches still limit pregame checks to five minutes and live games to one minute; source latency is not guaranteed. This does not refresh members' authenticated betting-provider sessions or import missing bullpen fields.

Render has no selected workspace. Its connector explicitly requires the user to confirm the workspace before any service operation. Candidate returned by the account listing: **your Render workspace**. Render Cron Jobs cost at least **US$1/month**, with actual charges based on run duration. No service has been created, no token has been configured, and the admin correctly reports background scheduling as inactive.

After that confirmation, generate a cryptographically random token of at least 32 characters. Set the same `BASEBALL_SYNC_TOKEN` as a Sites secret and a Render secret; add it to the request in memory, never this file or source control. Pass the confirmed workspace ID and the prepared request to Render. The inline Node start command is self-contained; it does not run code from the unrelated GitHub application's build and automatic deployments are off. The public repository has been verified accessible; it is only the Render source checkout.

Trigger one run, inspect each league's response and verify successful persistence. A source exception, stale feed, or persistence failure causes a failing job with per-league results; it must not be reported as a successful refresh. Only mark scheduling active after the service exists and a subsequent scheduled run succeeds. Do not infer 24/7 operation from merely configuring the token.

## Data/model status

曹祐齊: original files remain unchanged. A fixture-scoped review corrects the single-game column label from walks to BB+HBP, backed by Rebas season/split tables and the 9 September game report. Review time is recorded separately and cannot be used as information available in an earlier backtest.

CPBL probability calculation is wired for all seven markets. Missing full bullpen statistics use the observed team runs-allowed baseline during the relief phase, with explicit provenance in admin; no bullpen record is fabricated. The automatic runner in innings 10–12 uses an unfitted 0.60 Bernoulli extra-run assumption. The model has not been historically calibrated. Valid source dates, player identities, quotes and pregame status remain required.

Full bullpen coverage remains **0/6**: two saved pages have ERA without innings, WHIP, strikeouts or walks; other teams lack complete relief aggregates. Rebas public pitcher leaderboards contain season totals and starts, not the relief-only totals for mixed-role pitchers. Sportify's fetched page was blocked. Summing all pitchers or excluding mixed-role pitchers would not produce complete bullpen data. Recent bullpen usage is also still missing. No CPBL official page was fetched in this update.
