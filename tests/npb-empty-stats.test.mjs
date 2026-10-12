import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNpb} from '../server/baseball-live-providers.mjs';

const id='2021039480',root=`https://baseball.yahoo.co.jp/npb/game/${id}`;
const title='<title>2026年10月14日 阪神タイガースvs.横浜DeNAベイスターズ 試合出場成績 - プロ野球 - スポーツナビ</title>';
const page={url:root+'/score',fetchedAt:'2026-10-12T09:43:36.778Z'};
const card=`<a href="${root}/index"><span class="bb-score__homeLogo--npbTeam5"></span><span class="bb-score__awayLogo--npbTeam3"></span></a>`;
const board='<table id="ing_brd"><tr><th>1</th><th>計</th><th>安</th><th>失</th></tr><tr><td>2</td><td>2</td><td>5</td><td>0</td></tr><tr><td>1</td><td>1</td><td>4</td><td>0</td></tr></table>';
const score=(played=false)=>title+card+`<div class="bb-live">${played?'試合終了':'試合前'}</div><div class="bb-gameRound">18:00</div>`+(played?board:'');
const battingHeaders=['位置','選手名','打数','得点','安打','打点','三振','四球','死球','犠打','盗塁','失策','本塁打','1回','2回','3回','4回','5回','6回','7回','8回','9回'];
const pitchingHeaders=['選手名','投球回','投球数','打者','被安打','被本塁打','奪三振','与四球','与死球','ボーク','失点','自責点'];
const row=values=>'<tr>'+values.map(v=>`<td>${v}</td>`).join('')+'</tr>';
const table=(team,headers,body)=>`<table class="bb-statsTable bb-statsTable--npbTeam${team}"><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr>${body}</table>`;

// Exact total-row structure inspected on the official future fixture's /stats
// page on 2026-10-12 at 09:43:36.778Z. Its 合計 heading spans the position/name
// columns, so a flat cell array puts the first total at the player-name index.
// The nonzero totals and player rows below are synthetic regression variants.
const total=(values=Array(11).fill(0))=>`<tr class="bb-statsTable__row--total">
 <th class="bb-statsTable__head bb-statsTable__head--result" scope="col" colspan="2">合計</th>
 ${values.map(v=>`<td class="bb-statsTable__data bb-statsTable__data--result">${v}</td>`).join('')}
 <td class="bb-statsTable__data bb-statsTable__data--result" colspan="12"></td>
</tr>`;

test('NPB unpublished pregame totals do not create players named zero',()=>{
 const stats=title+table('3',battingHeaders,total())+table('5',battingHeaders,total())+table('3',pitchingHeaders,'')+table('5',pitchingHeaders,'');
 const game=parseNpb(score(),stats,id,page);
 assert.equal(game.status,'pregame');assert.equal(game.startTime,'2026-10-14T09:00:00.000Z');
 assert.deepEqual(game.batting,{away:[],home:[]});assert.deepEqual(game.pitching,{away:[],home:[]});assert.deepEqual(game.innings,{away:[],home:[]});
 assert.equal(game.away.score,null);assert.equal(game.home.score,null);
});

test('NPB nonzero colspan totals are not player records and cannot alter the final score',()=>{
 const stats=title+table('3',battingHeaders,total([32,2,5,2,8,3,0,0,1,0,1]))+table('5',battingHeaders,total([30,1,4,1,7,2,0,1,0,0,0]));
 const game=parseNpb(score(true),stats,id,page);
 assert.equal(game.status,'final');assert.deepEqual(game.batting,{away:[],home:[]});
 assert.equal(game.away.score,2);assert.equal(game.home.score,1);assert.equal(game.away.hits,5);assert.equal(game.home.hits,4);
});

test('NPB a named player with all zero stats remains present beside a zero total',()=>{
 const stats=title+table('3',battingHeaders,row(['遊','森 敬斗',...Array(11).fill(0),...Array(9).fill('')])+total());
 const game=parseNpb(score(),stats,id,page);
 assert.deepEqual(game.batting.away,[{id:null,name:'森 敬斗',stats:{AT_BATS:0,RUNS:0,HITS:0,RBIS:0,HOME_RUNS:0,WALKS:0,STRIKEOUTS:0}}]);
 assert.deepEqual(game.batting.home,[]);
});

test('NPB real batting and pitching rows retain their full values while totals are omitted',()=>{
 const batting=row(['捕','松尾 汐恩',4,1,2,1,1,0,0,0,0,0,1,...Array(9).fill('')]);
 const pitching=row(['才木 浩人','6.1',97,25,5,1,8,2,0,0,2,2]);
 const stats=title+table('3',battingHeaders,batting+total([32,2,5,2,8,3,0,0,1,0,1]))+table('5',pitchingHeaders,pitching+row(['合計','6.1',97,25,5,1,8,2,0,0,2,2]));
 const game=parseNpb(score(true),stats,id,page);
 assert.deepEqual(game.batting.away,[{id:null,name:'松尾 汐恩',stats:{AT_BATS:4,RUNS:1,HITS:2,RBIS:1,HOME_RUNS:1,WALKS:0,STRIKEOUTS:1}}]);
 assert.deepEqual(game.pitching.home,[{id:null,name:'才木 浩人',stats:{INNINGS_PITCHED:6.1,PITCHES_THROWN:97,HITS_ALLOWED:5,EARNED_RUNS:2,RUNS_ALLOWED:2,WALKS_ALLOWED:2,STRIKEOUTS_THROWN:8},pitchCount:97,outsRecorded:19}]);
 assert.deepEqual(game.batting.home,[]);assert.deepEqual(game.pitching.away,[]);
});
