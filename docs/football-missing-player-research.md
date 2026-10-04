# Missing football player research, 2026-10-04

All 181 entries in the previous missing-photo audit were searched individually, with additional UEFA searches and club/league profile checks. The first pass added 70 reviewed transparent player photographs and filled missing country/height fields for 21 players. The second pass adds 16 more photographs. Current coverage after the final pass is 4,293 of 4,293 eligible players. The original 4,294-record audit includes one proven erroneous Czechia roster association, retained separately as an exclusion. No eligible audited player remains without a verified photograph.

`football-missing-player-research.json` records each player's search sources, accepted field provenance, original photo URL and byte hash, and unresolved identity conflicts. Search results are leads, not automatically verified facts. The first pass rejected apparently usable portraits belonging to different players (Joao Victor, Matús Minka, Pedrinho). The fifth pass resolves Minka using his correct individual official profile and matching birthday; the earlier mismatched candidates remain rejected. Other conflicting roster records remain unresolved rather than silently reassigned.

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

## Third pass: continued batch update, 2026-10-04

Reviewed the 93 remaining entries and added 27 identity-reviewed photographs, reusing ten completed cutouts from the interrupted previous session. Original sources include club announcements and individual Transfermarkt profiles. Known birthdays were matched exactly; where the catalog birthday is empty, full names and youth-team or loan relationships were checked manually. Original and derivative hashes are kept separately.

ImageGen prompt: remove only the background to real transparent alpha; preserve the exact original face, expression, age, hair, ears, skin texture, clothes, lighting and crop; do not beautify, reconstruct faces, extend bodies or invent missing features. Existing group photographs were restricted to the identified player. Club-photo derivatives use WebP quality 92 with alpha and a maximum size of 600 × 900; the lower-resolution individual portraits use WebP quality 85 and a maximum size of 300 × 450, retaining their original aspect ratio. Every result was compared visually with its original and inspected on a dark background.

Coverage is 4,228 / 4,294; 66 remain unresolved. Djibril Ouziad has a silhouette placeholder; conflicting Thiago Fernández, Javier Guerra, Joao Victor, Pedrinho and Matús Minka identities remain excluded. Léo-Paul Bouyer remains unresolved because the official birthday differs. No roster membership, birthdays, statistics or prediction code changed. The authenticated local photo service and exact SHA-256 verification are unchanged.

Added players: Jacopo Mirra (384831), Maël Gernigon (416401), Mamadou Diallo (3130907), Martin Ponsot (3121791), Michael Mills (418769), Matteo Franceschelli (415168), Iván Alonso Martín (3128651), Marco Libra (410325), Alessandro Sugamele (387844), Víctor Valdepeñas (401558), Antonio Pirrò (422138), Sulayman Jallow (233515), Federico Croci (422953), Adam Žulevič (3118700), Gabriele Casentini (417784), Andrea Ballanti (3131322), Francesco Cereser (413819), Mamadou Koné (416429), Grady Makiobo Makiobo (3121500), William Harhouz (407614), Lukas Klisys (421761), Christian Lupo (422962), Victor Huart (402400), Ricard Fernández (22773), Georgios Sarakasidis (3100717), Alex Cornellà (393731), Mikkel Hansen (399511).

## Fourth pass: official club and federation portraits, 2026-10-04

Added 12 verified photographs: three Slovan players, three Liechtenstein internationals, and one each from Malta, Montenegro, Viking, Milan, Galatasaray and Lecce. Eleven real source photographs had their backgrounds removed; Milan supplied an original transparent PNG. All derivatives retain alpha, use WebP quality 88, and are limited to 600 x 900 pixels (400 x 600 for smaller source portraits). Original and derivative SHA-256 hashes are recorded separately. Every cutout was visually reviewed against its source on a dark background.

The French FA confirms Leo-Paul Bouyer was born on 14 August 2008 and identifies his club as AC Milan, resolving the previously recorded one-day birthday discrepancy. His named Milan roster image is accepted without changing the catalog birthday. Blank catalog birthdays remain blank; those portraits were matched by the named official profile and club or national-team affiliation. Mats Sekse Johannesen is the young player at left in the official signing photograph; only his head and upper chest are retained.

