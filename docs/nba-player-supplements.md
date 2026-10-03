# Verified basketball player display supplements

Verified on 2026-10-03. Audited 620 active NBA and 223 active WNBA players, downloading and inspecting the actual returned image bytes. Domestic research included Yahoo Taiwan and UDN NBA rosters; stored evidence uses identity-matched NBA, WNBA, national federation and university sources. Every NBA supplement includes exact sources and a verification date. WNBA source links are in the photo/bio maps.

## Scope

- NBA: 80 sourced player records, including 48 explicitly labeled 2025–26 NCAA season averages (44 added after the initial four Celtics records).
- Replaced 50 additional successful-but-gray NBA headshots, using 24 official NBA draft portraits and 26 university portraits. The original four locally stored Celtics portraits remain.
- Filled verified missing NBA bio fields for 14 additional players; current league measurements always take precedence. Historical college weights for Tolu Smith and Chris Youngblood are used only while NBA weight is absent.
- WNBA: replaced all three additional gray headshots: Elena Buenavida (Valencia Basket), Morgan Maly (Creighton), Aminata Gueye (French Basketball Federation). Gueye's JPEG is extracted unmodified from page 23 of the FFBB May 2025 player guide; the page explicitly binds the portrait to her full name and July 10, 2002 birth date. The extracted original is served locally.
- WNBA: Tonie Morgan's missing height comes from the official 2026 draft profile; Te-Hina Paopao and Saylor Poffenbarger's basketball country comes from their USA Basketball national team profiles. Do not import historical youth/college weights into the WNBA directory.

## Identity and precedence

Supplements match both league player ID and normalized full name. Do not join by team, similar surname or position. NBA/WNBA current bio fields take precedence. Dash placeholders count as missing. Verified photos replace known successful gray placeholders, since an image onError handler cannot detect them. The shared roster and NBA player detail page retain a bounded single fallback; a failed fallback is hidden.

NCAA statistics never overwrite NBA/WNBA averages, game logs, roster membership, experience or model inputs. The NBA profile displays a college summary only when all three official NBA averages are unavailable; a reported zero remains NBA data. College season, league and school are labeled. Null statistics display an em dash. Photo-only records never fabricate season performance. Bruce Thornton's two-season/career summary is intentionally not converted into single-season averages.

## Remaining unverified gaps

- Phillip Wheeler (1630762): NBA latest headshots and the legacy official endpoint still return silhouettes; archived and G League candidates were unavailable or blocked. ESPN's identity-matched NBA image was absent. Keep the official image until a verified portrait is obtainable.
- Country not yet independently verified: Rashaun Agee, Carson Cooper, Wyatt Fricks, Andrew Holifield, William Kyle. US hometowns are not citizenship evidence.
- Missing WNBA weights remain missing when no current authoritative measurement is available.

Machine-readable counts and unresolved IDs are in `data/player-supplement-audit.json`. These are dated audit results, not a claim that upstream completeness will remain unchanged.

## Validation

Tests cover ID/name mismatches, league/season isolation, current bio and statistics precedence, missing upstream indices, NCAA labels, zero versus unavailable averages, school dash placeholders, unknown nationality and multi-season rejection. All external replacement photos were fetched and decoded; contact sheets were visually inspected. Local Chromium renders use the actual shared roster JSX and NBA summary with verified downloaded originals: all nine representative NBA/WNBA portraits load, one-step fallback is bounded, null assists show an em dash, and no horizontal overflow occurs at 390 px or 1280 px. Prediction engine regression tests and scoped TypeScript checks also pass. Local rendering does not substitute for a signed-in production API check.
