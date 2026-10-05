import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {moduleUrl} from './profile-loader.mjs';
const m=await import(moduleUrl('lib/sport-super-markets.ts'));
const h=await import(moduleUrl('lib/hr9988.ts'));
const f=await import(moduleUrl('lib/football.ts'));
const now=Date.parse('2026-10-05T15:00:00Z');
const game=(home='蒙特內哥羅',away='亞美尼亞')=>({id:'401861001',league:'uefa.nations',start:'2026-10-05T18:45:00Z',state:'scheduled',timeConfirmed:true,home:{id:'1',name:home},away:{id:'2',name:away}});
// Prices and IDs below are synthetic test inputs, never captured/live quotes.
const quote=()=>({id:1,primary:true,open:true,homeLine:'0.5',awayLine:'',total:'2.5',homePrice:0.9,awayPrice:0.95,over:0.9,under:0.95,drawPrice:2.2});
const source=(home='黑山(主)',away='阿美尼亞')=>({source:'test-only',fetchedAt:new Date(now).toISOString(),sportGames:[{id:101,league:'FOOTBALL',competition:'uefa.nations',leagueName:'歐洲國家聯賽C',home,away,start:'2026/10/06 02:45:00',live:false,displayMarkets:[101,102,110].map(type=>({period:'full',type,quotes:[quote()]}))}]});
const status=(s=source(),g=game())=>m.sportMarketStatus(s,g,'FOOTBALL',now);

