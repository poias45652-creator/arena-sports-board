import test from 'node:test';
import assert from 'node:assert/strict';
import {collectLeague} from '../server/baseball-current.mjs';
import {createLiveFeed} from '../server/baseball-live-feed.mjs';

const date='2026-10-12',id='2021040000',root=`https://baseball.yahoo.co.jp/npb/game/${id}`;
const observed=Date.parse('2026-10-12T10:00:00Z');
const card=`<a class="bb-score__content" href="${root}/index"><span class="bb-score__homeLogo--npbTeam1"></span><span class="bb-score__awayLogo--npbTeam6"></span></a>`;
const identity=(kind,gameId=id,day='2026年10月12日')=>`<title>${day} 対戦</title><meta property="og:url" content="https://baseball.yahoo.co.jp/npb/game/${gameId}/${kind}">`;
const innings='<table id="ing_brd"><tr><th>1</th><th>計</th><th>安</th><th>失</th></tr><tr><td>2</td><td>2</td><td>4</td><td>0</td></tr><tr><td>1</td><td>1</td><td>3</td><td>0</td></tr></table>';
const gamePage=(kind,{state='試合終了',clock=kind==='top'?'13:00':null,round=null,gameId=id,day,detail=''}={})=>identity(kind,gameId,day)+`<div class="bb-live">${state}</div>`+detail+innings+(clock?`<p class="bb-gameCard__time">${clock}</p>`:'')+(round?`<div class="bb-gameRound">${round}</div>`:'');
const statsPage=(gameId=id,day)=>identity('stats',gameId,day)+'<table class="bb-stats--npbTeam1"><tr><th>選手名</th><th>投球回</th><th>投球数</th><th>被安打</th><th>自責点</th><th>失点</th><th>与四球</th><th>奪三振</th></tr><tr><td>投手甲</td><td>1</td><td>24</td><td>4</td><td>2</td><td>2</td><td>0</td><td>1</td></tr></table>';

function collect(pages={}){
 return collectLeague('NPB',{date,fetcher:async url=>{
  if(String(url).includes('/schedule/'))return new Response(card);
  const kind=String(url).split('/').at(-1);
  const body=Object.hasOwn(pages,kind)?pages[kind]:kind==='stats'?statsPage():kind==='text'?identity('text'):gamePage(kind);
  return typeof body==='number'?new Response('unavailable',{status:body}):new Response(body);
 }});
}
function clock(t){t.mock.timers.enable({apis:['Date'],now:observed});}
function verifyScore(result){
 assert.equal(result.games.length,1);assert.equal(result.status,'ok');assert.deepEqual(result.errors,[]);
 const game=result.games[0];assert.equal(game.status,'final');assert.equal(game.home.score,1);assert.equal(game.away.score,2);
 assert.equal(game.source.fetchedAt,new Date(observed).toISOString());return game;
}

test('NPB current score and validated same-game stats are merged with their original sources',async t=>{
 clock(t);const result=await collect(),game=verifyScore(result);
 assert.equal(game.source.url,root+'/score');assert.equal(game.startTime,date+'T04:00:00.000Z');
 assert.equal(game.pitching.home[0].name,'投手甲');assert.equal(game.pitching.home[0].pitchCount,24);
 assert.ok(game.source.supportingSources.some(p=>p.url===root+'/stats'));assert.deepEqual(result.warnings,[]);
});

for(const [label,stats] of [
 ['HTTP failure',503],
 ['unrecognized stats page','<title>temporary error</title>'],
 ['wrong date',statsPage(id,'2026年10月11日')],
 ['other game in the same-day doubleheader',statsPage('2021040001')]
])test(`NPB ${label} in optional stats preserves the fresh score without importing player data`,async t=>{
 clock(t);const result=await collect({stats}),game=verifyScore(result);
 assert.equal(game.source.url,root+'/score');assert.equal(game.startTime,date+'T04:00:00.000Z');
 assert.deepEqual(game.pitching,{away:[],home:[]});assert.deepEqual(game.batting,{away:[],home:[]});
 assert.ok(game.warnings.some(w=>w.startsWith('npb_stats:')));assert.ok(result.warnings.some(w=>w.includes('npb_stats:')));
 assert.ok(!game.source.supportingSources.some(p=>p.url===root+'/stats'));
});

test('NPB a missing top page preserves a verified score and leaves the unknown start null',async t=>{
 clock(t);const result=await collect({top:503}),game=verifyScore(result);
 assert.equal(game.source.url,root+'/score');assert.equal(game.startTime,null);assert.ok(game.warnings.some(w=>w.startsWith('npb_top:')));
});