Coverage is now 4,240 / 4,294; 54 remain unresolved. The Archie Howard and Noam Sztejfman pages reviewed in this pass contain placeholders. Individually captioned childhood photos of Jacob Middelthon and Rasmus Gjelsvik Steigen were rejected; the paired adult photo lacks explicit left/right labels. Existing conflicting identities remain excluded. No roster, birthday, statistics, prediction, authentication or photo-serving code changed.

Added players: Matús Tomásko (411858), Alex Veľký (3107814), Adam Canolli (3112253), Bruno Poitner (3097783), Florian Allgäuer (3142030), Alessandro Alfredo Lo Russo (3142031), Jayden Roe (3142163), Danilo Vukanic (403050), Mats Sekse Johannesen (3139065), Léo-Paul Bouyer (403839), Eyüp Karasu (415122), Divine Onyemachi (3123405).

## Fifth pass: official individual profiles and renewal announcements, 2026-10-04

Added 12 verified player photographs: Victor Mullerat, Manel Usedo, Rodrigo Gamon, Nizar El Jmili, Matus Minka, Rayan Ouro Bang Na, Aymen Assab, Henrick Do Marcolino, Idrissa Soukouna, Yacouba Kone, Yvan Zaddy and Lamfia Dioubate. Six are original transparent club portraits, only resized and encoded as WebP. Six real club photographs had their backgrounds removed and were visually compared with their originals on a dark backdrop. Source and derivative SHA-256 hashes are retained separately.

The correct Slovan Matus Minka profile explicitly lists 25 April 2004, exactly matching the existing catalog. Earlier candidates linked to Matus Macik and Matus Tomasko were different people. The now-obsolete test exclusion for Minka is removed; other unresolved mismatched identities remain excluded. Marseille labels Rayan Ouro Bang Na explicitly, and the French FA selection document confirms his catalog birthday. No catalog birthdays or roster identity data were edited.

Coverage is 4,252 / 4,294; 42 remain unresolved. Monza supplies only a club crest for Aleksandr Ballabio, Troyes U19 uses a generic avatar for Lassana Simakha, and the Auxerre Salimou Danfakha profile has no portrait. None was counted as completed. All accepted local WebP assets retain alpha and remain pinned to exact hashes.

Added players: Víctor Mullerat Tomas (3139134), Manel Usedo Domingo (3129042), Rodrigo Gamón Martín (3124770), Nizar El Jmili Ben Hamou (3101324), Matús Minka (405608), Rayan Bang Na (414467), Aymen Assab (3124793), Henrick Do Marcolino (398977), Idrissa Soukouna (3131916), Yacouba Kone (3129214), Yvan Zaddy (414184), Lamfia Dioubaté (416458).

## Sixth pass: Norwegian announcements and individual profiles, 2026-10-04

Added seven verified portraits: Milton Kald, Anders Fiskum Larsen, Jonathan Roksund Debes, Christopher Salvesen-Svenning, Kelvin Frimpong, Ari Petersen and Marcelo Vaz. Genoa supplies an original transparent portrait for Vaz. The other six are background extractions from individually named real photographs, with the original appearance compared visually on a dark background. Full-frame Frimpong and Salvesen-Svenning images avoid head clipping in their social previews. Signing officials and handshakes are excluded.

Ari Petersen uses the KI-credited November 2023 signing photograph published by Roysni, when he was 20. The current IBV announcement corroborates his club history, and UEFA press-kit search results give the catalog birthday, 7 December 2002. All other accepted catalog birthdays are blank and remain unchanged. No roster identities, birthdays, live statistics or runtime photo logic were edited.

Coverage is 4,259 / 4,294; 35 remain unresolved. TFF, FSGC and La Preferente placeholders are rejected. The checked Sabah rosters do not identify Muxtarov, the Bugli profile lacks a usable portrait, the Teo Ingilae group photograph remains ambiguous, and the inaccessible FPF Da Silva profile is not counted as verified. Original and served-asset SHA-256 hashes remain recorded separately.

Added players: Milton Käld (3133981), Anders Fiskum Larsen (3139066), Jonathan Røksund Debes (3139067), Christopher Salvesen-Svenning (3139068), Kelvin Frimpong (420707), Ari Petersen (363365), Marcelo Vaz (3098553).

