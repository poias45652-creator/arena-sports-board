import {analyzeGame, verifiedGameBox} from '../../public/regional-basketball/model.mjs';
import {snapshot} from './archive.mjs';
import {getKblFeed, getKblHistory, getKblBox} from './kbl.mjs';
import {getNblFeed, getNblHistory, getNblBox} from './nbl.mjs';
import {fetchNblInjuries} from './injury-feed.mjs';

const dayMs = 86400000;
const dayAt = ms => new Date(ms + 8 * 3600000).toISOString().slice(0, 10);
const fixture = g => [g.date, g.time, g.home, g.away].join('/');
const starts = g => Date.parse(g.date + 'T' + g.time + ':00+08:00');
const upcoming = g => ['scheduled','fixture'].includes(g.status) && g.timeConfirmed !== false && starts(g) > Date.now();
const sources = {
  KBL:{feed:getKblFeed, history:getKblHistory, box:getKblBox},
  NBL:{feed:getNblFeed, history:getNblHistory, box:getNblBox},
};

// Use the same league model and verified box-score rules as the match card.
// Fetch only the recent boxes needed by the teams for the next three Taiwan calendar dates.
export async function captureLeague(league, save, source = sources[league]) {
  const now = Date.now(), day = dayAt(now);
  const feeds = await Promise.all([0, 1, 2].map(offset => source.feed(dayAt(now + offset * dayMs))));
  const targets = feeds.flatMap(f => f.games).filter(upcoming);
  const result = {league, eligible:targets.length, written:0, missing:[]};
  if (!targets.length) return result;

  const prefix = '/data/' + league.toLowerCase();
  const [recent, seedBoxes, roster, context, injuries] = await Promise.all([
    source.history(dayAt(now - 100 * dayMs), day), snapshot(prefix + '-boxes.json'),
    snapshot(prefix + '-players.json'), snapshot('/data/context.json'),
    league === 'NBL' ? fetchNblInjuries().catch(() => []) : [],
  ]);
  const history = (recent.games ?? recent).filter(g => g.status === 'final' && g.phase !== 1)
    .sort((a, b) => starts(b) - starts(a));
  const known = new Map(seedBoxes.map(b => [fixture(b), b]));
  const needed = new Map();
  for (const team of new Set(targets.flatMap(g => [g.home, g.away]))) {
    for (const g of history.filter(g => g.home === team || g.away === team).slice(0, 20)) {
      const existing = known.get(fixture(g));
      if (!verifiedGameBox(g, existing))
        needed.set(fixture(g), g);
    }
  }
  const pending = [...needed.values()];
  for (let i = 0; i < pending.length; i += 5) {
    await Promise.all(pending.slice(i, i + 5).map(async g => {
      const box = await source.box(g.officialId || g.id).catch(() => null);
      if (verifiedGameBox(g, box)) known.set(fixture(g), box);
    }));
  }
  const boxes = [...known.values()];
  const reports = [...context.injuries.map(i => ({...i, checkedAt:context.checkedAt})), ...injuries];
  for (const g of targets.filter(upcoming)) {
    const report = analyzeGame({game:{...g, league}, games:history, gamesAsOf:recent.asOf || new Date().toISOString(),
      boxes, rosters:roster.teams, injuries:reports, asOf:Date.now()});
    if (!report.ready) result.missing.push({game:g.id, reason:report.reason});
    else if (await save(league, g, report)) result.written++;
  }
  return result;
}
