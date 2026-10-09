import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {moduleUrl} from './profile-loader.mjs';
const m=await import(moduleUrl('lib/sport-super-markets.ts'));
const {WNBA_TEAMS}=await import(moduleUrl('lib/wnba.ts'));
// Matchup metadata observed in production at this timestamp. Prices below are
// synthetic test inputs, never captured odds or user recommendations.
const at='2026-10-09T14:28:46.339Z',now=Date.parse(at);
const fixtures=[
 {id:25080799,home:'紐約自由人',away:'亞特蘭大夢想',time:'07:30:00'},
 {id:25080800,home:'拉斯維加斯王牌',away:'金州女武神',time:'09:30:00'}
];
const quote={primary:true,open:true,homeLine:'4.5',awayLine:'',total:'166.5',homePrice:.9,awayPrice:.95,over:.9,under:.95};
const source=()=>({source:'test-only',fetchedAt:at,sportGames:fixtures.map(r=>({id:r.id,league:'WNBA',home:r.home+'(女)(主)',away:r.away+'(女)',start:'2026/10/10 '+r.time,live:false,displayMarkets:[103,104,111].map(type=>({period:'full',type,quotes:[{...quote}]}))}))});
const game=r=>({id:String(r.id),state:'scheduled',timeConfirmed:true,start:'2026-10-10T'+r.time+'+08:00',home:{name:r.home},away:{name:r.away}});
test('both production WNBA matchup names expose all three available full-game markets',()=>{
 for(const row of fixtures){const s=m.sportMarketStatus(source(),game(row),'WNBA',now);assert.equal(s.event?.id,row.id);assert.equal(s.availableCount,3);}
});
test('the female suffix is accepted only for known WNBA identities in the WNBA namespace',()=>{
 for(const team of WNBA_TEAMS){
  assert.equal(m.sportTeamKey(team.name+'（女）（主）','WNBA'),team.name);
  for(const sport of ['NBA','FOOTBALL',undefined])assert.notEqual(m.sportTeamKey(team.name+'(女)',sport),m.sportTeamKey(team.name,sport));
  for(const suffix of ['U21','二隊','(女)(女)'])assert.notEqual(m.sportTeamKey(team.name+suffix,'WNBA'),team.name);
 }
 assert.equal(m.sportTeamKey('未知球隊(女)','WNBA'),'未知球隊(女)');
 assert.equal(new Set(WNBA_TEAMS.map(t=>m.sportTeamKey(t.name+'(女)','WNBA'))).size,WNBA_TEAMS.length);
});
test('the WNBA fix preserves source freshness, time, league, orientation and duplicate checks',()=>{
 const s=source(),g=game(fixtures[1]);
 assert.equal(m.matchSportEvent(s,g,'WNBA',now+150000),null);
 for(const patch of [{state:'live'},{timeConfirmed:false},{start:'2026-10-11T09:30:00+08:00'},{home:g.away,away:g.home},{away:{name:'紐約自由人'}}])assert.equal(m.matchSportEvent(s,{...g,...patch},'WNBA',now),null);
 assert.equal(m.matchSportEvent(s,g,'NBA',now),null);
 assert.equal(m.matchSportEvent({...s,sportGames:[...s.sportGames,s.sportGames[1]]},g,'WNBA',now),null);
 s.sportGames[1].displayMarkets[0].quotes[0].open=false;
 const status=m.sportMarketStatus(s,g,'WNBA',now);assert.equal(status.markets.spread.code,'closed');assert.equal(status.availableCount,2);
});
test('the actual WNBA analysis panel renders market outcomes even when availability is unconfirmed',()=>{
 const code=ts.transpileModule(readFileSync('app/sport-markets.tsx','utf8'),{fileName:'markets.tsx',compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const C=new Function('require','exports','React',code+';return exports.default;')(key=>{assert.equal(key,'@/lib/sport-super-markets');return m;},{},React);
 const analysis={status:'ready',capturedAt:at,expected:{home:85,away:81,total:166,margin:4},probabilities:{home:.624,away:.376},totalSigma:15,playerContext:{status:'applied',marginSigma:12,recommendationEligible:false,preseason:false}};
 const html=renderToStaticMarkup(React.createElement(C,{game:game(fixtures[1]),analysis,snapshot:source(),sport:'WNBA',now}));
 for(const label of ['3 種玩法','全場讓分','全場大小分','全場獨贏','全贏','中洞贏','62.4%'])assert.ok(html.includes(label),label);
 assert.ok(!html.includes('暫無可用玩法'));assert.ok(!html.includes('暫無可用分布'));assert.ok(!html.includes('>推薦</em>'));
});
