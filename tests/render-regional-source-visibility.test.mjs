import test from 'node:test';
import assert from 'node:assert/strict';
import {snapshot} from '../server/regional-basketball/archive.mjs';
import {playerProfile, teamProfile, standings} from '../public/regional-basketball/profiles.js';
import {liveCenter} from '../public/regional-basketball/live-ui.js';

function checkView(html, context) {
  const citation = html.match(/來源|出處|球隊官網|官方比賽紀錄|官方箱分|球員官方頁|AiScore|Eurobasket|RealGM|href="(?:https?:)?\/\//i);
  assert.equal(citation?.[0], undefined, context + ' 顯示出處 ' + citation?.[0]);
}

for (const league of ['NBL', 'KBL']) {
  test(league + ' hides citations across player tabs, team profiles, standings and scores', async () => {
    const key = league.toLowerCase();
    const info = (await snapshot('/data/leagues.json'))[league];
    const get = name => snapshot('/data/' + key + '-' + name + '.json');
    const [roster, extras, peopleIndex, detailIndex] = await Promise.all(['players','extra-players','index','detail-index'].map(get));
    const state = {
      league, info, rosters:roster.teams, extras:extras.teams, rostersLoaded:true, peopleIndex, detailIndex,
      all:info.games, seasonEnd:2027, rankSeason:2027, phase:2, ranking:info.standings, boxSide:'away',
    };
    checkView(standings(state), league + ' standings');
    const checked = new Set();
    for (const team of info.teams) {
      const teamState = {...state, teamCode:team.code};
      checkView(teamProfile(teamState), team.code);
      const people = [...roster.teams[team.code], ...(extras.teams[team.code] || [])];
      for (const p of people) {
        checked.add(String(p.id));
        const file = await snapshot('/data/profiles/' + key + '/' + p.id + '.json');
        for (const playerTab of ['overview','history','games']) {
          const html = playerProfile({...teamState, playerId:String(p.id), playerFiles:{[p.id]:file}, playerTab});
          checkView(html, [league,team.code,p.id,playerTab].join('/'));
          assert.ok(html.includes('data-backroster'));
          if (p.name === 'Jett Hickson' && playerTab === 'overview') {
            for (const value of ['193 公分','Penrith Panthers','澳洲']) assert.ok(html.includes(value), value);
            assert.ok(!html.includes('2026 年 NBL1 登錄'));
          }
        }
      }
    }
    assert.deepEqual(checked, new Set(Object.keys(peopleIndex)));
    for (const game of Object.values(detailIndex)) {
      const html = liveCenter({...state, game, visible:[game]});
      checkView(html, game.id);
      assert.ok(html.includes('data-roster='));
    }
  });
}
