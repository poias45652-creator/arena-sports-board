import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const m=await import(moduleUrl('lib/basketball-live.ts')),n=await import(moduleUrl('lib/nba.ts')),w=await import(moduleUrl('lib/wnba.ts'));
const fixture=(league,name)=>JSON.parse(readFileSync(`tests/fixtures/basketball-live/${league.toLowerCase()}-${name}.json`,'utf8'));
for(const league of ['NBA','WNBA']){
 const game=(league==='NBA'?n.parseNbaEvents:w.parseWnbaEvents)(fixture(league,'schedule'))[0],raw=fixture(league,'summary');
 test(`${league} actual summary maps quarters, keyed player stats, headshots and every play`,()=>{
  const d=m.parseBasketballDetail(raw,game,league);
  assert.equal(d.game.id,game.id);assert.equal(d.game.quarters.length,4);
  assert.equal(d.game.quarters.reduce((n,q)=>n+q.home,0),d.game.homeScore);
  assert.equal(d.game.quarters.reduce((n,q)=>n+q.away,0),d.game.awayScore);
  assert.equal(d.teams.length,2);assert.ok(d.teams.every(t=>t.players.length>=10));
  assert.ok(d.teams[0].players[0].stats.minutes);assert.ok(d.teams[0].players[0].photo.includes('/'+league.toLowerCase()+'/'));
  assert.equal(d.plays.length,raw.plays.length);assert.ok(d.plays.every((p,i)=>i===0||p.period<=d.plays[i-1].period));
  assert.equal(d.plays[0].period,4);assert.equal(m.playClockSeconds(d.plays[0].clock),0);
  assert.equal(d.plays[0].homeScore,d.game.homeScore);assert.equal(d.plays[0].awayScore,d.game.awayScore);
 });
 test(`${league} rejects another event/date/league/team and never trusts a mismatched photo`,()=>{
  assert.throws(()=>m.parseBasketballDetail(raw,{...game,id:'123'},league));
  assert.throws(()=>m.parseBasketballDetail(raw,{...game,start:'2026-10-13T00:00:00Z'},league));
  assert.throws(()=>m.parseBasketballDetail(raw,game,league==='NBA'?'WNBA':'NBA'));
  const invalid=structuredClone(raw);invalid.boxscore.players[0].team.id='999';assert.throws(()=>m.parseBasketballDetail(invalid,game,league));
  const changed=structuredClone(raw);changed.boxscore.players[0].statistics[0].athletes[0].athlete.headshot.href='https://example.com/not-the-player.png';
  assert.equal(m.parseBasketballDetail(changed,game,league).teams[0].players[0].photo,'');
 });
 test(`${league} omitted data is unknown and scheduled games have no fake score`,()=>{
  const missing=structuredClone(raw);delete missing.boxscore;delete missing.plays;
  const c=missing.header.competitions[0];c.status={type:{name:'STATUS_SCHEDULED',state:'pre',completed:false}};for(const t of c.competitors){delete t.score;delete t.linescores;}
  const d=m.parseBasketballDetail(missing,{...game,state:'scheduled'},league);
  assert.equal(d.game.homeScore,null);assert.equal(d.game.awayScore,null);assert.deepEqual(d.teams,[]);assert.deepEqual(d.plays,[]);
 });
 test(`${league} standings enforce league/season/phase and preserve zero-win teams`,()=>{
  const raw=fixture(league,'standings-regular'),season=league==='NBA'?2027:2026,d=m.parseBasketballStandings(raw,league,season,2);
  assert.equal(d.groups.length,2);assert.equal(d.groups.flatMap(g=>g.rows).length,league==='NBA'?30:15);
  assert.ok(d.groups.flatMap(g=>g.rows).every(r=>r.wins+r.losses===0?r.pct===null:r.pct>=0&&r.pct<=1));
  assert.throws(()=>m.parseBasketballStandings(raw,league,season-1,2));assert.throws(()=>m.parseBasketballStandings(raw,league,season,1));
  assert.throws(()=>m.parseBasketballStandings(raw,league==='NBA'?'WNBA':'NBA',season,2));
 });
}
test('preseason standings cannot be presented as regular-season standings',()=>assert.throws(()=>m.parseBasketballStandings(fixture('NBA','standings'),'NBA',2027,2)));
test('play action translation preserves names, made/missed distinction and distance',()=>{
 const a=m.basketballPlayText('Julius Randle misses 25-foot three point jumper');assert.match(a,/Julius Randle/);assert.match(a,/未命中/);assert.match(a,/25 呎/);assert.match(a,/三分/);
 assert.match(m.basketballPlayText('Caitlin Clark makes free throw 1 of 2'),/投進 罰球/);
});
test('live source coalesces requests and uses the requested league and standings phase',async()=>{
 const source=await import(moduleUrl('lib/basketball-live-source.ts')),native=fetch,requests=[];
 globalThis.fetch=async url=>{requests.push(url);const league=url.includes('/wnba/')?'WNBA':'NBA';return Response.json(fixture(league,url.includes('summary')?'summary':'standings-regular'));};
 try{for(const league of ['NBA','WNBA']){const game=(league==='NBA'?n.parseNbaEvents:w.parseWnbaEvents)(fixture(league,'schedule'))[0];const rows=await Promise.all([source.basketballDetail(game,league),source.basketballDetail(game,league)]);assert.deepEqual(rows[0],rows[1]);const table=await source.basketballStandings(league,league==='NBA'?2027:2026,2);assert.equal(table.league,league);}assert.equal(requests.length,4);assert.ok(requests.filter(u=>u.includes('standings')).every(u=>u.includes('seasontype=2')));}finally{globalThis.fetch=native;}
});
