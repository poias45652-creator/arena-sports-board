# Historical research, 2026-09-10

The production recommendations still use the existing baseline. This experiment is a separate research candidate, not an advanced Statcast model or verified betting strategy.

## Data

- Statcast: 2026-05-01 through 2026-05-31, 121,779 pitch/event records, 419 games. Daily core-column assets live in `public/history/statcast/`; the full original-column CSV is compressed at `public/history/statcast-2026-05.csv.gz` (119 columns). Raw files contain retrospective outcome and next-game fields: NEVER use these as pregame inputs. The normalized index excludes next-game fields, labels outcome fields, preserves nulls and filters historical pitcher summaries strictly before the requested date.
- Covers: 30 team history pages, 838 May team rows. Joined by official date, home and away IDs, a single Covers matchup ID, and matching final scores. 413 unique games also have Statcast. Ambiguous same-date doubleheaders are excluded. Bookmaker, quote timestamp, closing status, run-line prices and total prices are unavailable. No rows are eligible for ROI testing or point-in-time market-feature training.
- MLB schedule capture and normalized Covers input are retained under `data/research-inputs/`. `officialFinalGames` includes provider Final-state entries subsequently rejected for missing scores; examine the exclusion list.
- Retrosheet: existing 2023–2025 game logs; completed-game subset excludes exceptional results. Inputs contain only prior-day completed team games. Source attribution remains in the website.

## Fixed experiment

2023 train (2,115 games), 2024 sigmoid calibration (2,110), 2025 untouched test (2,113). Each team requires 20 prior games. A standardized logistic regression uses differences in shrunk wins, runs scored and runs allowed. Hyperparameters and split were fixed before evaluation. The team-score Poisson candidate is separate and only reports score error; it does not validate a full-game joint score or extra-inning distribution.

Calibrated test Brier 0.245015 versus log5 0.248262. Paired day-block bootstrap (2,000, fixed seed) difference 95% interval [-0.005184, -0.001320]. This is one season and a modest improvement. No test-driven feature tuning or promotion was performed. The 2026 pitch and odds archive is NOT used to predict 2025. Confirmed historical lineups, contemporaneous injuries, weather, bullpen and Statcast snapshots are not yet reconstructed for a complete advanced model.

## Reproduction

Use Python with numpy, scipy, scikit-learn; fetching additionally requires pybaseball 2.2.7 and pandas. Run from repository root:

```sh
python scripts/fetch-statcast-month.py /tmp
python scripts/prepare-statcast-month.py /tmp
python scripts/pair-historical-odds.py
python scripts/train-historical-model.py
python tests/historical-research.test.py
```

Daily downloads are bounded to two simultaneous public requests, 50-second timeout, with date and duplicate-key validation. This is an on-demand preparation script, not an installed cloud scheduler. Training source hash, coefficients, calibration and test predictions are retained in `data/`.

Backend endpoints: `/api/baseball?kind=model-validation`, `kind=historical-odds&offset=0`, `kind=statcast-history`, and `kind=statcast-records&before=2026-06-01&offset=0`. Records use 100-row pages and load only required daily assets. Research results appear only inside the existing Analysis Basis dialog.
