import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {wnbaPage}=await import(moduleUrl('lib/wnba-fetch.ts'));
const {parseWnbaCurrentRoster}=await import(moduleUrl('lib/wnba-current-rosters.ts'));
const {basketballReportNeedsRefresh}=await import(moduleUrl('app/basketball-report-refresh.ts'));
const {enrichWnbaPlayerStrength}=await import(moduleUrl('lib/wnba-player-strength-source.ts'));
const {wnbaTeam}=await import(moduleUrl('lib/wnba.ts'));
const snapshot=JSON.parse(readFileSync('data/wnba-player-strength.json'));
const now=Date.parse(snapshot.capturedAt)+1000;
const game={id:'401918295',home:wnbaTeam('20'),away:wnbaTeam('9'),phase:3,season:2026,state:'scheduled',timeConfirmed:true,neutral:false,start:new Date(now+86400000).toISOString()};
const base={status:'ready',capturedAt:new Date(now).toISOString(),homeForm:{games:20},awayForm:{games:20},expected:{home:86,away:84,total:170,margin:2},probabilities:{home:.55,away:.45},model:'wnba-efficiency-monte-carlo-v2',weightsKey:'0.20000000,0.20000000,0.20000000,0.20000000,0.20000000',totalSigma:15};
const directory=JSON.parse(readFileSync('tests/fixtures/player-strength/wnba-directory.json')).props.pageProps.currentPlayersData;
function roster(team){const slug=team==='20'?'dream':'liberty';return {team:{id:team},season:{year:2026},athletes:directory.filter(p=>p[5]===slug&&p[18]===1&&snapshot.players[p[0]]).map(p=>{const row=snapshot.players[p[0]];return {id:row.sourceId,uid:`s:40~l:59~a:${row.sourceId}`,displayName:row.name};})};}

test('transport failure retries once; forbidden source is not retried',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{if(++calls===1)throw new TypeError('fetch failed');return new Response('ok');});
 assert.equal(await wnbaPage('https://www.wnba.com/players'),'ok');assert.equal(calls,2);
 calls=0;globalThis.fetch=async()=>{calls++;return new Response('Forbidden',{status:403});};
 await assert.rejects(wnbaPage('https://www.wnba.com/players'),/403/);assert.equal(calls,1);
});
test('current roster requires league, team, season and unique verified identities; absence of news stays unknown',()=>{
 const raw=roster('20'),players=parseWnbaCurrentRoster(raw,'20',2026);assert.ok(players.length>=8);assert.ok(players.every(p=>p.status==='unknown'&&!p.minutesConfirmed));
 assert.throws(()=>parseWnbaCurrentRoster(raw,'9',2026));assert.throws(()=>parseWnbaCurrentRoster(raw,'20',2025));
 assert.throws(()=>parseWnbaCurrentRoster({...raw,athletes:[...raw.athletes,raw.athletes[0]]},'20',2026));
 assert.throws(()=>parseWnbaCurrentRoster({...raw,athletes:raw.athletes.map(p=>({...p,uid:p.uid.replace('l:59','l:46')}))},'20',2026));
});
test('waiting or degraded reports retry on the next poll; explicit refresh also retries fresh success',()=>{
 const fresh={game,analysis:base,sourceFetchedAt:base.capturedAt};
 assert.equal(basketballReportNeedsRefresh(game,fresh,now),false);
 assert.equal(basketballReportNeedsRefresh(game,fresh,now,true),true);
 assert.equal(basketballReportNeedsRefresh(game,{...fresh,analysis:{...base,status:'waiting'}},now),true);
 assert.equal(basketballReportNeedsRefresh(game,{...fresh,analysis:{...base,playerContext:{status:'unavailable'}}},now),true);
 assert.equal(basketballReportNeedsRefresh(game,{error:'offline'},now),true);
});
test('official outage uses verified fresh ESPN membership and current statistics without claiming health',async t=>{
 t.mock.method(Date,'now',()=>now);t.mock.method(globalThis,'fetch',async url=>{
  const u=new URL(url);if(u.hostname==='www.wnba.com')return new Response('Forbidden',{status:403});
  assert.equal(u.hostname,'site.api.espn.com');return Response.json(roster(u.pathname.split('/').at(-2)));
 });
 const a=await enrichWnbaPlayerStrength(game,base);assert.equal(a.status,'ready');assert.equal(a.model,'wnba-player-opponent-v3');assert.equal(a.playerContext.recommendationEligible,false);
 assert.ok([...a.playerContext.home,...a.playerContext.away].every(p=>p.status==='unknown'));
});
