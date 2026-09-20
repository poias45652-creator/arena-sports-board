# Three-league validation protocol — frozen before evaluation, 2026-09-20

Scope: a new retrospective **team-record research baseline**, distinct from the live
starter/bullpen/inning/market model. Do not transfer its calibration coefficients to
`baseball-run-analysis.ts` or call the live models calibrated on the basis of this run.

Sources: CPBL uses the Yahoo-only `cpbl-game-logs-20260920.json` score archive. NPB and
KBO use the captured 2026 regular-season calendar in `international-profile-2026.json`.
No CPBL official requests or its old score archive enter this experiment. The source
versions were retrieved after the games: this is chronological reconstruction, not a
claim that original point-in-time source versions or forecasts were preserved.

## Precommitted experiment

- Analyze completed regular-season results through 2026-09-19, including draws.
- All features use dates strictly before the target date; update the history only
  after producing every fixture on that date. At least 20 prior games for both teams.
- Reject conflicting duplicate IDs; dedupe exact repetitions. Exclude same-day
  repeated team appearances from evaluation, but retain their final scores in later
  dates' histories. No earlier same-day result is a feature for a later game.
- Train through June 30; temperature calibration July 1–August 15; untouched test
  August 16–September 19. Never alter the split or coefficients after seeing test scores.
- Model: StandardScaler fitted on training only; multinomial logistic regression,
  L2 C=0.2, max_iter=2000. Features: differences of shrunk wins, runs scored/allowed,
  venue scored/allowed, recent-ten scored/allowed. A fixed 20-game 4.5-run prior
  and 20-game 0.5 win-share prior; ties count one half in the win-share feature.
- One scalar temperature fitted to calibration multiclass log loss only, constrained
  to [0.5, 3]. All three result classes remain in the probability vector.
- Baseline: training-only class frequencies with Laplace smoothing (one per class).
- Report all stages' sizes, class counts and date bounds; held-out multiclass Brier
  (sum of three squared errors, range 0–2), log loss, accuracy, macro ECE (five bins),
  per-class reliability bins and test predictions. No ROI or wagering win-rate claims.
- Paired date-block bootstrap: 2,000 resamples, deterministic seed 20260920.
  Report calibrated-minus-raw and calibrated-minus-frequency Brier 95% intervals.
- Sample gate: >=100 training, >=60 calibration, >=60 test, >=3 draws in each split;
  improvement gate: Brier CI upper bound <0 vs both comparators and no log-loss
  regression. A research pass **cannot** authorize deployment into a different model.
- Full production-model equivalence is false; production promotion is blocked until
  immutable pregame forecasts of that exact version have enough scored outcomes.

The full production models will start preserving server-generated, immutable,
15-minute-bucket forecasts with their input values, model version and observation
cutoffs. Evaluation selects the last saved forecast at least 60 seconds before start,
then joins an unambiguous final fixture. Forecasts are never backfilled from scores.
Incomplete, ambiguous, in-play and stale observations cannot create predictions.
Scores may be corrected by a newer verified final source without altering forecasts.

Historical odds/quote timestamps and verified first-five results are absent from this
experiment. Seven-market settlement, return on stake, same-game dependence and
full advanced-model calibration remain separate uncompleted validation targets.

References:
- https://scikit-learn.org/stable/modules/calibration.html
- https://scikit-learn.org/stable/modules/generated/sklearn.model_selection.TimeSeriesSplit.html
