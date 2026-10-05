import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const m=await import(moduleUrl('lib/nba-player-strength.ts')),n=await import(moduleUrl('lib/nba.ts')),presentation=await import(moduleUrl('lib/nba-analysis.ts'));
const f=JSON.parse(readFileSync('tests/fixtures/player-strength/heat-raptors.json'));
const snapshot=JSON.parse(readFileSync('data/nba-player-strength.json'));
const now=Date.parse(snapshot.capturedAt)+1000;
// This unit fixture is replayed on a relative test clock. Preserve all news ages
// relative to one another without changing the stored fixture or live sources.
// Production freshness checks and the separate expiry tests remain unchanged.
const fixtureNews=Object.values(f).flatMap(team=>[...team.news,...team.players.flatMap(p=>p.news||[])]);
const fixtureClock=Math.max(...fixtureNews.map(row=>Number(row.date??row.DateTime)).filter(Number.isFinite));
const offset=now-fixtureClock-1000;
const replayNews=row=>({...row,...(Number.isFinite(row.date)?{date:row.date+offset}:{}),...(Number.isFinite(row.DateTime)?{DateTime:row.DateTime+offset}:{})});
const evidence=(name,opp)=>f[name].roster.map(r=>{const p=f[name].players.find(p=>p.id===r.PLAYER_ID);return m.availabilityFromNews(r.PLAYER_ID,r.PLAYER,'https://www.nba.com/player/'+r.PLAYER_ID,[...(p?.news||[]),...f[name].news].map(replayNews),now,[opp]);});
const home=evidence('raptors','Miami'),away=evidence('heat','Toronto');
const game={id:'official:0012600009',home:n.nbaTeam('28'),away:n.nbaTeam('14'),phase:1,season:2027,state:'scheduled',timeConfirmed:true,neutral:false,start:new Date(now+86400000).toISOString()};
const base={status:'ready',capturedAt:new Date(now).toISOString(),homeForm:{games:20},awayForm:{games:20},expected:{home:123,away:117,total:240,margin:6},probabilities:{home:.711,away:.289},model:'nba-efficiency-monte-carlo-v2',weightsKey:'0.20000000,0.20000000,0.20000000,0.20000000,0.20000000'};
test('official fixture names include incoming stars and exclude departed players',()=>{
 assert.ok(away.some(p=>p.id===203507));assert.ok(away.some(p=>p.id===202691));assert.ok(!away.some(p=>/Herro/.test(p.name)));
 assert.ok(home.some(p=>p.id===202695));assert.equal(away.find(p=>p.id===203507).status,'expected');assert.equal(home.find(p=>p.id===202695).status,'doubtful');
});
test('negative availability, stale/future reports, and unknown are distinct',()=>{
 const news=(text,date=now)=>[{nbaId:1,date,update:text}];
 assert.equal(m.availabilityFromNews(1,'A','x',news('A is unlikely to play against Toronto'),now,['Toronto']).status,'doubtful');
 for(const date of [now+1,now-73*3600000])assert.equal(m.availabilityFromNews(1,'A','x',news('A will play against Toronto',date),now,['Toronto']).status,'unknown');
 assert.equal(m.availabilityFromNews(1,'A','x',[],now).status,'unknown');
 assert.equal(m.availabilityFromNews(1,'A','x',news('A will be limited to 18 minutes against Toronto'),now,['Toronto']).minutesCap,18);
 assert.equal(m.availabilityFromNews(1,'A','x',news('A averaged 30 minutes last season'),now,['Toronto']).minutesCap,undefined);
});
test('each rotation has exactly 240 minutes; out is zero and caps are respected',()=>{
 for(const e of [home,away])for(const s of ['low','central','high']){
  const rows=m.allocateMinutes(e,true,s);assert.ok(Math.abs(rows.reduce((n,p)=>n+p.minutes,0)-240)<1e-7);
  for(const p of rows){assert.ok(p.minutes>=0&&p.minutes<=48);if(e.find(r=>r.id===p.id).status==='out')assert.equal(p.minutes,0);}
 }
 const capped=away.map(p=>p.id===203507?{...p,minutesCap:10}:p);assert.ok(m.allocateMinutes(capped,true,'high').find(p=>p.id===203507).minutes<=10);
 assert.throws(()=>m.allocateMinutes(away.map(p=>({...p,status:'out'})),true,'central'));
});
test('player absence changes the forecast, probabilities and displayed margin agree',()=>{
 const a=m.applyPlayerStrength(game,base,home,away,now),b=m.applyPlayerStrength(game,base,home,away.map(p=>p.id===203507?{...p,status:'out'}:p),now);
 assert.equal(a.status,'ready');assert.equal(a.model,'nba-player-opponent-v3');assert.ok(a.probabilities.away>b.probabilities.away);assert.equal(a.probabilities.home+a.probabilities.away,1);
 assert.ok((a.probabilities.home-.5)*a.expected.margin>=0);assert.equal(a.playerContext.preseason,true);assert.equal(a.playerContext.calibrated,false);assert.equal(presentation.nbaPick(game,a),null);
 assert.ok(presentation.readyNbaAnalysis(game,{game,analysis:a,sourceFetchedAt:new Date(now).toISOString()},now,false,base.weightsKey));
 assert.ok(a.playerContext.probabilityRange[0]<=a.probabilities.home&&a.playerContext.probabilityRange[1]>=a.probabilities.home);
});
test('expired or future snapshot cannot expose an old confident recommendation',()=>{
 for(const t of [Date.parse(snapshot.capturedAt)-1,Date.parse(snapshot.capturedAt)+37*3600000]){
  const a=m.applyPlayerStrength({...game,start:new Date(t+3600000).toISOString()},base,home,away,t);assert.equal(a.status,'waiting');assert.equal(a.probabilities,undefined);
 }
});
test('NBA engine never applies NBA parameters to WNBA teams',()=>assert.equal(m.applyPlayerStrength({...game,home:{...game.home,league:'WNBA'},away:{...game.away,league:'WNBA'}},base,home,away,now),base));
