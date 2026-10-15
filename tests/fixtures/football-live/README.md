# Football match centre fixtures

Public ESPN JSON captured 2026-10-15 UTC for the football layout requested by the user.

- `champions-schedule.json`: site/v2 soccer/uefa.champions/scoreboard?dates=20261014&limit=100 (Taiwan October 15).
- `champions-summary*.json`: site/v2 soccer/uefa.champions/summary?event=401915416 and 401915415.
- `<league>-standings.json`: v2 soccer/<league>/standings?season=2026 for all eight supported leagues.
- `<league>-year.json.gz`: site/v2 soccer/<league>/scoreboard?dates=2026&limit=1000, compressed source fields used by the parser.

Unrelated articles, videos, betting offers and repeated links are omitted; IDs, timestamps, scores, states, player records and source statistics are preserved.

Used by parser tests and the isolated built-application browser fixture. They do not replace production sources. Missing statistics stay missing; points per game is calculated from points / games because the captured source reports ppg=0.

`logo-142.png`, `logo-2572.png`, `player-335870.png` and `player-332573.png` are captured ESPN PNGs for those exact identifiers, used only to make browser visual checks independent of external image timing.

`europa-commentary.json` records the 115 available play-by-play entries from ESPN event 401915573 (AZ–Hapoel), captured 2026-10-15 UTC. It retains source team/player spellings and commentary for the reported Chinese-localization regression; unrelated summary fields are omitted.