## Seventh pass: individual profiles and complete photographs, 2026-10-04

Added Noam Sztejfman (Maccabi Haifa official transparent portrait), Sondre Bakken (Viking official signing announcement) and Argyris Argyriou (named AEK number 76 photograph in the Soccer Academies individual feature). The latter two use background extraction from the verified real photographs, with their original appearance compared visually. The complete Argyriou photograph avoids the head clipping in an earlier interview image. Individual source links and original/served SHA-256 hashes are retained.

The official Haifa profile associates the Hebrew and English names, jersey number, birth date and photo. The Metrosport interview and transfer report corroborate Argyriou's identity and club history. All three catalog birthdays were blank and remain unchanged. No roster identities, live statistics or runtime photo logic were edited.

Coverage is 4,262 / 4,294; 32 remain unresolved. AS roster placeholders for Enzo Monchatre and Zois Karargyris are rejected. The captioned Viking annual-report team image is too small for a suitable individual portrait.

Added players: Noam Sztejfman (3102740), Sondre Bakken (3139069), Argyris Argyriou (3137951).

## Final pass: complete audited coverage, 2026-10-04

Added 31 portraits in one batch: four existing transparent originals and 27 background extractions from real photographs. All were compared with their originals; original and served hashes and identity evidence are recorded in the JSON report. Small 150-pixel provider portraits and captioned team-photo extracts remain small rather than being presented as high-resolution originals. Photograph dates vary; kits can reflect earlier clubs. Nicholas Protti source credit: FSGC.

Official team/season evidence resolves three ESPN identity collisions: Levante number 24 is the Argentine Thiago Fernandez (2004-04-03), Valencia number 8 is Javi Guerra (2003-05-13), and Fiorentina number 17 is Joao Mario Neto Lopes (2000-01-03). Corrections require the exact team, league, 2026 season, jersey and original name/birthday fingerprint. Photos require that same team/season context before cache lookup. Global catalog identities and unrelated seasons/teams are not rewritten.

The exact David Winters/Scotland record incorrectly attached to Czechia 2026 is excluded from that roster only, with its source record and evidence retained. This is one data exclusion, not a newly found photo. Raw audited identities: 4,294; eligible: 4,293; verified photos: 4,293; eligible missing: 0.

