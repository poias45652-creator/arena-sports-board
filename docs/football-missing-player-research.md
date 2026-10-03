# Missing football player research, 2026-10-03

All 181 entries in the previous missing-photo audit were searched individually, with additional UEFA searches and club/league profile checks. This pass adds 70 reviewed transparent player photographs and fills missing country/height fields for 21 players. Coverage is now 4,183 of 4,294 players; 111 still lack a verified transparent photograph.

`football-missing-player-research.json` records each player's search sources, accepted field provenance, original photo URL and byte hash, and unresolved identity conflicts. Search results are leads, not automatically verified facts. Three apparently usable portraits were rejected because their dates of birth belonged to different players (Joao Victor, Matús Minka, Pedrinho). Other conflicting roster records remain unresolved rather than silently reassigned.

Original PNG/WebP sources and exact SHA-256 checksums are pinned in `data/football-reviewed-photo-sources.json`. The existing authenticated photo service downloads and caches their unmodified bytes with the correct MIME type. Requests use only reviewed HTTPS hosts, bounded downloads and the existing queue/cache limits. A changed source image is rejected until reviewed. Every accepted image was inspected for a real player and transparent background. Shirt-only placeholders are excluded. Full-body official portraits remain intact.

`data/football-player-supplements.json` is a separate reviewed layer, so rebuilding the FotMob catalog cannot erase these findings. Roster parsing applies it only to the matching player ID/name and a compatible birthday, and only fills missing basic fields. Live statistics and competition-season data are never replaced by youth, career or another competition's statistics.

To refresh an entry, recheck identity against its official profile, verify the original photo is a real transparent PNG/WebP, update the URL/hash and provenance together, then rerun `tests/football-player-photos.test.mjs`. Do not mark an unverified search result as completed.
