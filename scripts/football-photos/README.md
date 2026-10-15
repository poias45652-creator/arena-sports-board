# Football portraits

The roster uses ESPN player IDs. ESPN's soccer roster responses do not provide
reliable portraits, and constructing a headshot URL from the ID returns 404s.
The server-only catalog maps those identities to verified FotMob transparent PNGs.

`/api/football-player-photo` retains the site's existing API authentication.
It restricts source URLs, rejects non-PNG/error responses, caps download size and
concurrency, and caches successful images and missing results. Live discovery
requires an exact normalized full name and birth date. Reviewed spelling variants
are recorded in the catalog instead of being guessed at request time.

The 2026 snapshot covers all 165 teams in the seven supported competitions:
4,294 distinct roster players, 4,113 verified transparent portraits, and 181
unresolved portraits. Armenia's complete 32-player roster was checked in the
actual desktop and mobile UI. Missing photos retain the existing placeholder;
no generated faces or unrelated player photos are substituted.

## Refresh

Python 3 and Pillow are required. Use a fresh cache directory for a new audit.
The cache contains downloaded public source data and photos; do not commit it.

```sh
python scripts/football-photos/collect.py --cache /tmp/football-photos --season 2026 --phase collect
python scripts/football-photos/collect.py --cache /tmp/football-photos --season 2026 --phase match
python scripts/football-photos/collect.py --cache /tmp/football-photos --season 2026 --phase enrich
python scripts/football-photos/collect.py --cache /tmp/football-photos --season 2026 --phase verify
python scripts/football-photos/collect.py --cache /tmp/football-photos --season 2026 --phase export
```

Review ambiguous identities before adding an override to
`data/football-player-photo-overrides.json`. The verification phase applies those
overrides, checks actual image bytes, dimensions and transparency, and excludes
repeated placeholder images. Failed source downloads are not retried within the
same audit. A fresh audit can retry images that later become available.

Export updates the server catalog and `docs/football-player-photo-audit.json`,
which records coverage per team and every outstanding player ID. Review both
files before deployment. Source data comes from ESPN roster endpoints and
FotMob's public team/player endpoints; portraits retain their original pixels.

## Final reviewed coverage (2026-10-04)

The final audited scope has 4,293 eligible players and 4,293 verified portraits. One erroneous Czechia association is recorded separately from the 4,294 raw identities. See the audit/research reports for all 31 additions, original hashes and source evidence. Three colliding ESPN identities use `football-roster-photo-corrections.json`; these portraits must only be served with the matching team, league and season. Do not promote these corrections to global ID replacements.

## Europa supplement (2026-10-15)

The latest 36-team Europa roster snapshot contains 1,137 distinct players. The
supplement adds 680 portraits, bringing catalog coverage to 1,134 players.
This includes 42 additional manually reviewed original images stored locally;
their provenance and the 3 remaining gaps are recorded in
`docs/football-europa-portrait-gap-review.json`. Three records
remain without a verified available portrait; their IDs and reasons are in
`docs/football-europa-photo-audit.json`. No generated or unrelated faces are used.

The Europa identity and reviewed-source files are additive. Existing identities,
historical coverage reports, context corrections, and roster statistics remain
authoritative. Official club JPEGs are allowed only on reviewed hosts with an
exact SHA-256 match. Reviewed local originals also require a fixed path, matching
MIME type and exact SHA-256; they do not download from a provider at runtime.
The merge script preserves these reviewed originals on refresh. The same profile card and authenticated photo API serve all
competitions.

For a scoped refresh, pass `--league uefa.europa` to each collection phase up to
`verify`. Review non-exact names, birthdays and club memberships before running
`verify-reviewed-europa.py CACHE` and `merge-europa.py CACHE`. The merge command
verifies cached bytes and writes only the Europa supplement and its audit. A
scoped run cannot use the destructive `export` phase. The read-only GitHub
workflow uploads evidence for review and never commits or publishes its results.

Reviewed display framing is in `data/football-europa-photo-framing.json`. These square CSS windows identify the named player in signing or historical youth photographs; source bytes remain unmodified. Names must match before framing is applied.