| Player | Source |
|---|---|
| Archie Howard (414372) | [Named source](https://www.playmakerstats.com/player/archie-howard/1055896) |
| Marc Santos Gavilán (3129043) | [Named source](https://www.playmakerstats.com/player/marc-santos/2940953) |
| Álvaro De Pablo (394885) | [Named source](https://www.realbetisbalompie.es/noticias/Cantera/el-betis-deportivo-refuerza-su-porteria-con-alvaro-de-pablo-32601) |
| Salimou Danfakha (3131801) | [Named source](https://www.instagram.com/p/DZ9vkNAhZsd/) |
| Enzo Monchatre (3121265) | [Named source](https://www.instagram.com/p/DOTiDKXDR2v/) |
| Matthias Da Silva (403421) | [Named source](https://www.worldfootball.net/person/pe935063/matthias-da-silva/) |
| Aymen Ammaouch (422969) | [Named source](https://www.toulousefc.com/play/blog/2026/06/le-tefece-officialise-le-premier-contrat-professionnel-d-aymen-amaaouch) |
| Teo Ingilæ (383359) | [Named source](https://www.glimt.no/nyheter/stortalentet-teo-klar-for-glimt-akademiet) |
| Cəfər Muxtarov (3098819) | [Named source](https://www.instagram.com/p/DX4Tyl0DUgp/) |
| Pedrinho (313078) | [Named source](https://shakhtar.com/en/news/2023/july/19_news/19_pedrinho-is-shakhtar-player/) |
| Sondre Tveiten (3139064) | [Named source](https://www.facebook.com/groups/310830392403504/posts/3241009369385577/) |
| Rasmus Gjelsvik Steigen (3139070) | [Named source](https://www.vardeneset-bk.no/vbk-gutt-skrev-proffkontrakt-med-viking/) |
| Aleksandr Ballabio (3131891) | [Named source](https://www.sofascore.com/football/player/aleksandr-ballabio/2035776) |
| Jesper Rabben Nygård (3133980) | [Named source](https://www.sofascore.com/football/player/jesper-rabben-nygard/2342727) |
| Henrik Kvelvane (3139072) | [Named source](https://www.sofascore.com/football/player/henrik-kvelvane/2535113) |
| Arda Tagay (3102518) | [Named source](https://www.sofascore.com/football/player/arda-tagay/2270424) |
| Matias Bobo Høgsæt Jaiteh (3133984) | [Named source](https://www.sofascore.com/football/player/matias-hogsaet-jaiteh/2268932) |
| João Mário (139008) | [Named source](https://www.acffiorentina.com/fiorentina-prima-squadra-maschile) |
| Jayvan Orlando Garro (3096980) | [Named source](https://sportsfocus.gi/football/jayvan-garro-called-up-to-gibraltar-squad/) |
| Giulio Bugli (410143) | [Named source](https://www.sanmarinoacademy.sm/under-22-nel-mirino-la-juvenes-dogana-bugli-risultati-arriveranno-continuiamo-con-il-nostro-percorso/) |
| Cristian Meloni (410366) | [Named source](https://www.sanmarinortv.sm/sport/calcio-sammarinese-c15/under-17-bonesso-ottima-prestazione-meloni-giocato-un-bel-secondo-tempo-a266934) |
| Nicholas Protti (410149) | [Named source](https://giornalesm.com/san-marino-academy-under-22-al-rientro-ce-il-domagnano-protti-replicare-coraggio-e-approccio-dellultima-volta/) |
| Lassana Simakha (3140905) | [Named source](https://www.facebook.com/100036848395709/posts/-%F0%9D%97%9F%F0%9D%97%94%F0%9D%97%A6%F0%9D%97%A6%F0%9D%97%94%F0%9D%97%A1%F0%9D%97%94-%F0%9D%97%A6%F0%9D%97%9C%F0%9D%97%A0%F0%9D%97%94%F0%9D%97%9E%F0%9D%97%9B%F0%9D%97%94-%F0%9D%97%96%F0%9D%97%9C%F0%9D%97%95%F0%9D%97%9F%F0%9D%97%98%CC%81-%F0%9D%97%98%F0%9D%97%A1-%F0%9D%97%95%F0%9D%97%A8%F0%9D%97%A1%F0%9D%97%97%F0%9D%97%98%F0%9D%97%A6%F0%9D%97%9F%F0%9D%97%9C%F0%9D%97%9A%F0%9D%97%94-il-pourrait-quitter-troyes-avant-m%C3%AAme-dy-s/1687514729153457/) |
| Pietro Marinucci (421093) | [Named source](https://www.sanmarinortv.sm/sport/calcio-sammarinese-c15/u21-marinucci-e-pierini-all-esordio-questa-maglia-ha-un-peso-diverso-a288339) |
| Thiago Fernández (339195) | [Named source](https://www.levanteud.com/noticias/thiago-fernandez-se-convierte-en-jugador-del-levante-ud) |
| Elias Dahman (3139071) | [Named source](https://www.aftenbladet.no/sport/i/W0am1k/stor-presentasjon-dette-er-viking-talentene-som-jakter-paa-cupgull) |
| Jacob Middelthon (423020) | [Named source](https://www.aftenbladet.no/sport/i/W0am1k/stor-presentasjon-dette-er-viking-talentene-som-jakter-paa-cupgull) |
| Hugo Pérez Sañudo (3100788) | [Named source](https://universaltt.com/hugo-perez-sanudo/) |
| Djibril Ouziad (3132216) | [Named source](https://www.playmakerstats.com/player/djibril-ouziad/2749393) |
| Zois Karargyris (411005) | [Named source](https://www.sofascore.com/football/player/zois-karargyris/1587245) |
| Javi Guerra (16340) | [Named source](https://www.laliga.com/jugador/javier-guerra) |

Public provenance records omit expiring CDN signatures and access parameters. Original byte hashes and stable public source pages remain available; locally served image bytes are unchanged.
