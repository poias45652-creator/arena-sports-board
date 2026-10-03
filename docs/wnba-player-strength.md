# WNBA player and opponent model

WNBA now uses the same player-strength engine as NBA. League-specific wrappers
provide separate player identities, verified individual statistics, regression
coefficients and margin spread. WNBA rotations total 200 player-minutes, with a
40-minute individual ceiling. NBA retains 240 and 48 respectively. Known minute
limits are hard ceilings; low/central/high availability scenarios redistribute
minutes to eligible teammates. Unreported availability remains unknown.

Current rosters come from WNBA.com's current-player directory. Player pages
must agree with the directory's ID and team slug before their Rotowire news is
used. WNBA news is identified by wnbaId, must be no more than 72 hours old, and
cannot be future-dated. Natural-language status and minute limits must name the
current opponent. These hosted reports are not a complete official active list.
Page requests are bounded to four at a time, with ten-second timeouts and a
five-minute completed-player cache. The directory cache is fifteen minutes.

The shared chronological training code consumes WNBA-only SportsDataverse ESPN
player boxes. It verifies team identities, timestamps, final scoring and total
player minutes, and refuses a refresh if a team's latest completed box is
missing. Individual rates use prior appearances across teams, so transfers
retain their own statistical history. Exact unique normalized names join ESPN
and WNBA.com; ambiguous/unmatched players do not gain invented ratings.

The model includes venue, projected individual production, recent net margin,
opponents' recent net margins and rest. 2023 warms up histories, 2024 trains,
2025 chooses regularization and residual spread, and 2026 is held out. Target
game minutes and results are never prediction inputs; a UTC day's results only
enter the history after all predictions for that day are recorded.

Initial validation used 1,174 verified games and 325 held-out predictions.
Brier score was 0.20664 versus the simple recent-net reference's 0.20591;
log loss was 0.60228 versus 0.60166. This does not demonstrate improvement over
that reference. Operational output is enabled to provide the requested
player/rotation estimates, but regularSeasonValidated and beatsReference are
false. The UI labels it 球員情境推估. This is distinct from the NBA configuration,
whose historical comparison passed. Live news and preseason scenarios have no
independent historical calibration; no accuracy improvement is claimed.

As in NBA, the existing efficiency model supplies total points and total-point
spread. Player strength adjusts the margin and winner distribution, not the
total. Actual SUPER lines are applied afterward; neither odds nor handicaps
are model inputs. The existing source-freshness and availability rules remain:
unknown/questionable key rotation players suppress regular-season badges.

The WNBA workflow refreshes snapshots every three hours without retraining or
changing coefficients. Invalid refreshes do not replace the committed snapshot.
Snapshots older than 36 hours, roster failures, or less than 75 percent of
projected minutes supported by eight prior appearances withhold the forecast.
Both primary ESPN and alternate-dataset analysis paths use this enrichment.

Verification: WNBA rotation/source/UI regressions, existing NBA model tests,
market settlement/recommendation tests, TypeScript checks and a live official
Atlanta/New York roster read. Live integration produced 14 and 15 roster
members and exactly 200 minutes per side. All availability reports for that
check were unknown; none was promoted to healthy.