test('both reported cards and all three observed missing national spellings match exact identities',()=>{
 for(const [a,b] of [['阿美尼亞','亞美尼亞'],['波斯尼亞和黑塞哥維那','波士尼亞與赫塞哥維納'],['哈薩克斯坦','哈薩克']]){
  assert.equal(m.sportTeamKey(a+'（主）','FOOTBALL'),b);
  assert.notEqual(m.sportTeamKey(a,'NBA'),b);assert.notEqual(m.sportTeamKey(a,'WNBA'),b);
  assert.notEqual(m.sportTeamKey(a+'U21','FOOTBALL'),b);assert.notEqual(m.sportTeamKey(a+'女足','FOOTBALL'),b);
 }
 assert.equal(status().availableCount,3);
 assert.equal(status(source('波斯尼亞和黑塞哥維那(主)','波蘭'),game('波士尼亞與赫塞哥維納','波蘭')).availableCount,3);
 assert.equal(status(source('哈薩克斯坦(主)','摩爾多瓦'),game('哈薩克','摩爾多瓦')).availableCount,3);
});
// All 22 distinct senior Nations matchup spellings extracted from the supplied
// October 2/3 HAR response bodies. These are a historical name-contract replay,
// not today's source availability or source prices. Expected names come from
// the independent official-name registry, not sportTeamKey itself.
const observed=[
 ['法國','意大利','France','Italy'],['比利時','土耳其','Belgium','Turkey'],
 ['克羅地亞','英格蘭','Croatia','England'],['西班牙','捷克','Spain','Czechia'],
 ['匈牙利','格魯吉亞','Hungary','Georgia'],['烏克蘭','北愛爾蘭','Ukraine','Northern Ireland'],
 ['波蘭','羅馬尼亞','Poland','Romania'],['波斯尼亞和黑塞哥維那','瑞典','Bosnia and Herzegovina','Sweden'],
 ['瑞士','斯洛文尼亞','Switzerland','Slovenia'],['北馬其頓','蘇格蘭','North Macedonia','Scotland'],
 ['哈薩克斯坦','摩爾多瓦','Kazakhstan','Moldova'],['拉脫維亞','黑山','Latvia','Montenegro'],
 ['塞浦路斯','阿美尼亞','Cyprus','Armenia'],['法羅群島','斯洛伐克','Faroe Islands','Slovakia'],
 ['芬蘭','阿爾巴尼亞','Finland','Albania'],['愛沙尼亞','盧森堡','Estonia','Luxembourg'],
 ['白俄羅斯','聖馬力諾','Belarus','San Marino'],['冰島','保加利亞','Iceland','Bulgaria'],
 ['荷蘭','塞爾維亞','Netherlands','Serbia'],['葡萄牙','挪威','Portugal','Norway'],
 ['威爾斯','丹麥','Wales','Denmark'],['希臘','德國','Greece','Germany']
];
test('all 22 archived national matchup name pairs pass, with no fuzzy or opponent substitution',()=>{
 for(const [home,away,eh,ea] of observed){
  const g=game(f.footballTeamName(eh),f.footballTeamName(ea)),s=source(home+'(主)',away);
  assert.equal(status(s,g).availableCount,3,home+' / '+away);
  assert.equal(status(s,{...g,away:{name:'不存在的對手'}}).event,null);
 }
});
test('all supported senior competition labels remain distinct; Brazilian, youth, women and second divisions are rejected',()=>{
 const labels={'英格蘭超級聯賽':'eng.1','英超':'eng.1','西班牙甲級聯賽':'esp.1','西甲':'esp.1','意大利甲組聯賽':'ita.1','義甲':'ita.1','德國甲組聯賽':'ger.1','法國甲級聯賽':'fra.1','歐洲冠軍聯賽':'uefa.champions','歐洲聯賽冠軍盃':'uefa.champions',...Object.fromEntries(['A','B','C','D'].map(c=>['歐洲國家聯賽'+c,'uefa.nations']))};
 for(const [name,code] of Object.entries(labels))assert.equal(h.hrFootballCompetition(name),code,name);
 for(const name of ['巴西甲組聯賽','巴西甲級聯賽','西班牙女子甲級聯賽','德國女子甲級聯賽','英格蘭U21超級聯賽','歐洲U19冠軍聯賽','歐洲女子冠軍聯賽','西班牙乙級聯賽','法國甲級聯賽預備隊','歐洲國家聯賽U21','英格蘭超級聯賽盃'])assert.equal(h.hrFootballCompetition(name),null,name);
});
test('freshness, league, orientation, kickoff, duplicate and live guards cannot be relaxed by diagnostics',()=>{
 const mutations=[
  ['source_stale',s=>s.fetchedAt=new Date(now-150000).toISOString()],
  ['source_time_invalid',s=>s.fetchedAt=new Date(now+60001).toISOString()],
  ['competition_mismatch',s=>s.sportGames[0].competition='uefa.champions'],
  ['time_mismatch',s=>s.sportGames[0].start='2026/10/06 03:00:00'],
  ['time_mismatch',s=>s.sportGames[0].start='2026/10/07 02:45:00'],
  ['orientation_mismatch',s=>{s.sportGames[0].home='阿美尼亞';s.sportGames[0].away='黑山';}],
  ['team_name_mismatch',s=>s.sportGames[0].away='阿美尼亞U21'],
  ['source_not_pregame',s=>s.sportGames[0].live=true],
  ['fixture_ambiguous',s=>s.sportGames.push({...s.sportGames[0],id:102})],
  ['sport_unavailable',s=>s.sportGames[0].league='WNBA']
 ];
 for(const [code,mutate] of mutations){const s=source();mutate(s);const d=status(s);assert.equal(d.event,null,code);assert.equal(d.code,code);assert.equal(m.matchSportEvent(s,game(),'FOOTBALL',now),null);}
 assert.equal(status(null).code,'source_pending');
 assert.equal(status({...source(),sportGames:undefined}).code,'sport_unavailable');
 assert.equal(status(source(),{...game(),timeConfirmed:false}).code,'fixture_ineligible');
 assert.equal(status(source(),{...game(),state:'live'}).event,null);
 for(const bad of ['2026/02/30 02:45:00','2026/10/06 24:45:00','2026-10-06T02:45:00Z']){const s=source();s.sportGames[0].start=bad;assert.equal(status(s).event,null);}
});
test('missing, closed, duplicate and invalid full markets are distinct; open alternates never replace a closed primary',()=>{
 const s=source(),row=s.sportGames[0];
 row.displayMarkets[0].quotes[0].open=false;row.displayMarkets[0].quotes.push({...quote(),primary:false});
 row.displayMarkets[1].quotes[0].total='not-a-line';row.displayMarkets[2].quotes[0].drawPrice=null;
 let d=status(s);assert.equal(d.availableCount,0);assert.equal(d.markets.spread.code,'closed');assert.equal(d.markets.total.code,'invalid');assert.equal(d.markets.moneyline.code,'invalid');
 row.displayMarkets=[{period:'firstHalf',type:101,quotes:[quote()]}];d=status(s);assert.equal(d.markets.spread.code,'missing');assert.equal(d.availableCount,0);
 row.displayMarkets=source().sportGames[0].displayMarkets;row.displayMarkets.push(structuredClone(row.displayMarkets[0]));d=status(s);assert.equal(d.markets.spread.code,'ambiguous');assert.equal(d.availableCount,2);
 row.displayMarkets[1].quotes={};assert.doesNotThrow(()=>status(s));assert.equal(status(s).markets.total.code,'invalid');
});
test('audit emits bounded allowlisted source metadata without credentials, raw responses, prices or member fields',()=>{
 const s=source();s.token='DO_NOT_LOG';s.memberId='PRIVATE_MEMBER';s.sportGames[0].privateUrl='DO_NOT_LOG';
 const a=m.sportSourceAudit(s,now),text=JSON.stringify(a);
 assert.equal(a.fixtureCount,1);assert.equal(a.fixtures[0].availableMarkets,3);assert.equal(a.truncated,false);
 assert.ok(!/DO_NOT_LOG|PRIVATE_MEMBER|homePrice|signature|0\.95/.test(text));
 const many={...s,sportGames:Array.from({length:121},(_,i)=>({...s.sportGames[0],id:i,home:'team'+i}))};
 assert.equal(m.sportSourceAudit(many,now).fixtures.length,120);assert.equal(m.sportSourceAudit(many,now).truncated,true);
});
const code=ts.transpileModule(fs.readFileSync('app/sport-markets.tsx','utf8'),{fileName:'markets.tsx',compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const C=new Function('require','exports','React',code+'\nreturn exports.default;')(key=>{assert.equal(key,'@/lib/sport-super-markets');return m;},{},React);
const analysis={status:'ready',capturedAt:new Date(now).toISOString(),expected:{home:2,away:1},probabilities:{home:.6,draw:.2,away:.2}};
const render=s=>renderToStaticMarkup(React.createElement(C,{game:game(),analysis,snapshot:s,sport:'FOOTBALL',now}));
test('actual expanded component shows two repaired cards, only available play counts, and precise failure text',()=>{
 assert.ok(render(source()).includes('3 種玩法'));
 const s=source();s.sportGames[0].displayMarkets=s.sportGames[0].displayMarkets.slice(0,1);
 assert.ok(render(s).includes('1 種玩法'));assert.ok(render(s).includes('來源尚未提供此全場玩法'));
 s.fetchedAt=new Date(now-150000).toISOString();const html=render(s);
 assert.ok(html.includes('data-market-status="source_stale"'));assert.ok(html.includes('全場資料已過期'));assert.ok(!html.includes('3 種玩法'));assert.ok(!html.includes('尚未取得可配對的全場資料'));
});
