import test from 'node:test';
import assert from 'node:assert/strict';
import {npbStatsPeriod,parseNpbSeasonPitching} from '../server/baseball-season-pitching.mjs';
import {parseNpbTeamTotals} from '../server/international-bullpen.mjs';
import {moduleUrl} from './profile-loader.mjs';
const {supplementBullpens}=await import(moduleUrl('lib/international-bullpen.ts'));
const date='2026-10-12',at='2026-10-12T03:00:00Z',now=Date.parse(at);
const marker='<p class="right">全日程終了</p>';
const table=(rows)=>'<table>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</table>';
test('official completed season pages retain completion provenance without fabricating a cutoff date',()=>{
 const period=npbStatsPeriod(marker,date,at);
 assert.deepEqual(period,{throughDate:null,seasonComplete:true,seasonYear:2026});
 const html='<title>2026年度 埼玉西武ライオンズ 個人投手成績</title>'+marker+table([['選手','防御率','投球回','安打','四球','自責点','勝利','敗北','三振'],['投手','3.00','60','45','15','20','4','3','70']]);
 const row=parseNpbSeasonPitching(html,'l',date,at,'https://npb.jp/bis/2026/stats/idp1_l.html')[0];
 assert.equal(row.stats.whip,'1.00');assert.equal(row.source.seasonComplete,true);assert.equal(row.source.throughDate,null);
 assert.throws(()=>parseNpbSeasonPitching(html.replace('2026年度','2025年度'),'l',date,at,''));
 const batting='<title>2026年度 パシフィック・リーグ チーム打撃成績</title>'+marker+table([['チーム','試合','得点'],['西武','143','500']]);
 assert.equal(parseNpbTeamTotals(batting,date,'batting',at)[0].seasonComplete,true);
});
test('missing, future, stale and historical observations remain rejected',()=>{
 for(const html of ['', '<p>更新中</p>','<p>2026年10月12日 現在</p>','<p>2026年10月1日 現在</p>'])assert.throws(()=>npbStatsPeriod(html,date,at));
 for(const observed of ['', '2026-10-13T03:00:00Z','2026-10-01T03:00:00Z'])assert.throws(()=>npbStatsPeriod(marker,date,observed));
 assert.throws(()=>npbStatsPeriod(marker,'2026-10-01',at));
});
test('completed season bullpen and team totals feed only a matching pregame fixture within the upcoming window',()=>{
 const source={name:'NPB official',url:'https://npb.jp/',observedAt:at,throughDate:null,seasonComplete:true,seasonYear:2026};
 const teams=['埼玉西武獅','北海道日本火腿鬥士'];
 const data={league:'NPB',date,games:[{league:'NPB',date,start:'2026-10-12 13:00:00',home:{team:teams[0]},away:{team:teams[1]}}]};
 const result={rows:teams.map(team=>({team,stats:{era:'3.00',innings:'400'},source})),teamRuns:teams.map(team=>({team,games:143,wins:70,losses:70,scored:500,allowed:490,throughDate:null,seasonComplete:true,source}))};
 const updated=supplementBullpens(data,result,now).games[0];
 assert.equal(updated.home.bullpen.era,'3.00');assert.equal(updated.comparison.rows.length,2);assert.equal(updated.comparisonSource.seasonComplete,true);
 for(const patch of [{seasonYear:2025},{seasonComplete:false},{observedAt:'2026-10-01T03:00:00Z'},{observedAt:'2026-10-12T06:00:00Z'}]){
  const bad={...result,rows:result.rows.map(r=>({...r,source:{...source,...patch}})),teamRuns:result.teamRuns.map(r=>({...r,source:{...source,...patch}}))};
  assert.equal(supplementBullpens(data,bad,now).games[0].home.bullpen,undefined);
 }
 assert.equal(supplementBullpens(data,result,Date.parse('2026-10-12T06:00:00Z')).games[0],data.games[0]);
});
