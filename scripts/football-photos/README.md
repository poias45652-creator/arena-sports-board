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
