import test from 'node:test';
import assert from 'node:assert/strict';
import {access} from 'node:fs/promises';
import {dataResponse} from '../modules/hong-kong-football/server/football-data.js';
import {players} from '../modules/hong-kong-football/server/records.js';
import {moduleUrl} from './profile-loader.mjs';
import {hongKongDay,initialMatchDay} from '../public/hk-football/match-days.js';

const origin='https://member.example';
const {gateRequest}=await import(moduleUrl('server/request-gate.ts'));
const {loginLandingPage}=await import(moduleUrl('lib/admin-navigation.ts'));
const query=async path=>dataResponse(new URL('/api/'+path,origin)).json();

test('Hong Kong opens on the UTC+8 match day even from a previous round view',()=>{
  const before=hongKongDay(new Date('2026-12-31T15:59:59Z'));
  const after=hongKongDay(new Date('2026-12-31T16:00:00Z'));
  assert.equal(before,'2026-12-31');
  assert.equal(after,'2027-01-01');
  const day=search=>initialMatchDay(new URLSearchParams(search),after);
  assert.equal(day('view=analysis'),after);
  assert.equal(day('date=2027-02-30'),after);
  assert.equal(day('date=2026-11-20'),'2026-11-20');
  assert.equal(day('view=live&range=round'),after);
});

test('Hong Kong score requests after kickoff include only today unless the full round is selected',async()=>{
  const at=Date.parse('2026-11-20T20:06:00+08:00');
  const games=async(search,clock=at)=>(await dataResponse(new URL('/api/football?kind=board'+search,origin),null,clock).json()).games;
  for(const search of ['','&date=']){
    const list=await games(search);
    assert.deepEqual(list.map(g=>[g.day,g.home.id,g.away.id]),[['2026-11-20','LM','ND']]);
  }
  assert.deepEqual(await games('',Date.parse('2026-11-19T20:06:00+08:00')),[]);
  assert.deepEqual((await games('',Date.parse('2026-11-21T00:00:00+08:00'))).map(g=>g.day),['2026-11-21','2026-11-21']);
  const roundDays=new Set((await games('&range=round')).map(g=>g.day));
  assert.deepEqual([...roundDays].sort(),['2026-11-20','2026-11-21','2026-11-22']);
});

test('Hong Kong roster and photo links resolve on the member site',async()=>{
  const rosters=await Promise.all([...new Set(players.map(p=>p.team))].map(team=>query('football-team?action=roster&season=2026&team='+team)));
  const rows=rosters.flatMap(roster=>roster.players);
  assert.equal(rows.length,players.length);
  for(const player of rows){
    if(player.photo?.startsWith('/'))await access('public'+player.photo);
    assert.match(player.href,/^\/players\/football\/hkg\.1\//);
  }
  for(const [id,team,year] of [['23952','LM','2022'],['24023','SO','2025']]){
    const profile=await query('sport-player?season=2026&id='+id+'&team='+team);
    assert.equal(profile.photo,'/hk-football/brand/players/'+id+'.webp');
    assert.equal(Object.fromEntries(profile.bio)['照片年份'],year);
    assert.match(profile.team.href,/^\/teams\/football\/hkg\.1\//);
  }
});

test('Hong Kong fixtures retain the competition and date when returning to scores',async()=>{
  const board=await query('football?kind=board&date=2026-11-20');
  assert.ok(board.games.length);
  for(const game of board.games){
    const link=new URL(game.sourceUrl,origin);
    assert.equal(link.searchParams.get('league'),'FOOTBALL');
    assert.equal(link.searchParams.get('competition'),'hkg.1');
    assert.equal(link.searchParams.get('date'),game.day);
  }
});

test('Hong Kong shares the sports member gate and read-only access',async()=>{
  const href='/?league=FOOTBALL&competition=hkg.1&view=analysis';
  for(const path of [href,'/hong-kong/board','/teams/football/hkg.1/LM','/players/football/hkg.1/23952?team=LM']){
    const blocked=await gateRequest(new Request(origin+path),{});
    assert.equal(blocked.status,307);
    const login=new URL(blocked.headers.get('Location'));
    assert.equal(login.pathname,'/login');
    assert.ok(login.searchParams.get('football'));
    assert.equal(loginLandingPage(login.searchParams,{}),null);
    assert.equal(loginLandingPage(login.searchParams,{platforms:true}),'/platforms');
  }
  const request=new Request(origin+'/api/hong-kong/football-team?action=roster&team=LM');
  assert.equal((await gateRequest(request,{})).status,401);
});
