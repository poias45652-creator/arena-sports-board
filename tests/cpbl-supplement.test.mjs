import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const {supplementCpblPitchers}=await import(moduleUrl('lib/cpbl-pitcher-supplement.ts'));
const {supplementCpblHistory}=await import(moduleUrl('lib/cpbl-history-supplement.ts'));
const {addNewsStarters,currentPregame,pregameMissing}=await import(moduleUrl('lib/international-current-pregame.ts'));
const {applyPitchingImports}=await import(moduleUrl('lib/pregame-pitching-import.ts'));
const {displayPitcherStat}=await import(moduleUrl('lib/international-pregame.ts'));
const raw=json('data/cpbl-pregame-20260920.json'),archive=json('data/cpbl-pitcher-supplement-20260919.json');
const initial=()=>addNewsStarters(applyPitchingImports(raw,json('data/cpbl-pitching-20260920.json')),json('data/cpbl-starter-news-20260920.json'));
const now=Date.parse('2026-09-20T08:45:00Z');

test('four missing starters gain checked season fields; retained and flagged rows stay unchanged',()=>{
 const original=initial(),before=JSON.stringify(original),out=supplementCpblPitchers(original,archive,now);
 assert.equal(JSON.stringify(original),before);assert.equal(pregameMissing(out).era,5);assert.equal(pregameMissing(out).whip,5);
 assert.deepEqual(out.games[0],original.games[0]);
 assert.equal(displayPitcherStat(out.games[2].away,'era'),'2.41');assert.equal(displayPitcherStat(out.games[2].home,'whip'),'1.19');
 assert.equal(out.games[2].away.starter.statSources.era.observedAt,'2026-09-19T12:39:34.281Z');
 assert.deepEqual(out.games[2].source,original.games[2].source);
 assert.deepEqual(supplementCpblPitchers(out,archive,now),out);
});
test('same-name other-team players, old archives, future captures and inconsistent stats cannot fill a card',()=>{
 for(const change of [a=>a.season=2025,a=>a.pitchers.forEach(p=>p.source.observedAt='2026-09-18T00:00:00Z'),a=>a.pitchers.forEach(p=>p.source.observedAt='2026-09-20T09:10:00Z'),a=>a.pitchers.forEach(p=>p.season.whip='9.99'),a=>a.pitchers.forEach(p=>p.team='另一隊')]){
  const a=structuredClone(archive);change(a);assert.deepEqual(supplementCpblPitchers(initial(),a,now),initial());
 }
 const a=structuredClone(archive),lin=a.pitchers.find(p=>p.name==='林子崴');lin.team='統一獅';lin.teamCode='ADD';
 assert.equal(supplementCpblPitchers(initial(),a,now).games[2].home.starter.season.whip,'');
});
test('fresh values take precedence and their field source changes while other archived fields retain time',()=>{
 const out=supplementCpblPitchers(initial(),archive,now),g=out.games[2];
 const live={league:'CPBL',date:g.date,id:'345',status:'pregame',startTime:g.start.replace(' ','T')+'+08:00',away:{id:'AKP',name:g.away.team},home:{id:'AJL',name:g.home.team},starters:{away:{name:g.away.starter.name,era:2.2},home:null},source:{provider:'new-provider',url:'https://tw.sports.yahoo.com/cpbl/',fetchedAt:'2026-09-20T08:40:00Z'},lineups:{away:[],home:[]}};
 const merged=supplementCpblPitchers(currentPregame('CPBL',g.date,{games:[live]},[out]),archive,now).games[2];
 assert.equal(merged.away.starter.season.era,'2.2');assert.equal(merged.away.starter.statSources.era.observedAt,live.source.fetchedAt);
 assert.equal(merged.away.starter.statSources.whip.observedAt,'2026-09-19T12:39:34.281Z');
 live.starters.away.name='另一先發';const changed=supplementCpblPitchers(currentPregame('CPBL',g.date,{games:[live]},[out]),archive,now).games[2];
 assert.equal(changed.away.starter.season.whip,'');
});
test('one new completed fixture fills history, deduplicates and never overrides a corrected current observation',()=>{
 const history=json('data/international-profile-2026.json').games.CPBL.games,daily=json('data/cpbl-daily-supplement-20260920.json');
 const all=supplementCpblHistory(history,daily.games,2026);
 assert.equal(all.length,history.length+1);assert.deepEqual(supplementCpblHistory(all,daily.games,2026),all);
 const game=all.find(g=>g.id===342);assert.deepEqual([game.awayId,game.homeId,game.awayScore,game.homeScore],[6,4,11,5]);
 assert.equal(game.inningScores.away.reduce((a,b)=>a+b,0),game.awayScore);
 const corrected={...game,homeScore:6};assert.equal(supplementCpblHistory([corrected],all,2026).find(g=>g.id===342).homeScore,6);
 const suspended={...game,completed:false,state:'Live'};assert.equal(supplementCpblHistory([suspended],all,2026).find(g=>g.id===342).completed,false);
 assert.equal(supplementCpblHistory([],daily.games,2027).length,0);
});
