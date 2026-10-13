import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';

const fixture=JSON.parse(readFileSync('tests/fixtures/football-qualifying-20261012.json','utf8'));
const now=Date.parse(fixture.capturedAt);
const {analyzeFootball,footballForm,isFootballFormCompetition,parseFootballEvents,parseFootballTeamHistory}=await import(moduleUrl('lib/football.ts'));
const {reconcileFootballHistory}=await import(moduleUrl('lib/football-history.ts'));
const payload=path=>fixture.sources.find(s=>s.url===fixture.source+path)?.data;
const game=parseFootballEvents(payload('uefa.champions/scoreboard?dates=20261013&limit=100'),'uefa.champions').find(g=>g.id==='401915436');
const allSources=fixture.sources.filter(s=>s.data.team);
const history=reconcileFootballHistory(allSources.flatMap(s=>parseFootballTeamHistory(s.data,s.data.team.id)),[]).games;
const mainHistory=history.filter(g=>!g.league.endsWith('_qual'));
const qualifierSlugs=['uefa.champions_qual','uefa.europa_qual','uefa.europa.conf_qual'];

test('recorded Sabah qualifier history is retained without publishing uncalibrated cross-cup probabilities',()=>{
  const before=analyzeFootball(game,mainHistory,now,mainHistory);
  assert.equal(before.status,'waiting');
  assert.equal(before.homeForm.games,1);
  assert.equal(before.awayForm.games,7);
  const qualifiers=history.filter(g=>g.league==='uefa.champions_qual');
  assert.equal(qualifiers.length,8);
  assert.equal(qualifiers.filter(g=>g.statusName==='STATUS_FULL_TIME').length,7);
  assert.equal(qualifiers.find(g=>g.id==='401909192').statusName,'STATUS_FINAL_AET');
  const after=analyzeFootball(game,history,now,history);
  assert.equal(after.status,'waiting');
  assert.match(after.reason,/對手強度尚未校正/);
  assert.equal(after.homeForm.games,8);
  assert.equal(after.homeForm.supplementGames,7);
  assert.equal(after.awayForm.games,7);
  assert.equal(after.version,'football-cup-strength-required-v1');
  assert.equal(after.calibration.status,'baseline');
  assert.equal(after.calibration.holdoutGames,0);
  assert.equal(after.scores,undefined);
  assert.equal(after.probabilities,undefined);
  const weighted=footballForm(game.home.id,'home',history,now,false,{decayDays:90,venueWeight:.6,competition:game.league,otherCompetitionWeight:.35});
  assert.deepEqual(after.homeForm,weighted);
  assert.notEqual(after.homeForm.scored,footballForm(game.home.id,'home',history,now).scored);
});

test('only explicitly verified senior UEFA qualifier identities enter club history',()=>{
  const observed=new Set(allSources.flatMap(s=>s.data.events.map(e=>e.league?.slug)));
  for(const slug of qualifierSlugs){
    assert.ok(observed.has(slug),`${slug} must appear in the recorded source`);
    assert.equal(isFootballFormCompetition(slug,'uefa.champions'),true);
    assert.equal(isFootballFormCompetition(slug,'eng.1'),true);
    assert.equal(isFootballFormCompetition(slug,'uefa.nations',true),false);
    assert.equal(isFootballFormCompetition(slug,'fifa.world',true),false);
  }
  for(const slug of ['uefa.champions_qual_u19','uefa.champions_u19','uefa.womens.champions_qual','uefa.champions.women_qual','uefa.unknown_qual','club.friendly','fifa.friendly','fifa.worldq.uefa']){
    assert.equal(isFootballFormCompetition(slug,'uefa.champions'),false,slug);
  }
  const raw=payload('all/teams/21922/schedule?season=2026');
  assert.equal(parseFootballTeamHistory(raw,'21922','uefa.nations',true).length,0);
});

