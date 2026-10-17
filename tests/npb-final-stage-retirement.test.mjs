import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {npbScheduleProof,npbFixtureRetirementDecision} from '../server/baseball-npb-schedule.mjs';
import {createLiveFeed} from '../server/baseball-live-feed.mjs';
import {moduleUrl} from './profile-loader.mjs';
const {currentPregame}=await import(moduleUrl('lib/international-current-pregame.ts'));
const {internationalPregameHealth}=await import(moduleUrl('lib/international-pregame-health.ts'));
const date='2026-10-17',at=date+'T06:24:00.000Z',now=Date.parse(at),origin='https://baseball.yahoo.co.jp';
const html=readFileSync('tests/fixtures/npb-final-stage-schedule-20261017.html','utf8');
const page=text=>({url:origin+'/npb/schedule/?date='+date,fetchedAt:at,text});
const proof=(text=html)=>npbScheduleProof(page(text),date);
const old=()=>({id:'2021039489',key:'NPB:2021039489',league:'NPB',date,status:'pregame',startTime:date+'T09:00:00.000Z',
 home:{id:'12',name:'福岡軟銀鷹',score:null},away:{id:'8',name:'北海道日本火腿鬥士',score:null},
 source:{provider:'sportsnavi',url:origin+'/npb/game/2021039489/score',fetchedAt:'2026-10-16T12:14:08.262Z'}});
const played=()=>({...old(),id:'2021039483',key:'NPB:2021039483',status:'live',startTime:date+'T05:00:00.000Z',
 home:{id:'5',name:'阪神虎',score:2},away:{id:'3',name:'橫濱 DeNA 海灣之星',score:1},
 source:{provider:'sportsnavi',url:origin+'/npb/game/2021039483/score',fetchedAt:at}});
