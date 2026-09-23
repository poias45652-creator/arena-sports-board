import test from 'node:test';
import assert from 'node:assert/strict';
import {parseNpbRelief,kboReliefGame,createBullpenCollector} from '../server/international-bullpen.mjs';
const table=rows=>'<table>'+rows.map(r=>'<tr>'+r.map(v=>'<td>'+v+'</td>').join('')+'</tr>').join('')+'</table>';
const starter=['先発合計','3.04','135','47','44','0','0','0','0','0','0','757.0','664','66','733','291','288','256','3.32','-'];
const relief=['救援合計','2.49','476','26','16','149','45','175','71','26','16','452.1','358','28','364','176','136','125','-','3.33'];
const total={team:'讀賣巨人',games:135,outs:3628,er:381,allowed:424,hits:1022,k:1097,bb:406,hbp:61,throughDate:'2026-09-22'};
test('NPB relief uses verified relief innings, not entire-team pitching',()=>{
 const html='<title>2026年度版 巨人 - チームデータ -</title>'+table([starter,relief]);
 const row=parseNpbRelief(html,total,'2026-09-23','2026-09-23T05:00:00Z','https://nf3.sakura.ne.jp/Central/G/t/teamdata.htm');
 assert.equal(row.stats.innings,'452.1');assert.equal(row.stats.era,'2.49');assert.equal(row.stats.whip,'');assert.equal(row.stats.walks,'');assert.equal(row.source.scope,'season');
 for(const changes of [{er:380},{outs:3627},{games:134},{bb:405}])assert.throws(()=>parseNpbRelief(html,{...total,...changes},'2026-09-23','',''));
 assert.throws(()=>parseNpbRelief(html.replace('2026年度','2025年度'),total,'2026-09-23','',''));
});
const raw={categoryId:'kbo',gameId:'20260922LTHH0',gameDate:'2026-09-22',gameDateTime:'2026-09-22T18:30:00',statusCode:'RESULT',awayTeamCode:'LT',homeTeamCode:'HH',awayTeamScore:2,homeTeamScore:3,awayStarterName:'away starter',homeStarterName:'home starter'};
const pitcher=(pcode,name,seqno,inn,er)=>({pcode,name,seqno,inn,er,run:er,hit:2,bb:1,kk:2,ballCount:30});
const relay={awayLineup:{pitcher:[pitcher('1','away starter',1,'5.2',2),pitcher('2','reliever',2,'2.1',1)]},homeLineup:{pitcher:[pitcher('3','home starter',1,'6',2),pitcher('4','reliever',2,'3',0)]}};
test('KBO completed logs exclude starter innings and preserve thirds',()=>{
 const page={url:'https://api-gw.sports.naver.com/',fetchedAt:'2026-09-23T05:00:00Z'};
 const g=kboReliefGame(raw,relay,page,'2026-09-23');assert.equal(g.teams[0].outs,7);assert.equal(g.teams[0].er,1);assert.equal(g.teams[1].outs,9);assert.equal(g.teams[1].er,0);
 assert.throws(()=>kboReliefGame({...raw,statusCode:'STARTED'},relay,page,'2026-09-23'));
 assert.throws(()=>kboReliefGame(raw,relay,page,'2026-09-22'));
 assert.throws(()=>kboReliefGame({...raw,homeTeamScore:9},relay,page,'2026-09-23'));
 const missing=structuredClone(relay);delete missing.awayLineup.pitcher[1].er;assert.throws(()=>kboReliefGame(raw,missing,page,'2026-09-23'));
 const switched=structuredClone(relay);switched.awayLineup.pitcher[0].name='different';assert.throws(()=>kboReliefGame(raw,switched,page,'2026-09-23'));
});
test('bullpen collector never backfills current stats into historical fixtures',async()=>{let calls=0;const collect=createBullpenCollector({now:()=>Date.parse('2026-09-23T05:00:00Z'),fetcher:async()=>{calls++;throw Error('not expected');}});const r=await collect('NPB','2026-09-22',['讀賣巨人']);assert.equal(r.rows.length,0);assert.equal(calls,0);});
