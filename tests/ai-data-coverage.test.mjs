import test from 'node:test';
import assert from 'node:assert/strict';
import {createSeasonPitchingCollector,npbStatsPeriod} from '../server/baseball-season-pitching.mjs';
import {createBullpenCollector} from '../server/international-bullpen.mjs';
import {npbUpcomingDate,validNpbStatsPeriod} from '../lib/npb-stats-date.mjs';
import {moduleUrl} from './profile-loader.mjs';
const {supplementSeasonPitching}=await import(moduleUrl('lib/international-season-pitching.ts'));
const {supplementBullpens}=await import(moduleUrl('lib/international-bullpen.ts'));
const {buildRunAnalysis}=await import(moduleUrl('lib/baseball-run-analysis.ts'));
const {defaultBaseballSettings}=await import(moduleUrl('lib/baseball-model-settings.ts'));
const {aiTeamSuggestion}=await import(moduleUrl('server/ai-team-suggestions.ts'));
const {buildAiFacts}=await import(moduleUrl('lib/ai-assistant-facts.ts'));
const {quickAiAnswer,AI_INSUFFICIENT}=await import(moduleUrl('lib/ai-assistant.ts'));
const at='2026-10-23T12:00:00Z',now=Date.parse(at),date='2026-10-24';
const table=rows=>'<table>'+rows.map(r=>'<tr>'+r.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</table>';
const marker='<p class="right">全日程終了</p>';
test('current official totals are eligible for upcoming fixtures without historical or cross-season backfill',()=>{
 for(const day of ['2026-10-23','2026-10-24','2026-10-30'])assert.equal(npbUpcomingDate(day,at),true);
 for(const day of ['2026-10-22','2026-10-31','2026-02-31','2027-01-01'])assert.equal(npbUpcomingDate(day,at),false);
 assert.equal(npbUpcomingDate('2027-01-01','2026-12-31T00:00:00Z'),false);
 assert.equal(npbStatsPeriod(marker,date,at).seasonComplete,true);
 assert.equal(npbStatsPeriod('<p>2026年10月23日 現在</p>',date,at).throughDate,'2026-10-23');
 for(const html of ['<p>2026年10月24日 現在</p>','<p>2026年10月18日 現在</p>'])assert.throws(()=>npbStatsPeriod(html,date,at));
 assert.equal(validNpbStatsPeriod({observedAt:at,throughDate:null,seasonComplete:true,seasonYear:2025},date),false);
});
test('tomorrow NPB fixture is supplemented and all three assistant answers use measured inputs',async()=>{
 const teams=[['埼玉西武獅','埼玉西武ライオンズ','l','測試投手甲','3.00','60','20'],['北海道日本火腿鬥士','北海道日本ハムファイターズ','f','測試投手乙','4.50','60','30']];
 const calls=[];
 const collector=createSeasonPitchingCollector({now:()=>now,fetcher:async url=>{
  calls.push(url);const t=teams.find(t=>url.endsWith('idp1_'+t[2]+'.html'));assert.ok(t);
  return new Response('<title>2026年度 '+t[1]+' 個人投手成績</title>'+marker+table([['選手','防御率','投球回','安打','四球','自責点','勝利','敗北','三振'],[t[3],t[4],t[5],t[2]==='l'?'45':'60','15',t[6],'4','3','70']]));
 }});
 const pitching=await collector('NPB',date,teams.map(t=>t[0]));assert.equal(calls.length,2);assert.equal(pitching.rows.length,2);assert.deepEqual(pitching.errors,[]);
 const source={name:'test verified feed',url:'https://npb.jp/',observedAt:at,publishedAt:null};
 const side=t=>({team:t[0],teamCode:t[2],starter:{name:t[3],quality:'unavailable',season:{},warnings:[],recent:{headers:[],rows:[]}},bullpen:null});
 const data={league:'NPB',date,games:[{id:'upcoming-test',league:'NPB',date,start:date+' 18:00:00',kind:'pregame_snapshot',source,home:side(teams[0]),away:side(teams[1])}]};
 assert.equal(buildRunAnalysis(data.games[0],now,'NPB',true,defaultBaseballSettings()).mode,'simulation');
 const period={...source,throughDate:null,seasonComplete:true,seasonYear:2026};
 const relief={rows:teams.map(t=>({team:t[0],stats:{era:'3.00',innings:'400'},source:{...period,scope:'season',games:143,note:'測試後援實測樣本'}})),teamRuns:teams.map((t,i)=>({team:t[0],games:143,wins:80-i*5,losses:60+i*5,scored:550-i*30,allowed:450+i*30,throughDate:null,seasonComplete:true,seasonYear:2026,source:period}))};
 const enriched=supplementBullpens(supplementSeasonPitching(data,pitching,now),relief,now).games[0];
 assert.equal(enriched.home.starter.season.whip,'1.00');assert.equal(enriched.home.starter.season.innings,'60');
 const analysis=buildRunAnalysis(enriched,now,'NPB',false,defaultBaseballSettings());assert.equal(analysis.status,'ready',analysis.reason);assert.equal(analysis.mode,undefined);
 const g={id:enriched.id,league:'NPB',day:date,home:enriched.home.team,away:enriched.away.team,homeId:'l',awayId:'f',start:date+'T10:00:00Z'};
 const ai={...analysis,probabilities:analysis.win,factors:analysis.personalModel.multifactor.factors,weightEvidence:{home:{starterOuts:180},away:{starterOuts:180}}};
 const suggestion=aiTeamSuggestion(g,ai,'baseball');assert.ok(suggestion);assert.notDeepEqual(suggestion.teams[0].weights,suggestion.teams[1].weights);
 const snapshot=buildAiFacts(g,ai,suggestion,'baseball');for(const action of ['analysis','risk','weights'])assert.notEqual(quickAiAnswer(snapshot,action).answer,AI_INSUFFICIENT,action);
 // A changed starter cannot inherit the old pitcher's statistics.
 const changed=structuredClone(data);changed.games[0].home.starter.name='另一位投手';assert.equal(supplementSeasonPitching(changed,pitching,now).games[0].home.starter.season.whip,undefined);
 assert.equal(supplementBullpens(data,relief,Date.parse(g.start)).games[0],data.games[0]);
 const future=structuredClone(pitching);future.rows.forEach(r=>r.source.observedAt='2026-10-24T11:00:00Z');assert.equal(supplementSeasonPitching(data,future,now).games[0].home.starter.season.whip,undefined);
});
test('bullpen collection runs for upcoming NPB dates and leaves the KBO date contract unchanged',async()=>{
 let calls=0;const collect=createBullpenCollector({now:()=>now,fetcher:async()=>{calls++;return new Response('unavailable',{status:503});}});
 const result=await collect('NPB',date,['埼玉西武獅']);assert.ok(calls>0);assert.ok(result.errors.length>0);
 calls=0;await collect('NPB','2026-10-22',['埼玉西武獅']);await collect('NPB','2026-10-31',['埼玉西武獅']);await collect('KBO',date,['LG 雙子']);assert.equal(calls,0);
});
