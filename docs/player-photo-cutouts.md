# Transparent supplemental player portraits

Updated 2026-10-03 for the YJ and Maya sites.

The 54 NBA and 5 WNBA supplemental photos with opaque backgrounds now use local transparent PNG assets. The existing transparent Elena Buenavida photo remains at its verified source. This change covers basketball supplemental portraits, not the separate baseball photo catalog.

NBA roster cards and player profiles share the same supplemental photo paths. Their error fallback now uses the league's transparent headshot rather than the original opaque supplemental photo. YJ's secondary WNBA roster source also reads the same verified photo catalog as the primary WNBA source. Identity checks continue to require both the league ID and normalized full name. Player data and statistical models are unchanged. Local cutouts use the built-in Next image optimizer at 256 or 640 pixels through responsive `srcSet`; the original transparent PNG is retained, and the responsive sources are cleared before an error fallback.

Assets are stored at `public/images/players/{nba,wnba}/{playerId}-cutout.png`. Original photo attribution remains in `data/nba-player-supplements.json` and `data/wnba-official-photos.json`. `data/player-photo-cutouts.json` records the 59 output paths, SHA-256 hashes and measured transparent fractions so both deployments can be checked against the same files.

The built-in imagegen tool was used separately for each source photo with `transparent_background: true` and the following prompt, substituting the player's name:

> Use case: background-extraction. Edit target: this existing photo of {name}. Remove ONLY the surrounding background and background people. Output a true transparent PNG with original crop. Preserve EXACT facial features, expression, hair, skin texture, clothing, logos, pose and held basketball if any. All white garments stay opaque. Do not redraw, beautify, change identity, add body parts, text or graphics. Fine hair edges, no halo. Website sports roster asset.

Validation: all 59 files have an RGBA alpha channel with transparent background pixels; all outputs were visually reviewed against a dark background. Existing NBA supplemental portrait and WNBA portrait/identity tests passed, and the YJ production build completed successfully.
