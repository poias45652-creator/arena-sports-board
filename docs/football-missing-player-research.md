# Missing football player research, 2026-10-04

All 181 entries in the previous missing-photo audit were searched individually, with additional UEFA searches and club/league profile checks. The first pass added 70 reviewed transparent player photographs and filled missing country/height fields for 21 players. The second pass adds 16 more photographs. Current coverage is 4,199 of 4,294 players; 95 still lack a verified transparent photograph.

`football-missing-player-research.json` records each player's search sources, accepted field provenance, original photo URL and byte hash, and unresolved identity conflicts. Search results are leads, not automatically verified facts. Three apparently usable portraits were rejected because their dates of birth belonged to different players (Joao Victor, Matús Minka, Pedrinho). Other conflicting roster records remain unresolved rather than silently reassigned.

Original PNG/WebP sources and exact SHA-256 checksums are pinned in `data/football-reviewed-photo-sources.json`. The existing authenticated photo service downloads and caches their unmodified bytes with the correct MIME type. Requests use only reviewed HTTPS hosts, bounded downloads and the existing queue/cache limits. A changed source image is rejected until reviewed. Every accepted image was inspected for a real player and transparent background. Shirt-only placeholders are excluded. Full-body official portraits remain intact.

`data/football-player-supplements.json` is a separate reviewed layer, so rebuilding the FotMob catalog cannot erase these findings. Roster parsing applies it only to the matching player ID/name and a compatible birthday, and only fills missing basic fields. Live statistics and competition-season data are never replaced by youth, career or another competition's statistics.

To refresh an entry, recheck identity against its official profile, verify the original photo is a real transparent PNG/WebP, update the URL/hash and provenance together, then rerun `tests/football-player-photos.test.mjs`. Do not mark an unverified search result as completed.

## Second pass, 2026-10-04

Checked additional official pages for 51 unresolved players. Added 16 original transparent portraits after matching the player/club identity, inspecting the images on a dark background, and verifying actual PNG/WebP bytes and SHA-256. Cumulative additions: 86; coverage: 4,199 of 4,294 players; 95 remain unresolved. No roster membership, birthdays, statistics or prediction formulas were changed.

Sources include official Leeds, Newcastle, Sevilla, Osasuna, Valencia, Slavia Prague, Real Sociedad, Union Berlin, Bodo/Glimt and Malaga pages, plus LALIGA. The existing authenticated, bounded photo service and exact content hashes remain in use. New reviewed hosts are explicitly listed; redirects and changed bytes remain rejected.

Rejected examples are retained in the per-player secondPass records: Aymen Amaaouch is a shirt placeholder; Balog, Tomanek and Ouziad are opaque originals; the Jesper Rabben Nygard page points to a Johannes Linaker filename; Bouyer has a one-day birthday conflict and an oversized original. These are not counted as completed.

## Individual update: Dávid Balog, 2026-10-04

Added only player 408480 in this update, following the request to process photos one at a time. The official Slovan profile matches his full name, goalkeeper position and birthday (2007-04-04). The earlier opaque original was processed separately with ImageGen to remove the white background and visually checked against the original and a dark backdrop. The website asset is a transparent 600 × 900 lossless WebP at `public/images/players/football/408480-cutout.webp`. Original attribution and source SHA-256 remain in the research record; the served derivative has its own pinned SHA-256. The authenticated photo service serves this exact local asset and continues to reject changed bytes.

The edit prompt requested removal of only the white background, preservation of facial features, hair, clothing, logos, pose and original 2:3 crop, and no retouching or added elements. The generated PNG was encoded as a 600 × 900 lossless WebP for the website.

Cumulative reviewed additions: 87; coverage: 4,200 of 4,294 players; 94 remain unresolved. No roster membership, birthdays, statistics or prediction formulas changed.

## Individual update: Róbert Tománek, 2026-10-04

Added only player 3107812 after the preceding Balog update was live on both sites. The official Slovan defender profile and its named portrait match his full name and club. The official birthday is 2006-06-22; the catalog had no birthday, and no player data was changed. The original white-background portrait was processed with ImageGen and visually checked against the original and a dark backdrop. The prompt requested background removal only, preserving the existing face, expression, hair, shirt details, logos, pose and original 2:3 crop.

The transparent 600 × 900 lossless WebP is stored at `public/images/players/football/3107812-cutout.webp` and uses the existing exact-hash local photo service. Source attribution, original SHA-256 and derivative SHA-256 are recorded separately. Cumulative reviewed additions: 88; coverage: 4,201 of 4,294 players; 93 remain unresolved.