function mutateBracket(change){
 const match=html.match(/var data = (\{.*\});<\/script>/),data=JSON.parse(match[1]);change(data);
 return html.replace(match[1],JSON.stringify(data));
}
test('actual 10/17 bracket retires the unneeded Pacific final-stage game with league-specific five-win/two-advantage rules',()=>{
 const p=proof();assert.ok(p);assert.deepEqual(p.listedGames,[{id:'2021039483',homeId:'5',awayId:'3'}]);
 assert.equal(p.completedFinalStages.length,1);const s=p.completedFinalStages[0];
 assert.deepEqual(s.wins,[5,0]);assert.equal(s.targetWins,5);assert.equal(s.advantageWins,2);
 assert.deepEqual(npbFixtureRetirementDecision(old(),p,now),{retired:true,reason:'npb_final_stage_completed'});
});
test('unfinished series, conflicting bracket/rules and ambiguous evidence never remove a fixture',()=>{
 const changes=[
  d=>d.tournaments[0].content.section[2][1].score_top='4',
  d=>d.tournaments[0].content.section[2][1].status='',
  d=>d.tournaments[0].content.section[2][1].status='activeBottom',
  d=>d.tournaments[0].content.section[1][3].status='',
  d=>d.tournaments[0].content.section[1][3].score_bottom='1',
  d=>d.tournaments[0].content.blocks.find(b=>b.id===8).sub_text='セ・リーグ3位',
  d=>d.array_list.splice(2,1),
  d=>d.array_list.push(d.array_list[2]),
  d=>d.array_list[2].note_text=d.array_list[2].note_text.replace('ソフトバンク','阪神'),
  d=>d.tournaments[0].content.section[2][1].info_url=d.tournaments[0].content.section[2][1].info_url.replace('2026','2025'),
  d=>d.tournaments[0].content.section[2][1].info_text='10/15～',
 ];
 for(const change of changes)assert.equal(npbFixtureRetirementDecision(old(),proof(mutateBracket(change)),now).retired,false);
 for(const patch of [{status:'live'},{status:'final'},{home:{id:'12',score:0}},{liveStateObserved:true},{source:{...old().source,fetchedAt:date+'T06:25:00Z'}}])assert.equal(npbFixtureRetirementDecision({...old(),...patch},proof(),now).retired,false);
 const p=proof();p.listedGames.push({id:'2021039489',homeId:'12',awayId:'8'});assert.equal(npbFixtureRetirementDecision(old(),p,now).retired,false);
});
test('feed and pregame archive both retire the ghost, preserve the live game and clear the false partial status after restart',async()=>{
 const stored=old(),before=structuredClone(stored);
 const make=()=>createLiveFeed({day:()=>date,now:()=>now,read:async()=>[stored],write:async()=>({written:1}),collect:async()=>({league:'NPB',date,status:'ok',games:[played()],errors:[],scheduleProof:proof()})});
 for(let i=0;i<2;i++){
  const feed=await make()('NPB');assert.equal(feed.status,'ok');assert.equal(feed.games.length,1);assert.equal(feed.games[0].home.score,2);
  assert.equal(feed.retiredFixtures[0].reason,'npb_final_stage_completed');
  const archived={...stored,start:date+' 17:00:00',source:{observedAt:stored.source.fetchedAt},away:{team:stored.away.name},home:{team:stored.home.name}};
  const archive={league:'NPB',date,games:[archived]},merged=currentPregame('NPB',date,feed,[archive]);
  assert.equal(merged.games.length,0);assert.equal(merged.excludedFixtures.length,1);assert.equal(merged.observedAt,at);
  assert.equal(currentPregame('NPB',date,{games:[]},[archive,merged]).games.length,0);
  assert.equal(internationalPregameHealth(feed,[{status:'started'}]),'ready');
 }
 assert.deepEqual(stored,before);
});
test('a verified offday can retire the same unplayed series fixture but cannot erase played games or hide errors',async()=>{
 const p={...proof(),kind:'npb-verified-offday',noGames:true,listedGames:[]};
 const get=(stored,errors=[])=>createLiveFeed({day:()=>date,now:()=>now,read:async()=>stored,write:async()=>assert.fail('no played rows to write'),collect:async()=>({league:'NPB',date,status:errors.length?'partial':'ok',games:[],errors,scheduleProof:p})})('NPB');
 const feed=await get([old()]);assert.equal(feed.status,'ok');assert.equal(feed.noGames,true);assert.equal(feed.retiredFixtures[0].reason,'npb_final_stage_completed');
 assert.equal((await get([played()])).status,'stale');
 assert.equal((await get([old()],['source unavailable'])).status,'stale');
});
test('following-day offday markup still proves series completion without any hard-coded incident date',()=>{
 const next='2026-10-18',observed=next+'T06:00:00Z',url=origin+'/npb/schedule/?date='+next;
 const text=`<meta property="og:url" content="${url}"><h2 class="bb-head01__title">10月18日（日）</h2>
 <nav id="sch_menu"><li class="bb-menuWhite__item--current"><a href="/npb/schedule/first/all">すべて</a></li></nav>
 <nav id="day_nav"><a href="/npb/schedule/first/all?date=2026-10-17">前</a><a href="/npb/schedule/first/all?date=2026-10-19">次</a></nav>
 <p class="bb-noData">試合はありません</p><table id="wk_sche"><tbody><tr><th class="bb-scheduleTable__head">10月18日（日）</th><td class="bb-scheduleTable__data--nogame">試合はありません</td></tr></tbody></table>
 ${html.match(/<script>var data = .*;<\/script>/)[0]}`;
 const p=npbScheduleProof({text,url,fetchedAt:observed},next),g={...old(),date:next,startTime:next+'T09:00:00Z'};
 assert.equal(p.kind,'npb-verified-offday');assert.equal(p.completedFinalStages.length,1);
 assert.equal(npbFixtureRetirementDecision(g,p,Date.parse(observed)).retired,true);
});
