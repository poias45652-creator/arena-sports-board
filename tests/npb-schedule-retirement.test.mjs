import test from 'node:test';
import assert from 'node:assert/strict';
import {npbScheduleProof,isRetiredNpbFixture} from '../server/baseball-npb-schedule.mjs';

// Small synthetic fixtures follow the observed DOM/JSON structure of
// https://baseball.yahoo.co.jp/npb/schedule/?date=2026-10-12, inspected 2026-10-12.
// Scores, identities and bracket layout exercise lifecycle rules, not a live feed.
const day='2026-10-12',at='2026-10-12T09:00:00.000Z',now=Date.parse(at);
const origin='https://baseball.yahoo.co.jp';
const listed={id:'2021039479',homeId:'7',awayId:'8'};
const unplayed={id:'2021039476',homeId:'1',awayId:'3'};
const clone=value=>structuredClone(value);
function bracket(){
 const team=(id,teamId,flag,sub_text)=>({id,url:`${origin}/npb/teams/${teamId}/top`,flag,sub_text});
 const series=(id,children,wins)=>({id,type:'even',family_count:2,status:'activeBottom',children,score_top:String(wins[0]),score_bottom:String(wins[1]),info_url:`${origin}/npb/schedule/first/cs?date=2026-10-10`,info_text:'10/10～'});
 return {title:'CS・日本シリーズトーナメント表',array_list:[{note_text:'CSファーストステージは2戦先勝'}],tournaments:[{content:{
  blocks:[team(1,'5','true','セ・リーグ優勝'),team(3,'1','false','セ・リーグ2位'),team(4,'3','true','セ・リーグ3位'),team(5,'12','','パ・リーグ優勝'),team(7,'7','false','パ・リーグ2位'),team(8,'8','true','パ・リーグ3位')],
  rounds:[{text:'CSファーストステージ'},{text:'CSファイナルステージ'},{text:'日本シリーズ'}],
  section:[[],[series(2,[3,4],[0,2]),series(4,[7,8],[1,2])],[{...series(1,[1,2],[1,0]),family_count:3,info_url:`${origin}/npb/schedule/first/cs?date=2026-10-14`,info_text:'10/14～'}]]
 }}]};
}
function page({cards=[listed],calendar=cards,tournament=bracket(),rowspan=calendar.length}={}){
 const card=g=>`<a class="bb-score__content" href="/npb/game/${g.id}/index"><div class="bb-score__team"><p class="bb-score__homeLogo bb-score__homeLogo--npbTeam${g.homeId}">主</p><p class="bb-score__awayLogo bb-score__awayLogo--npbTeam${g.awayId}">客</p></div></a>`;
 const row=(g,i)=>`<tr class="bb-scheduleTable__row">${i===0?`<th class="bb-scheduleTable__head" rowspan="${rowspan}">10月12日（月）</th>`:''}<td class="bb-scheduleTable__data"><div class="bb-scheduleTable__grid"><div class="bb-scheduleTable__home"><div class="bb-scheduleTable__homeName"><a href="/npb/teams/${g.homeId}/index">主</a></div></div><div class="bb-scheduleTable__info"><p class="bb-scheduleTable__status"><a href="/npb/game/${g.id}/index">試合終了</a></p></div><div class="bb-scheduleTable__away"><div class="bb-scheduleTable__awayName"><a href="/npb/teams/${g.awayId}/index">客</a></div></div></div></td></tr>`;
 return {url:`${origin}/npb/schedule/?date=${day}`,fetchedAt:at,text:`
  <meta property="og:url" content="${origin}/npb/schedule/?date=${day}">
  <nav id="sch_menu"><ul><li class="bb-menuWhite__item--current"><a href="/npb/schedule/first/all">すべて</a></li></ul></nav>
  <h2 class="bb-head01__title">10月12日（月）</h2><nav id="day_nav"><a href="/npb/schedule/first/all?date=2026-10-11">前の日</a><a href="/npb/schedule/first/all?date=2026-10-13">次の日</a></nav>
  <div id="gm_card"><section class="bb-score"><header class="bb-score__head--kind37">CSパ・ファーストステージ</header>${cards.map(card).join('')}</section></div>
  <table id="wk_sche"><tbody>${calendar.map(row).join('')}</tbody></table>
  <script>var data = ${JSON.stringify(tournament)};</script>`};
}
function game(){return {id:unplayed.id,key:'NPB:'+unplayed.id,league:'NPB',date:day,status:'pregame',startTime:'2026-10-12T05:00:00Z',rawStatus:'試合前',
 home:{id:'1',score:null,hits:null,errors:null},away:{id:'3',score:null,hits:null,errors:null},inning:null,half:null,balls:null,strikes:null,outs:null,bases:null,currentBatter:null,currentPitcher:null,
 innings:{home:[],away:[]},batting:{home:[],away:[]},pitching:{home:[],away:[]},source:{provider:'sportsnavi',url:`${origin}/npb/game/${unplayed.id}/top`,fetchedAt:'2026-10-12T03:00:00.000Z'},sourceStale:true};}

