import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const moduleUrl=code=>'data:text/javascript;base64,'+Buffer.from(ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64');
const aliases=moduleUrl(readFileSync('lib/international-teams.ts','utf8'));
const kboTeams=moduleUrl(readFileSync('lib/kbo-teams.ts','utf8'));
const {internationalTeam}=await import(aliases);
const {scheduledKboGames,upcomingKboGames}=await import(moduleUrl(readFileSync('lib/international-fixtures.ts','utf8').replace("'./international-teams'",JSON.stringify(aliases)).replace("'./kbo-teams'",JSON.stringify(kboTeams))));
const headers=['台灣時間','賽別','客隊','比分','主隊','球場','備註'];
const table=rows=>[{title:'KBO 本月賽程與比分',headers,rows}];
const fixture=(time,away='HANWHA',home='LG雙子',score='—',note='')=>[time,'例行賽',away,score,home,'JAMSIL',note];

test('KBO aliases align score feeds and official teams without changing NPB identities',()=>{
 for(const [compact,full] of [['KT巫師','KT 巫師'],['LG雙子','LG 雙子'],['NC恐龍','NC 恐龍'],['SSG登陸者','SSG 登陸者']])assert.equal(internationalTeam(compact,'KBO'),full);
 assert.equal(internationalTeam('Giants','KBO'),'樂天巨人');assert.equal(internationalTeam('Giants','NPB'),'讀賣巨人');
});
test('official KBO schedules preserve Taiwan time, home/away and separate doubleheaders',()=>{
 const games=scheduledKboGames(table([fixture('2026-09-20 16:00'),fixture('2026-09-20 12:00')]));
 assert.deepEqual(games.map(g=>g.start),['2026-09-20 12:00:00','2026-09-20 16:00:00']);
 assert.equal(games[0].away,'韓華鷹');assert.equal(games[0].home,'LG 雙子');assert.equal(games[0].venue,'JAMSIL');
 assert.notEqual(games[0].id,games[1].id);assert.deepEqual(games[0].displayMarkets,[]);
});
test('pregame cards exclude started games, existing scores, cancellations and unverified fixtures',()=>{
 const rows=[fixture('2026-09-20 16:00'),fixture('2026-09-20 13:00'),fixture('2026-09-20 17:00','KT','NC','2:3'),fixture('2026-09-20 17:00','KT','NC','—','延賽'),fixture('2026-09-20 17:00','KT','NC','—','CANCELLED'),fixture('2026-09-20 17:00','未知','NC'),fixture('2026-09-20 17:00','NC','NC'),fixture('2026-02-30 17:00'),fixture('2026-09-20 25:00')];
 const games=upcomingKboGames(table(rows),Date.parse('2026-09-20T13:00:00+08:00'));
 assert.equal(games.length,1);assert.equal(games[0].start,'2026-09-20 16:00:00');
 assert.equal(scheduledKboGames(table(rows)).length,5);
});

const {parseKbo}=await import('../server/baseball-live-providers.mjs');
test('KBO live players resolve the actual pitcher and substitute batter by source ID',()=>{
 const raw={categoryId:'kbo',homeTeamCode:'LG',awayTeamCode:'HH',gameId:'20260920HHLG0',gameDate:'2026-09-20',gameDateTime:'2026-09-20T14:00:00',statusCode:'STARTED',homeTeamScore:2,awayTeamScore:1,currentInning:'7회초'};
 const page={url:'https://api-gw.sports.naver.com/example',fetchedAt:'2026-09-20T07:00:00Z'};
 const relay={currentGameState:{pitcher:'202',batter:'303'},homeLineup:{pitcher:[{pcode:'101',name:'先發投手',ballCount:'90'},{pcode:'202',name:'後援投手',ballCount:'12'}]},awayLineup:{batter:[{pcode:'302',name:'原打者',seqno:1},{pcode:'303',name:'代打球員',seqno:2}]}};
 const game=parseKbo(raw,page,relay);
 assert.equal(game.currentPitcher.name,'後援投手');assert.equal(game.currentPitcher.pitchCount,12);assert.equal(game.currentBatter.name,'代打球員');
 const unknown=parseKbo(raw,page,{...relay,currentGameState:{pitcher:'999',batter:'998'}});
 assert.equal(unknown.currentPitcher,null);assert.equal(unknown.currentBatter,null);
});
