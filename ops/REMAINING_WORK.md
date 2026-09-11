# Verified progress and remaining dependencies

Updated 2026-09-10. This file describes unfinished work; it is not a completion report.

- Primary Super007 full-game spread/total supports fractional, split and integer/half lines. Official examples are regression-tested.
- Analysis snapshots now save Super007 net prices, source timestamps, raw labels and fractional settlement fields, version pregame-super007-v2.
- Outcome ledger evaluates the latest pregame model direction per market at one unit, not a user's placed bet. Legacy Pinnacle snapshots are excluded from this ledger. Shortened/cancelled and exceptional games remain pending.
- Source failures and per-market unsupported/closed/ambiguous conditions now have separate messages. There is no automatic credential renewal or safe site-admin reconnect form yet.
- The native Sites connection can publish Arena, but this session has no Cloudflare account management connector. The standalone collector's cron needs authorized account management access. Do not claim the local user's Wrangler login is available here.
- Arena refreshes on requests. The operations panel only observes the collector; it does not start a scheduler. Hourly assistant monitoring is not minute-level collection. Do not switch Arena back to collector-only mode without proving it fresh.
- Verify collector run origin (cron vs manual), KV daily write quota, and both leading/trailing gaps before a 24-hour pass. Existing health counters do not distinguish manual runs. A real elapsed 24-hour observation is still required.
- Advanced inputs and a 2023/2024/2025 candidate-model study already exist. Historical point-in-time advanced inputs and bookmaker prices are still insufficient to validate advanced effects or betting ROI. Do not silently deploy the research candidate or invent ROI.
- Period markets, live markets, one-loss/two-win, first/last score and other special markets need their own verified source IDs, score intervals and settlement rules; do not apply the full-game model to them.
- A private authenticated recommendation journal with immutable user selections remains separate work. Do not describe the public model-direction ledger as personal bet history.