test('matching dated cards and nested calendar preserve exact provenance and only prove a 2-0 first-stage sweep',()=>{
 const p=page(),proof=npbScheduleProof(p,day),old=game(),before=clone(old);
 assert.ok(proof);assert.equal(proof.source.fetchedAt,p.fetchedAt);assert.equal(proof.source.url,p.url);
 assert.deepEqual(proof.listedGames,[listed]);
 assert.deepEqual(proof.completedFirstStages,[{startDate:'2026-10-10',thirdGameDate:day,homeId:'1',awayId:'3',winnerId:'3',eliminatedId:'1',wins:[0,2],sourceUrl:`${origin}/npb/schedule/first/cs?date=2026-10-10`}]);
 assert.equal(isRetiredNpbFixture(old,proof,now),true);assert.deepEqual(old,before);
 assert.equal(isRetiredNpbFixture({...old,status:'unknown',rawStatus:'見どころ'},proof,now),true);
 // No opaque game ID is guessed from nearby IDs: exact own URL/key and teams
 // are required, regardless of whether the unplayed ID is numerically adjacent.
 const nonadjacent={...old,id:'8888888888',key:'NPB:8888888888',source:{...old.source,url:`${origin}/npb/game/8888888888/top`}};
 assert.equal(isRetiredNpbFixture(nonadjacent,proof,now),true);
});

test('a still-listed game is retained and a 2-1 series never retires its played third game',()=>{
 const proof=npbScheduleProof(page({cards:[listed,unplayed]}),day);
 assert.ok(proof);assert.equal(isRetiredNpbFixture(game(),proof,now),false);
 const pacific={...game(),id:listed.id,key:'NPB:'+listed.id,home:{id:'7',score:null},away:{id:'8',score:null},source:{...game().source,url:`${origin}/npb/game/${listed.id}/top`}};
 assert.equal(isRetiredNpbFixture(pacific,npbScheduleProof(page(),day),now),false);
 for(const fixture of [{...unplayed,id:'8888888888'},{id:'8888888888',homeId:'3',awayId:'1'}]){
  const reissued=npbScheduleProof(page({cards:[listed,fixture]}),day);assert.ok(reissued);assert.equal(isRetiredNpbFixture(game(),reissued,now),false);
 }
});

test('partial, empty, ambiguous, wrong-date and wrong-year calendar evidence cannot retire a fixture',()=>{
 const inputs=[
  {...page(),url:`${origin}/npb/schedule/?date=2026-10-11`},
  {...page(),text:page().text.replace('property="og:url"','property="other"')},
  {...page(),text:page().text.replace('date=2026-10-12','date=2025-10-12')},
  {...page(),text:page().text.replace('<h2 class="bb-head01__title">10月12日（月）','<h2 class="bb-head01__title">10月11日（日）')},
  {...page(),text:page().text.replace('date=2026-10-11','date=2025-10-11')},
  {...page(),text:page().text.replace('href="/npb/schedule/first/all"','href="/npb/schedule/first/league"')},
  page({cards:[]}),page({calendar:[]}),page({rowspan:2}),page({cards:[listed,listed]}),
  page({calendar:[{...listed,homeId:'1'}]}),page({calendar:[listed,unplayed]}),
  {...page(),text:page().text.replace('id="wk_sche"','id="unrelated"')},
  {...page(),text:page().text.replace('class="bb-scheduleTable__head" rowspan="1">10月12日（月）','class="bb-scheduleTable__head" rowspan="1">10月11日（日）')},
  {...page(),text:page().text.replace('var data = {','var data = {unquoted:1,')},
  {...page(),text:page().text+`<script>var data = ${JSON.stringify(bracket())};</script>`},
 ];
 for(const p of inputs){const proof=npbScheduleProof(p,day);assert.equal(proof,null);assert.equal(isRetiredNpbFixture(game(),proof,now),false);}
 assert.equal(npbScheduleProof(page(),'2026-02-30'),null);
});

