// Replay the frozen v4 score model without its deployment-date gate. Results are
// admitted by UTC day, strictly before the simulated one-hour pre-match cutoff.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { moduleUrl } from '../tests/profile-loader.mjs';

const { FootballElo } = await import(moduleUrl('lib/football-xg-features.ts'));
const { marketFootballFeatures, marketFootballRates, marketFootballDistribution } = await import(moduleUrl('lib/football-market-core.ts'));
const { recentOpponents, formAdvantage } = await import(moduleUrl('lib/recent-opponents.ts'));
// Ratings are expressed in goals. Update both teams against the pre-match expectation.
class FootballMarginForm {
  clubs = new Map();
  homeEdge = 0;
  venueGames = 0;

  strength(team, at) {
    const last = this.clubs.get(team);
    return last ? last.strength * 0.5 ** (Math.max(0, at - last.at) / (180 * 86400000)) : 0;
  }

  expected(home, away, neutral, at) {
    return this.strength(home, at) - this.strength(away, at) + (neutral ? 0 : this.homeEdge);
  }

  observe(home, away, neutral, at, margin) {
    const residual = margin - this.expected(home, away, neutral, at);
    const step = 0.08 * Math.max(-3, Math.min(3, residual));
    this.clubs.set(home, { strength: this.strength(home, at) + step, at });
    this.clubs.set(away, { strength: this.strength(away, at) - step, at });
    if (!neutral) this.homeEdge += (margin - this.homeEdge) / Math.min(200, ++this.venueGames);
  }
}
const input = JSON.parse(readFileSync('data/football/market-history-20260928.json'));
const runtime = JSON.parse(readFileSync('data/football/market-calibration-runtime.json'));
const samples = [];
for (const [league, entry] of Object.entries(runtime.leagues)) {
  let history = [], results = [], position = 0;
  const elo = new FootballElo(), margin = new FootballMarginForm();
  const games = input.games.filter(r => r[1] === league).map(([id, league, start, h, a, homeScore, awayScore, neutral]) => ({
    id: String(id), league, start, at: Date.parse(start), home: { id: String(h) }, away: { id: String(a) },
    homeScore, awayScore, neutral: !!neutral, state: 'final', statusName: 'STATUS_FULL_TIME'
  })).sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
  for (const g of games) {
    const now = g.at - 3600000, before = Math.floor(now / 86400000) * 86400000;
    while (position < games.length && games[position].at < before) {
      const past = games[position++], home = past.home.id, away = past.away.id;
      elo.update({ ...past, homeId: home, awayId: away, homeGoals: past.homeScore, awayGoals: past.awayScore });
      margin.observe(home, away, past.neutral, past.at, past.homeScore - past.awayScore);
      history.push(past);
      results.push({ id: past.id, at: past.at, home, away, homeScore: past.homeScore, awayScore: past.awayScore });
    }
    if (g.start < '2014') continue;
    history = history.filter(r => r.at >= before - 365 * 86400000);
    results = results.filter(r => r.at >= before - 365 * 86400000);
    const home = g.home.id, away = g.away.id, target = { ...g, start: new Date(now).toISOString() };
    const difference = elo.difference({ ...g, homeId: home, awayId: away });
    const f = marketFootballFeatures(target, history, difference, entry.parameters, before);
    if (!f.enough) continue;
    const baseline = marketFootballFeatures(target, history, difference, { decayDays: 90, venueWeight: 0.6 }, before);
    const grid = marketFootballDistribution(marketFootballRates(f.values, baseline.baseline, entry.parameters));
    const form = formAdvantage(recentOpponents(results, home, away, now, 100));
    const residual = margin.expected(home, away, g.neutral, now) - (grid.expected.home - grid.expected.away);
    const old = [0,0,0], v1 = [0,0,0], over = [0,0,0], btts = [0,0,0];
    let v1Over = 0, v1Btts = 0;
    for (const s of grid.scoreDistribution.scores) {
      const k = s.home > s.away ? 0 : s.home === s.away ? 1 : 2;
      const p = s.probability, q = p * Math.exp(.16 * form * (s.home - s.away));
      old[k] += p; v1[k] += q;
      if (s.home + s.away > 2) { over[k] += p; v1Over += q; }
      if (s.home && s.away) { btts[k] += p; v1Btts += q; }
    }
    const total = v1.reduce((a,b) => a+b, 0);
    samples.push({ id:g.id, league, start:g.start, homeScore:g.homeScore, awayScore:g.awayScore, neutral:g.neutral, form, residual,
      old, over, btts, v1:v1.map(x=>x/total), v1Over:v1Over/total, v1Btts:v1Btts/total });
  }
}
mkdirSync('.football-research', {recursive: true});
writeFileSync('.football-research/context-features.json', JSON.stringify(samples));
console.log(samples.length, 'eligible fixtures');
