# Separate deployment targets

The owner requires GPT Sites and Render to remain independent (2026-09-26).

| Target | Source / runtime | Published origin |
| --- | --- | --- |
| Render | This GitHub repository, Next.js / PostgreSQL, `render.yaml` | https://arena-sports-board.onrender.com |
| GPT Sites | Separate Sites source repository and Cloudflare runtime | https://arena-sports-board.poias45652.chatgpt.site |

Do not synchronize UI changes, account storage, environment variables, or
deployments between these targets without an explicit request. The GPT Maya
theme and MLB-only navigation are not part of this Render fix.

## MLB doubleheader repair

- Display official TBD start times as pending; the second game of a traditional
  doubleheader follows G1. Never present the API placeholder as a confirmed start.
- Keep official confirmed starts, and show a differing paired source time
  separately. Source times never override official game state or prediction gates.
- Match explicit G1/G2 team suffixes using home/away, game number and Taipei date;
  a changed time is accepted only within 12 hours. Unlabelled events retain the
  ten-minute and unique-match safeguards. Ambiguous/duplicate rows are rejected.
- Bind converted markets to the MLB game ID so shared placeholder times cannot
  cross-wire doubleheader legs. Closed primary markets remain closed.
- Allow viewing quotes for scheduled TBD fixtures while leaving predictions and
  selections disabled. Distinguish missing fixture matches from unopened markets.

Validation: 34 focused regression checks passed and the production Next.js build
(including TypeScript) passed. Authenticated live source verification and Render
deployment verification still require the selected Render workspace/session.
