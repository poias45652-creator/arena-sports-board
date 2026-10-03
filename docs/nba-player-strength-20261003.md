# NBA player and opponent model

Current NBA.com team rosters determine membership, so incoming players carry
their own historical results from their former club. Current player pages plus
team reports supply published availability evidence. An absent report is
`unknown`, never an assertion that the player is healthy. Reports must be no
older than 72 hours and cannot be future-dated. Explicit minutes limits are hard
ceilings. NBA.com hosts third-party fantasy injury reports; these are not a
complete official active/inactive list.

Individual statistics are completed ESPN player boxes distributed by
SportsDataverse. NBA.com's full-season statistics endpoint returned HTTP 500
during this implementation; its five-game profile sample is not misrepresented
as a full season. Player identities join NBA.com by unique exact normalized
full name on both sources. Unmatched or ambiguous names are excluded.

Production per minute uses the explicit box-score Game Score equation in
`scripts/nba-player-strength.py`. It includes scoring efficiency, offensive and
defensive rebounds, assists, steals, blocks, turnovers and fouls. Up to 40 prior
appearances within 400 days are weighted by age and shrunk toward a stated
baseline for small samples. It is a box-score strength proxy, not a causal
defensive impact or adjusted plus-minus estimate.

Ridge regression predicts margin from home venue, projected player production,
recent net margin, opponents' recent net margins, and rest. Historical rotation
features use the previous ten team games; target-game participants and minutes
are never used as predictors. All games on a UTC day are predicted before that
day's outcomes enter the history. 2023 warms up histories; 2024 trains and 2025
selects regularization and residual spread. 2026 (1,307 games) is held out.
Results and exact coefficients are in `data/nba-player-model.json`. The named
comparison is a simple recent-net baseline, not an exact replay of the old
efficiency model. Holdout accuracy does not certify individual game win rates.

Live rosters, injury probabilities, rookies and preseason rotations have not
been independently historically calibrated. Preseason projections apply
16/20/24-minute starter-cap scenarios, distribute the remaining minutes to
teammates, and discount old team net margins after an offseason. Doubtful and
questionable statuses are scenario weights, not measured participation odds.
Every scenario totals 240 player-minutes; unavailable players get zero. All
minutes without explicit sourced caps remain estimates. The range shown is a
rotation sensitivity range, not a confidence interval. Preseason picks are
withheld; no claim of a calibrated preseason probability is made.

The previous efficiency model still supplies the total-points estimate. This
change is a margin/winner model; it does not claim a new calibrated totals
model. No bookmaker line or odds is a model input and no team is forced to win.

`nba-player-strength-sync.yml` refreshes individual results every three hours
(GitHub schedules can be delayed). Failed/invalid refreshes do not overwrite
the snapshot. Snapshots older than 36 hours, unavailable current rosters, or
less than 75% of estimated minutes supported by eight individual games
withhold a forecast. NBA.com page caches expire after 15 minutes. WNBA is
unchanged.