test('qualifying history still requires the exact source team and fixture participants',()=>{
  const raw=payload('all/teams/21922/schedule?season=2026');
  assert.throws(()=>parseFootballTeamHistory(raw,'494'),/身分不符/);
  const e=structuredClone(raw.events.find(e=>e.league.slug==='uefa.champions_qual'));
  e.competitions[0].competitors.forEach((c,i)=>{c.team.id=String(900000+i);});
  assert.equal(parseFootballTeamHistory({team:raw.team,events:[e]},'21922').length,0);
  const missingLeague=structuredClone(raw.events[1]);delete missingLeague.league;
  assert.equal(parseFootballTeamHistory({team:raw.team,events:[missingLeague]},'21922').length,0);
});

test('future, old, extra-time, penalty, incomplete and target-game qualifiers cannot fill a short sample',()=>{
  const seed=history.find(g=>g.league==='uefa.champions_qual'&&g.statusName==='STATUS_FULL_TIME');
  const bad=[
    {start:new Date(now+60000).toISOString()},
    {start:new Date(now-366*86400000).toISOString()},
    {statusName:'STATUS_FINAL_AET'},
    {statusName:'STATUS_FINAL_PEN'},
    {state:'live'},
    {homeScore:null},
    {id:game.id},
    {league:'uefa.womens.champions_qual'},
    {league:'uefa.champions_qual_u19'},
    {league:'club.friendly'},
  ].map((patch,i)=>({...seed,id:'990100'+i,...patch}));
  const analysis=analyzeFootball(game,mainHistory,now,[...mainHistory,...bad]);
  assert.equal(analysis.status,'waiting');
  assert.equal(analysis.homeForm.games,1);
  assert.equal(analysis.probabilities,undefined);
});

test('conflicting qualifier identities remain quarantined and healthy same-cup estimates stay unchanged',()=>{
  const seed=history.find(g=>g.league==='uefa.champions_qual'&&g.statusName==='STATUS_FULL_TIME');
  const conflict=reconcileFootballHistory([seed,{...seed,league:'uefa.champions'}],[seed]);
  assert.equal(conflict.conflicts,1);
  assert.equal(conflict.games.length,0);
  const sufficient=Array.from({length:12},(_,i)=>({...game,id:'990200'+i,start:new Date(now-(i+1)*86400000).toISOString(),state:'final',statusName:'STATUS_FULL_TIME',homeScore:2,awayScore:1}));
  assert.deepEqual(analyzeFootball(game,sufficient,now),analyzeFootball(game,sufficient,now,history));
});

test('full source collector retains qualifying evidence but waits for opponent-strength calibration',async()=>{
  const {footballGameAnalysis}=await import(moduleUrl('lib/football-source.ts'));
  const originalFetch=globalThis.fetch,originalNow=Date.now,calls=[];
  Date.now=()=>now;
  globalThis.fetch=async url=>{
    const path=String(url).replace(fixture.source,'');calls.push(path);
    const data=payload(path);
    if(data)return Response.json(data);
    // The optional annual model is unavailable in this regression; the exact
    // team histories must be sufficient without another provider's estimates.
    if(/^uefa\.champions\/scoreboard\?dates=202[56]&limit=1000$/.test(path))return new Response('Unavailable',{status:503});
    assert.fail(`unexpected source ${path}`);
  };
  try{
    const result=await footballGameAnalysis('uefa.champions','2026-10-14',game.id);
    assert.equal(result.game.id,'401915436');
    assert.equal(result.game.home.id,'21922');
    assert.equal(result.game.away.id,'494');
    assert.equal(result.game.start,'2026-10-13T16:45:00.000Z');
    assert.equal(result.analysis.status,'waiting');
    assert.match(result.analysis.reason,/對手強度尚未校正/);
    assert.equal(result.analysis.homeForm.games,8);
    assert.equal(result.analysis.homeForm.supplementGames,7);
    assert.equal(result.analysis.awayForm.games,7);
    assert.equal(result.analysis.version,'football-cup-strength-required-v1');
    assert.ok(result.analysis.quality.warnings.some(w=>w.includes('主隊7場、客隊0場')));
    assert.ok(result.analysis.quality.warnings.some(w=>w.includes('少於10場')));
    for(const team of ['21922','494'])for(const season of [2026,2025])assert.ok(calls.includes(`all/teams/${team}/schedule?season=${season}`));
  }finally{globalThis.fetch=originalFetch;Date.now=originalNow;}
});
