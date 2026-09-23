import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectCpblSchedule,collectCpblCurrent,parseCpblCurrent} from '../server/cpbl-current.mjs';
import {createLiveFeed} from '../server/baseball-live-feed.mjs';
import {createBaseballRefreshLoops} from '../server/baseball-refresh-loop.mjs';
const ids=['cpbl.t.1','cpbl.t.2','cpbl.t.5','cpbl.t.6','cpbl.t.7','cpbl.t.8'];
const date='2026-09-23',at='2026-09-23T07:00:00Z';
const row=(teamId,day)=>({gameId:'cpbl.g.'+day.replaceAll('-','').slice(2)+'001',seasonPhase:'REGULAR_SEASON',status:'PREGAME',startTime:day+'T18:35:00+08:00',homeTeamId:teamId,awayTeamId:ids[(ids.indexOf(teamId)+1)%6],alias:{url:'https://tw.sports.yahoo.com/cpbl/test-'+day.replaceAll('-','').slice(2)+'001/'}});
const html=rows=>'<script>self.__next_f.push('+JSON.stringify([1,'0:'+JSON.stringify(rows)+'\n'])+')</script>';
// Each team's matching schedule entries also appear on its opponent's page.
const fixtures=[['2026-09-22',0],['2026-09-24',10]].flatMap(([day,offset])=>[0,2,4].map((n,i)=>{const r=row(ids[n],day);r.gameId=r.gameId.slice(0,-3)+String(offset+i+1).padStart(3,'0');r.alias.url='https://tw.sports.yahoo.com/cpbl/test-'+r.gameId.slice(7)+'/';return r;}));
const pages=()=>ids.map(teamId=>({teamId,page:{url:'https://tw.sports.yahoo.com/cpbl/teams/'+teamId+'/',fetchedAt:at,text:html(fixtures.filter(r=>[r.homeTeamId,r.awayTeamId].includes(teamId)))}}));
test('CPBL empty day requires six identified, date-spanning team schedules',()=>{
 const r=inspectCpblSchedule(pages(),date);assert.equal(r.matches.length,0);assert.equal(r.proof.teams.length,6);assert.equal(r.nextDate,'2026-09-24');
 assert.equal(inspectCpblSchedule(pages().slice(1),date).proof,null);
 assert.throws(()=>inspectCpblSchedule([{teamId:ids[0],page:{text:'<html>empty</html>'}}],date));
 assert.throws(()=>inspectCpblSchedule([...pages(),pages()[0]],date));
 const future=inspectCpblSchedule(pages(),'2026-09-24');assert.equal(future.matches.length,3);
});
test('CPBL identity or date conflict is rejected, not reported as an off day',()=>{
 const p=pages();p[0].page.text=html([{...fixtures[0],gameId:'cpbl.g.260923001'}]);assert.throws(()=>inspectCpblSchedule(p,date));
});
test('CPBL pregame first-pitcher lineup supplies identity without inventing season statistics',()=>{
 const raw={...fixtures.at(-1),homeTeamLineup:[{positionId:'PITCHER',order:1,player:{playerId:'cpbl.p.100',displayName:'預告先發'}},{positionId:'PITCHER',order:2,player:{playerId:'cpbl.p.101',displayName:'後援'}}]};
 const page={url:raw.alias.url,fetchedAt:at};const g=parseCpblCurrent(raw,page);
 assert.equal(g.starters.home.name,'預告先發');assert.equal(g.starters.home.era,undefined);assert.equal(g.starters.away,null);
 assert.equal(parseCpblCurrent({...raw,homeTeamLineup:[raw.homeTeamLineup[1]]},page).starters.home,null);
 assert.equal(parseCpblCurrent(raw,{...page,fetchedAt:'2026-09-25T07:00:00Z'}).starters.home,null);
});
function feed(fresh,stored=[]){return createLiveFeed({day:()=>date,now:()=>Date.parse(at),read:async()=>stored,write:async()=>{throw Error('must not write empty data');},collect:async()=>fresh});}
const verified=()=>({league:'CPBL',date,games:[],status:'ok',errors:[],collectedAt:at,scheduleProof:inspectCpblSchedule(pages(),date).proof,nextGameDate:'2026-09-24'});
test('CPBL verified empty day is healthy; blank, stale, partial and contradictory results are not',async()=>{
 const ok=await feed(verified())('CPBL');assert.equal(ok.status,'ok');assert.equal(ok.noGames,true);assert.equal(ok.stale,false);
 for(const change of [{scheduleProof:null},{errors:['one team failed']},{status:'partial'}])assert.equal((await feed({...verified(),...change})('CPBL')).status,'unavailable');
 const stale=verified();stale.scheduleProof.teams[0].fetchedAt='2026-09-22T07:00:00Z';assert.equal((await feed(stale)('CPBL')).status,'unavailable');
 const stored={league:'CPBL',date,key:'CPBL:known',source:{fetchedAt:at}};assert.equal((await feed(verified(),[stored])('CPBL')).status,'stale');
 assert.equal((await feed({...verified(),league:'NPB'})('NPB')).status,'unavailable');
});
test('CPBL background warms next game date on a verified empty day; other leagues unchanged',async()=>{
 const jobs=[],calls=[];let clock=Date.parse(at);
 const loop=createBaseballRefreshLoops({day:()=>date,now:()=>clock,schedule:(fn,delay)=>{const j={fn,delay};jobs.push(j);return j;},cancel:()=>{},
 getLive:async league=>league==='CPBL'?{...verified(),noGames:true}:{league,date,games:[{status:'live'}],status:'ok'},getPregame:async(...a)=>calls.push(a)});
 loop.start();for(const j of jobs.splice(0))j.fn();await new Promise(r=>setImmediate(r));assert.deepEqual(calls,[['CPBL','2026-09-24']]);
 clock+=300001;for(const j of jobs.splice(0))j.fn();await new Promise(r=>setImmediate(r));assert.equal(calls.length,2);loop.stop();
});
test('unpublished future detail keeps schedule without inventing a starter or score',async()=>{
 let index=0;const all=pages();
 const r=await collectCpblCurrent({date:'2026-09-24',fetcher:async url=>new Response(url.includes('/teams/')?all[index++].page.text:'<html>detail not published</html>')});
 assert.equal(r.games.length,3);assert.equal(r.errors.length,0);
 for(const g of r.games){assert.equal(g.status,'pregame');assert.equal(g.starters.home,null);assert.equal(g.home.score,null);}
});
