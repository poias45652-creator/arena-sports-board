import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {parsePlaysportPregame,playsportLinks,fetchPlaysportPregame}=await import(moduleUrl('lib/playsport-pregame.ts'));
const {currentPregame}=await import(moduleUrl('lib/international-current-pregame.ts'));
const {mergePregameFixtures}=await import(moduleUrl('lib/international-pregame.ts'));
const {internationalTeam}=await import(moduleUrl('lib/international-teams.ts'));
const {uniqueInternationalFixtures}=await import(moduleUrl('lib/international-fixtures.ts'));
const {buildRunAnalysis,matchingRunAnalysis,analysisFixtureKey}=await import(moduleUrl('lib/baseball-run-analysis.ts'));
const captures=JSON.parse(readFileSync('data/playsport-capture-20260921.json'));
const npb=captures.find(x=>x.league==='NPB'),kbo=captures.find(x=>x.league==='KBO');
const html=readFileSync('tests/fixtures/playsport-npb-preview.html','utf8');
const url='https://www.playsport.cc/gamesData/battle?gameid=2026092121004&allianceid=2&officialId=NPB_20260921_Orix%40Fighters_1300';
const observed='2026-09-21T04:10:00Z';
test('actual captured tables preserve baseball innings, pitchers, bullpen and home/away rates',()=>{
 for(const page of [html,html.replaceAll('<row','<tr').replaceAll('</row>','</tr>').replaceAll('<cell','<td').replaceAll('</cell>','</td>')]){
  const g=parsePlaysportPregame(page,url,'NPB','2026-09-21',observed);
  assert.equal(g.away.starter.name,'山口廉王');assert.equal(g.away.starter.season.innings,'8.2');assert.equal(g.home.starter.season.whip,'1.03');
  assert.equal(g.away.bullpen.innings,'482.2');assert.equal(g.home.bullpen.era,'3.65');
  assert.deepEqual(g.comparison.rows.filter(r=>r[0]==='本季').map(r=>r[5]),['3.5 / 4.2','4.2 / 3.7']);
  assert.equal(g.away.starter.recent.rows[0][3],'');assert.equal(g.away.starter.recent.rows[0][5],'4.2');
  assert.equal(buildRunAnalysis(g,Date.parse(observed),'NPB').status,'ready');
 }
});
test('links are discovered for the selected league/date and duplicate anchors collapse',()=>{
 const links=[url,url+'#pitcher_home',url.replace('20260921','20260922'),url.replace('www.playsport.cc','evil.example')];
 assert.equal(playsportLinks(links.map(x=>`<a href="${x.replaceAll('&','&amp;')}">查看</a>`).join(''),'NPB','2026-09-21').length,1);
 assert.throws(()=>parsePlaysportPregame(html,url,'KBO','2026-09-21',observed));
 assert.throws(()=>parsePlaysportPregame(html.replace('2026/9/21','2026/9/20'),url,'NPB','2026-09-21',observed));
 assert.throws(()=>parsePlaysportPregame(html.replace('歐力士 vs. 火腿','火腿 vs. 歐力士'),url,'NPB','2026-09-21',observed));
 assert.equal(parsePlaysportPregame(html,url,'NPB','2026-09-21','2026-09-21T05:00:00Z'),null);
});
test('timestamp-only or denied upstream data cannot invent a successful snapshot',async()=>{
 const denied=await fetchPlaysportPregame('KBO','2026-09-22',async()=>new Response('',{status:403}));
 assert.equal(denied.snapshot.observedAt,'');assert.equal(denied.snapshot.games.length,0);assert.match(denied.errors[0],/403/);
 const timestamps=await fetchPlaysportPregame('NPB','2026-09-21',async()=>new Response('jQuery({"timestamp":1789848650945})'));
 assert.equal(timestamps.snapshot.observedAt,'');assert.ok(timestamps.errors.length);
});
test('Fighters aliases collapse one matchup and keep the existing identity across standings and logos',()=>{
 assert.equal(internationalTeam('日本火腿','NPB'),'北海道日本火腿鬥士');assert.equal(internationalTeam('Rakuten','CPBL'),'Rakuten');
 const g={id:'first',start:'2026-09-21 13:00:00',away:'歐力士猛牛',home:'日本火腿',displayMarkets:[],live:false};
 assert.equal(uniqueInternationalFixtures([g,{...g,id:'second',home:'北海道日本火腿鬥士'}],'NPB').length,1);
 const merged=mergePregameFixtures([g],npb,'NPB');assert.equal(merged.filter(x=>x.home==='北海道日本火腿鬥士').length,1);assert.equal(merged.find(x=>x.id==='first').pregame.home.starter.name,'加藤貴之');
});
test('verified same-team foreign pitcher aliases retain stats but another pitcher still invalidates them',()=>{
 const g=npb.games.find(x=>x.home.team==='阪神虎'),now=Date.parse(observed),r=buildRunAnalysis(g,now,'NPB');
 const game={id:g.id,start:g.start,away:g.away.team,home:g.home.team,live:false,displayMarkets:[],starters:{away:'平良 拳太郎',home:'Ｅ．ルーカス'}};
 const merged=mergePregameFixtures([game],npb,'NPB').find(x=>x.id===g.id);assert.ok(merged.pregame);
 const reports=new Map([[analysisFixtureKey(r.fixture,'NPB'),r]]);
 assert.equal(matchingRunAnalysis(game,reports,now,'NPB').status,'ready');
 assert.equal(matchingRunAnalysis({...game,starters:{...game.starters,home:'別の投手'}},reports,now,'NPB').win,null);
});
test('tomorrow KBO uses tomorrow records without copying yesterday starters or making zero ERA',()=>{
 const data=currentPregame('KBO','2026-09-22',{games:[]},[npb,kbo]);assert.equal(data.games.length,4);
 assert.ok(data.games.every(g=>g.date==='2026-09-22'&&g.comparison.rows.some(r=>r[0]==='本季')));
 for(const g of data.games)for(const side of ['away','home']){assert.equal(g[side].starter.name,'');assert.equal(g[side].starter.season.era,'');assert.equal(g[side].bullpen,null)}
 assert.equal(currentPregame('KBO','2026-09-23',{games:[]},[kbo]).games.length,0);
});
test('captured cancellations stop estimates and a source outage preserves original timestamps',()=>{
 const result=currentPregame('NPB',npb.date,{games:[],stale:true},[npb]);assert.equal(result.games.length,3);assert.equal(result.excludedFixtures.length,2);
 assert.ok(result.games.every(g=>g.home.team!=='千葉羅德海洋'));assert.equal(result.observedAt,npb.observedAt);
 for(const g of result.games){const r=buildRunAnalysis(g,Date.parse(observed),'NPB');assert.equal(r.status,'ready',r.reason);assert.ok(Math.abs(r.win.home+r.win.away+r.win.draw-1)<1e-9)}
 const g=result.games[0],live={league:'NPB',date:npb.date,status:'cancelled',startTime:g.start.replace(' ','T')+'+08:00',away:{name:g.away.team},home:{name:g.home.team},source:{url:'https://example.com/fixture',fetchedAt:observed}};
 assert.equal(currentPregame('NPB',npb.date,{games:[live]},[npb]).games.length,2);
});
