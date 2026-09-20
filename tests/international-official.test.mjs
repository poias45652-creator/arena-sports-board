import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const moduleUrl=code=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const aliases=moduleUrl(readFileSync('lib/international-teams.ts','utf8'));
const {parseInternational,yahooObjects}=await import(moduleUrl(readFileSync('lib/international.ts','utf8').replace("'./international-teams'",JSON.stringify(aliases))));
const row=(date,score,note='-')=>`<tr>${date?`<td title="DATE" rowspan="2">${date}</td><td title="TYPE">REGULAR</td>`:''}<td class="TIME">18:30</td><td title="GAME">LG</td><td title="GAME">${score}</td><td title="GAME">DOOSAN</td><td class="LOCATION">JAMSIL</td><td class="ETC">${note}</td></tr>`;
const month='<span id="lblGameMonth">2026.09</span>';
test('KBO inherited rowspan dates and time zone stay paired with each game',()=>{
 const rows=parseInternational(month+row('09.01(TUE)','3:1')+row('',':','POSTPONED'),'kbo-schedule',2026).tables[0].rows;
 assert.equal(rows.length,2);assert.equal(rows[1][0],'2026-09-01 17:30');assert.equal(rows[0][2],'LG 雙子');assert.equal(rows[0][4],'斗山熊');assert.equal(rows[1][3],'—');assert.equal(rows[1][6],'延賽');
});
test('KBO rejects old seasons, mismatched months, and unparseable score pages',()=>{
 assert.throws(()=>parseInternational(month+row('09.01(TUE)','3:1'),'kbo-schedule',2027));
 assert.throws(()=>parseInternational(month+row('08.31(MON)','3:1'),'kbo-schedule',2026));
 assert.throws(()=>parseInternational(month+row('09.01(TUE)','oops'),'kbo-schedule',2026));
 assert.throws(()=>parseInternational(month,'kbo-schedule',2026));
});
const starter='<a href="/announcement/2026/"></a><h4>9月14日の予告先発投手</h4><div class="unit cl_1"><div class="team_left"><img alt="阪神タイガース"><span>投手甲</span></div><div class="team_right"><img alt="中日ドラゴンズ"><span>投手乙</span></div><div class="info">（甲子園）18:00</div>';
test('NPB announced pitchers retain opponent, announcement date and Taiwan start',()=>{
 const r=parseInternational(starter,'npb-starters',2026).tables[0].rows[0];assert.deepEqual(r.slice(0,5),['2026-09-14 17:00','阪神虎','投手甲','中日龍','投手乙']);
 assert.throws(()=>parseInternational(starter.replace('<span>投手乙</span>',''),'npb-starters',2026));
});
test('NPB cancellation is a registration change, never an inferred injury',()=>{
 const html='<h4>2026年9月13日の出場選手登録、登録抹消</h4><h5>出場選手登録抹消</h5><table><tr><td>阪神タイガース</td><td>投手</td><td>1</td><td>投手甲</td></tr></table>';
 const r=parseInternational(html,'npb-roster',2026);assert.equal(r.tables[0].rows[0][5],'取消登錄');assert.match(r.scope,/不等於受傷/);assert.throws(()=>parseInternational(html,'npb-roster',2027));
});

const cpblTable='<title>CPBL 2026 排名 - Yahoo運動</title><table><tr>'+['排名','ALL','勝','敗','勝率','勝差','和'].map(x=>`<th>${x}</th>`).join('')+'</tr>'+['龍','獅','悍將','雄鷹','桃猿','兄弟'].map((name,i)=>'<tr>'+[i+1,name,50,50,'.500','0.0',2].map(x=>`<td>${x}</td>`).join('')+'</tr>').join('')+'</table>';
test('CPBL selects only the complete current-season table and preserves ties',()=>{
 const rows=parseInternational(cpblTable,'cpbl-standings',2026).tables[0].rows;
 assert.equal(rows.length,6);assert.deepEqual(rows[3].slice(1,6),['台鋼雄鷹','102','50','50','2']);
 assert.throws(()=>parseInternational(cpblTable,'cpbl-standings',2025));
 assert.throws(()=>parseInternational(cpblTable.replace('雄鷹','龍'),'cpbl-standings',2026));
 assert.throws(()=>parseInternational(cpblTable.replace('ALL','MLB'),'cpbl-standings',2026));
});
const yGame={gameId:'cpbl.g.260914280',homeTeamId:'cpbl.t.8',awayTeamId:'cpbl.t.1',startTime:'2026-09-14T03:35:00-07:00',seasonPhase:'REGULAR_SEASON',status:'PREGAME',homeScore:0,awayScore:0,alias:{url:'https://tw.sports.yahoo.com/cpbl/brothers-hawks-260914280/'}};
const yPage=games=>'<script>self.__next_f.push('+JSON.stringify([1,'a:'+JSON.stringify(games)+'\n'])+')</script>';
test('Yahoo CPBL validates league and team IDs, deduplicates and does not show pregame zero scores',()=>{
 const games=parseInternational(yPage([yGame,yGame,{...yGame,gameId:'mlb.g.260914280'}]),'cpbl-schedule',2026).games;
 assert.equal(games.length,1);assert.match(games[0].label,/2026-09-14 18:35/);assert.match(games[0].label,/中信兄弟（客） vs 台鋼雄鷹（主）/);assert.doesNotMatch(games[0].label,/0：0/);
 assert.throws(()=>parseInternational(yPage([yGame]),'cpbl-schedule',2025));
 assert.throws(()=>parseInternational(yPage([{...yGame,awayTeamId:'cpbl.t.999'}]),'cpbl-schedule',2026));
});

test('Yahoo nested player stats resolve React element props without losing home records',()=>{
 const chunks='a:'+JSON.stringify(['$','component',null,{stats:[{statId:'HITS',value:'2'}]}])+'\n'+'b:'+JSON.stringify({playerId:'cpbl.p.1',nested:{stats:'$a:props:stats'}})+'\n';
 const page='<script>self.__next_f.push('+JSON.stringify([1,chunks])+')</script>';
 const player=yahooObjects(page).find(x=>x.playerId==='cpbl.p.1');assert.equal(player.nested.stats[0].value,'2');
});
