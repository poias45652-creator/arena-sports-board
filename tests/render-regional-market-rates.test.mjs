import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot} from '../server/regional-basketball/archive.mjs';
import {analysis, marketFor} from '../public/regional-basketball/analysis-ui.js';
import {marketCards} from '../public/regional-basketball/market-cards.js';
import {settleSportGrid} from '../public/regional-basketball/market-math.mjs';

import {moduleUrl} from './profile-loader.mjs';
const {regionalTzMarkets}=await import(moduleUrl('lib/regional-tz-markets.ts'));
const {parseHrGameDetail}=await import(moduleUrl('lib/hr9988.ts'));
const date = '2026-11-07';
// Synthetic TZ-format quotes on real reported fixtures. Never import third-party archive prices.
function capture(league, time, home, away, handicap='7.5', total='179.5'){
  const seen=new Date(Date.parse(date+'T'+time+':00+08:00')-60000).toISOString();
  const wager=(type,quote)=>({WagerGrpID:10,WagerTypeID:type,Odds:[{GameID:type,Status:1,...quote}]});
  const labels={NBL:'澳洲國家籃球聯賽',KBL:'韓國籃球聯賽'};
  const team={EvtID:123,HomeTeamStr:home+'(主)',AwayTeamStr:away,ScheduleTimeStr:'2026/11/07 '+time+':00',EvtStatus:1,Live:false,Wager:[
    wager(103,{HomeHdp:handicap,HomeHdpOdds:.928,AwayHdpOdds:.915}),wager(104,{OULine:total,OverOdds:.944,UnderOdds:.958}),
    wager(111,{HomeOdds:.6,AwayOdds:1.3})]};
  const raw={code:200,data:[{CatID:102,Items:{List:[{LeagueNameStr:labels[league]||league,Team:[team]}]}}]};
  return parseHrGameDetail(raw,seen);
}
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
    const teamName=code=>info.teams.find(t=>t.code===code).name;
    const [market]=regionalTzMarkets(capture(league,g.time,teamName(home),teamName(away)));
    assert.equal(market.home,home); assert.equal(market.away,away);
    const state = {league, info, context, tzMarkets:[market], all:info.games, teamGames:[], boxes:await snapshot('/data/' + league.toLowerCase() + '-boxes.json'),
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
    assert.match(html,/主讓 -7.5 @0.928/); assert.match(html,/客受讓 \+7.5 @0.915/);
    assert.match(html,/TZ・存檔盤口/);
    const noTz=analysis({...state,tzMarkets:[]});
    assert.doesNotMatch(noTz,/sport-market-option|PandaBet|PinnacleSports/);
    assert.doesNotMatch(html,/模型依據|對手平均淨分|技術統計場數|盤口來源|來源 ↗/);
    for(const card of [html,noTz]){
      assert.doesNotMatch(card,/傷停與出賽狀態|尚無已核實的傷停名單|缺陣與替補調整|確認缺陣|查看本場比分與球員數據|data-open-game/);
    }
    assert.match(html, /賠率不含本金/);
    if (league === 'KBL') {
      assert.match(html, /歷史回算/);
      assert.doesNotMatch(html, /勝方命中|勝方未命中/);
      const replay = () => marketCards(state, g, {ready:false}, market, market.quotes);
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

test('TZ whole, split and percentage lines retain source prices and settlement sides', () => {
  const read=(spread,total)=>regionalTzMarkets(capture('NBL','16:30','Melbourne United','Brisbane Bullets',spread,total))[0].quotes;
  const [spread,total]=read('2','175.25');
  const result=(q,side,value)=>settleSportGrid([{value,p:1}],q,side);
  near(result(spread,'home',2).push,1); near(result(spread,'away',3).loss,1);
  near(result(total,'under',175).partialWin,1);near(result(total,'over',175).partialLoss,1);
  const [quarter,twTotal]=read('2.75','175+75');
  near(result(quarter,'home',3).partialWin,1);near(result(quarter,'away',3).partialLoss,1);
  near(result(twTotal,'over',175).partialWin,1);near(result(twTotal,'under',175).partialLoss,1);
  assert.deepEqual(twTotal.labels,['175+75','175-75']);assert.equal(twTotal.home,.944);
});

test('closed, stale, unconfirmed, crossed and non-TZ quotes never replace the pregame line',t=>{
  const g={date,time:'16:30',home:'MEL',away:'BRI',status:'scheduled'},s={league:'NBL'};
  const snap=capture('NBL','16:30','墨爾本聯','布里斯本子彈');
  const [m]=regionalTzMarkets(snap),seen=Date.parse(snap.fetchedAt),tip=Date.parse(m.startsAt);
  const clock=t.mock.method(Date,'now',()=>seen);
  const pick=(rows,game=g)=>marketFor({...s,tzMarkets:rows},game);
  assert.equal(pick([m]),m);
  assert.equal(pick([m,m]),null);
  for(const changes of [{source:'PandaBet'},{league:'KBL'},{away:'MEL',home:'BRI'},{startsAt:new Date(tip+660000).toISOString()}])
    assert.equal(pick([{...m,...changes}]),null);
  assert.equal(pick([m],{...g,timeConfirmed:false}),null);
  assert.equal(pick([{...m,checkedAt:new Date(seen-151000).toISOString()}]),null);
  const closed=structuredClone(snap);closed.sportGames[0].displayMarkets.forEach(x=>x.quotes.forEach(q=>q.open=false));
  const saved=regionalTzMarkets(closed,[m]);assert.equal(pick(saved),null);
  clock.mock.mockImplementation(()=>tip+1);assert.deepEqual(pick(saved,{...g,status:'final'}).quotes,m.quotes);
  assert.equal(pick([{...m,checkedAt:m.startsAt}]),null);
  for(const label of ['澳洲女子國家籃球聯賽','韓國女子籃球聯賽'])assert.deepEqual(regionalTzMarkets(capture(label,'16:30','MEL','BRI')),[]);
  assert.deepEqual(regionalTzMarkets(capture('KBL','16:30','MEL','BRI')),[]);
});
