import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot} from '../server/regional-basketball/archive.mjs';
import {analysis} from '../public/regional-basketball/analysis-ui.js';
import {quotesFor, marketCards} from '../public/regional-basketball/market-cards.js';
import {settleSportGrid} from '../public/regional-basketball/market-math.mjs';

const date = '2026-11-07';
const catalog = await snapshot('/data/leagues.json');
const context = await snapshot('/data/context.json');
const frozen = await snapshot('/data/pregame.json');
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8);

for (const [league, home, away] of [['NBL','MEL','BRI'], ['KBL','DB','SAM']]) {
  test(league + ' reported fixture renders six priced, correctly oriented options', async t => {
    t.mock.method(Date, 'now', () => Date.parse('2026-11-07T19:00:00+08:00'));
    const original = globalThis.document;
    globalThis.document = {body:{dataset:{viewer:'true'}}};
    t.after(() => original ? globalThis.document = original : delete globalThis.document);
    const info = catalog[league];
    const g = info.games.find(row => row.date === date && row.home === home && row.away === away);
    const market = context.markets.find(row => row.date === date && row.home === home && row.away === away);
    const state = {league, info, context, all:info.games, teamGames:[], boxes:await snapshot('/data/' + league.toLowerCase() + '-boxes.json'),
      saved:{}, frozen:frozen[league], projections:new Map(), version:1, visible:[g], games:[g], legs:new Set()};
    const html = analysis(state);
    assert.equal((html.match(/class="sport-market-option"/g) || []).length, 6);
    assert.equal((html.match(/class="sport-market-outcomes"/g) || []).length, 4);
    assert.equal((html.match(/class="sport-market-win-rate"/g) || []).length, 2);
    const rows = [...html.matchAll(/class="sport-market-outcomes">([\s\S]*?)<\/dl>/g)]
      .map(match => [...match[1].matchAll(/<dd>([\d.]+)%<\/dd>/g)].map(value => Number(value[1])));
    for (const row of rows) {
      assert.ok(Math.abs(row.reduce((a, b) => a + b) - 100) <= 0.11);
      assert.deepEqual(row.slice(1, 3), [0, 0]);
    }
    assert.deepEqual(rows[0], rows[1].toReversed());
    assert.deepEqual(rows[2], rows[3].toReversed());
    assert.ok(html.includes('主讓 ' + market.spread + ' @' + (market.homeSpreadPrice - 1).toFixed(3)));
    assert.ok(html.includes('客受讓 +' + -market.spread + ' @' + (market.awaySpreadPrice - 1).toFixed(3)));
    assert.match(html, /賠率不含本金/);
    if (league === 'KBL') {
      assert.match(html, /歷史回算/);
      assert.doesNotMatch(html, /勝方命中|勝方未命中/);
      const replay = () => marketCards(state, g, {ready:false}, market, quotesFor(market));
      const before = replay();
      state.version++;
      state.all = state.all.map(row => row.date >= date ? {...row, homeScore:1, awayScore:199} : row);
      state.boxes = state.boxes.filter(row => row.date < date);
      assert.equal(replay(), before);
      assert.deepEqual(state.saved, {});
    } else {
      assert.doesNotMatch(html, /歷史回算/);
      assert.match(html, /賽前存檔/);
    }
  });
}

test('whole and split lines grade refunds and mirrored partial results', () => {
  const base = {spread:-2, total:175.25, homeSpreadPrice:1.9, awaySpreadPrice:1.97, overPrice:1.917, underPrice:1.952};
  const [spread,total] = quotesFor(base);
  const result = (q, side, value) => settleSportGrid([{value, p:1}], q, side);
  near(result(spread,'home',2).push, 1);
  near(result(spread,'away',3).loss, 1);
  near(result(total,'under',175).partialWin, 1);
  near(result(total,'over',175).partialLoss, 1);
  const [quarter] = quotesFor({...base,spread:-2.75});
  near(result(quarter,'home',3).partialWin, 1);
  near(result(quarter,'away',3).partialLoss, 1);
  assert.deepEqual(quotesFor({spread:null, total:'175.5', homeMoneyline:2, awayMoneyline:null}), []);
  assert.equal(settleSportGrid([], total, 'over'), null);
});