test('bracket wins, winner flag, ranks, stage identity and stage date must all agree',()=>{
 const variants=[
  b=>b.tournaments[0].content.section[1][0].score_top='1',
  b=>b.tournaments[0].content.section[1][0].status='activeTop',
  b=>b.tournaments[0].content.blocks.find(t=>t.id===3).flag='true',
  b=>b.tournaments[0].content.blocks.find(t=>t.id===4).flag='false',
  b=>b.tournaments[0].content.blocks.find(t=>t.id===3).sub_text='パ・リーグ2位',
  b=>b.tournaments[0].content.rounds[0].text='CSファイナルステージ',
  b=>b.tournaments[0].content.section[1][0].family_count=3,
  b=>b.tournaments[0].content.section[1][0].info_url=`${origin}/npb/schedule/first/cs?date=2025-10-10`,
  b=>b.tournaments[0].content.section[1][0].info_url=`${origin}/npb/schedule/first/cs?date=2026-10-09`,
  b=>b.tournaments[0].content.section[1][0].info_text='10/11～',
  b=>b.array_list=[],
 ];
 for(const mutate of variants){const b=bracket();mutate(b);const proof=npbScheduleProof(page({tournament:b}),day);assert.ok(proof);assert.deepEqual(proof.completedFirstStages,[]);assert.equal(isRetiredNpbFixture(game(),proof,now),false);}
 const homeSweep=bracket(),c=homeSweep.tournaments[0].content;c.blocks.find(t=>t.id===3).flag='true';c.blocks.find(t=>t.id===4).flag='false';Object.assign(c.section[1][0],{status:'activeTop',score_top:'2',score_bottom:'0'});
 assert.equal(isRetiredNpbFixture(game(),npbScheduleProof(page({tournament:homeSweep}),day),now),true);
});

test('any observed play, changed identity, future stage or more recent observation keeps the stored fixture',()=>{
 const proof=npbScheduleProof(page(),day);
 const variants=[
  g=>g.status='live',g=>g.status='final',g=>g.status='suspended',g=>g.status='cancelled',
  g=>g.home.score=0,g=>g.away.score=1,g=>g.away.hits=0,g=>g.home.errors=0,
  g=>g.innings.away=[{inning:1,runs:null}],g=>g.batting.home=[{name:'player'}],g=>g.pitching.away=[{name:'player'}],
  g=>g.inning=1,g=>g.half='top',g=>g.outs=0,g=>g.bases=[false,false,false],g=>g.currentBatter={id:'1'},g=>g.currentAtBat={inning:1},
  g=>g.rawStatus='1回表',g=>g.liveStateObserved=true,g=>g.liveChangesVerified=true,
  g=>g.date='2026-10-11',g=>g.league='KBO',g=>g.key='NPB:wrong',g=>g.id='different',
  g=>g.home.id='5',g=>{[g.home,g.away]=[g.away,g.home];},
  g=>g.source.url=`${origin}/npb/game/1111111111/top`,g=>g.source.url+='?index=0110100',
  g=>g.source.fetchedAt='2026-10-12T09:01:00Z',g=>g.source.fetchedAt='invalid',
  g=>g.startTime='2026-10-14T05:00:00Z',g=>g.startTime=null,g=>g.home.score=undefined,
  g=>{g.status='unknown';g.rawStatus='unparsed source state';},
 ];
 for(const mutate of variants){const g=game();mutate(g);assert.equal(isRetiredNpbFixture(g,proof,now),false);}
});

test('old, future, cross-day or malformed proof never replaces newer state or hides a source failure',()=>{
 const original=npbScheduleProof(page(),day);
 const variants=[
  p=>p.source.fetchedAt='2026-10-12T08:44:59Z',p=>p.source.fetchedAt='2026-10-12T09:01:01Z',
  p=>p.date='2026-10-11',p=>p.source.url+='&other=1',p=>p.source.provider='other',p=>p.kind='unknown',
  p=>p.listedGames=[],p=>p.listedGames.push(clone(listed)),p=>p.listedGames[0].homeId='999',
  p=>p.completedFirstStages[0].wins=[1,2],p=>p.completedFirstStages[0].winnerId='1',
  p=>p.completedFirstStages[0].startDate='2026-10-11',p=>p.completedFirstStages[0].thirdGameDate='2026-10-13',
  p=>p.completedFirstStages.push(clone(p.completedFirstStages[0])),
 ];
 for(const mutate of variants){const proof=clone(original);mutate(proof);assert.equal(isRetiredNpbFixture(game(),proof,now),false);}
 assert.equal(isRetiredNpbFixture(game(),original,Date.parse('2026-10-13T00:00:00Z')),false);
 assert.equal(isRetiredNpbFixture(game(),null,now),false);
});

test('tournament JSON is read without executing adjacent source JavaScript',()=>{
 const p=page();p.text=p.text.replace('</script>','globalThis.__npbScheduleExecuted = true;</script>');
 assert.equal(globalThis.__npbScheduleExecuted,undefined);assert.ok(npbScheduleProof(p,day));assert.equal(globalThis.__npbScheduleExecuted,undefined);
});