test('NPB wrong-date top details cannot overwrite a valid current score or its clock',async t=>{
 clock(t);const result=await collect({score:gamePage('score',{round:'13:00'}),top:gamePage('top',{day:'2026年10月11日',clock:'18:00'})}),game=verifyScore(result);
 assert.equal(game.startTime,date+'T04:00:00.000Z');assert.ok(game.warnings.some(w=>w.includes('NPB top date conflict')));
 assert.ok(!game.source.supportingSources.some(p=>p.url===root+'/top'));
});

test('NPB two valid pages with conflicting start clocks still reject the fixture',async t=>{
 clock(t);const result=await collect({score:gamePage('score',{round:'13:00'}),top:gamePage('top',{clock:'18:00'})});
 assert.deepEqual(result.games,[]);assert.equal(result.status,'partial');assert.match(result.errors[0],/日職開賽時間欄位不一致/);
});

test('NPB a verified top fallback preserves the fresh fixture when the score endpoint fails',async t=>{
 clock(t);const result=await collect({score:503}),game=verifyScore(result);
 assert.equal(game.source.url,root+'/top');assert.equal(game.startTime,date+'T04:00:00.000Z');
 assert.ok(game.warnings.some(w=>w.startsWith('npb_score:')));
});

for(const [label,score] of [
 ['wrong game canonical',gamePage('score',{gameId:'2021040001'})],
 ['wrong date',gamePage('score',{day:'2026年10月11日'})],
 ['conflicting home and away identities',gamePage('score',{detail:'<div class="bb-gameDetail"><a href="/npb/teams/6/index">客隊</a><a href="/npb/teams/1/index">主隊</a></div>'})]
])test(`NPB ${label} cannot become a fresh fixture through optional-detail recovery`,async t=>{
 clock(t);const result=await collect({score,top:503});
 assert.deepEqual(result.games,[]);assert.equal(result.status,'partial');assert.ok(result.errors.length);
});

test('NPB missing top clocks cannot authorize unknown pregame fixtures',async t=>{
 clock(t);const result=await collect({score:gamePage('score',{state:'予告先発',clock:null}),top:503});
 assert.equal(result.games.length,1);assert.equal(result.games[0].status,'unknown');assert.equal(result.games[0].startTime,null);
 assert.equal(result.games[0].home.score,null);assert.equal(result.games[0].away.score,null);
});

test('NPB unavailable current-player details preserve valid scoreboard scores and flag the missing detail',async t=>{
 clock(t);const result=await collect({score:gamePage('score',{state:'1回表'}),top:503});
 assert.equal(result.games.length,1);assert.equal(result.status,'ok');assert.deepEqual(result.errors,[]);
 const game=result.games[0];assert.equal(game.status,'live');assert.equal(game.home.score,1);assert.equal(game.away.score,2);
 assert.equal(game.currentBatter,null);assert.equal(game.currentPitcher,null);
 assert.ok(game.warnings.some(w=>w.startsWith('npb_live_detail:')));
});

test('NPB conflicting current innings clear the uncertain inning and preserve the verified score observation',async t=>{
 clock(t);const score=gamePage('score',{state:'1回表'})+'<div id="sbo"><em>2回裏</em></div>';
 const result=await collect({score,top:503});assert.equal(result.status,'ok');assert.equal(result.games.length,1);
 const game=result.games[0];assert.equal(game.status,'live');assert.equal(game.home.score,1);assert.equal(game.away.score,2);
 assert.equal(game.inning,null);assert.equal(game.half,null);assert.equal(game.liveStateObserved,false);
 for(const key of ['balls','strikes','outs','bases','currentBatter','currentPitcher'])assert.equal(game[key],null);
 assert.equal(game.source.url,root+'/score');assert.equal(game.source.fetchedAt,new Date(observed).toISOString());
 assert.ok(game.warnings.some(w=>w.includes('NPB live inning conflict')));
});

test('NPB optional detail failure is healthy in the feed while a later full outage retains the original observation',async t=>{
 clock(t);const fresh=await collect({stats:503});let failed=false,current=observed;
 const feed=createLiveFeed({day:()=>date,now:()=>current,read:async()=>[],write:async()=>({written:1}),collect:async()=>{
  if(failed)throw Error('complete source outage');return fresh;
 }});
 const first=await feed('NPB');assert.equal(first.status,'ok');assert.equal(first.stale,false);assert.equal(first.games[0].sourceStale,false);
 assert.equal(first.error,undefined);const sourceTime=first.games[0].source.fetchedAt;
 failed=true;current+=300001;const later=await feed('NPB');
 assert.equal(later.status,'stale');assert.equal(later.games[0].sourceStale,true);assert.equal(later.games[0].source.fetchedAt,sourceTime);
});
