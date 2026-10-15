import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {moduleUrl} from './profile-loader.mjs';
const {parseHrGameDetail,hrSportsRequests,hrBaseballRequest}=await import(moduleUrl('lib/hr9988.ts'));
const {matchSportEvent,settleSportGrid,basketballMarketGrid,footballMarketGrids,sportTeamKey,sportQuoteLabel,preferredSportOutcome}=await import(moduleUrl('lib/sport-super-markets.ts'));
const fixture=()=>JSON.parse(readFileSync(new URL('./fixtures/sport-super-game-details.json',import.meta.url),'utf8'));
const menu=JSON.parse(readFileSync(new URL('./fixtures/sport-super-menu.json',import.meta.url),'utf8'));
const now=Date.parse('2026-10-03T01:00:00+08:00');
const captured=new Date(now).toISOString();
const nba={id:'1',state:'scheduled',timeConfirmed:true,start:'2026-10-04T07:00:00+08:00',home:{name:'多倫多暴龍'},away:{name:'邁阿密熱火'}};
const soccer={id:'2',league:'uefa.nations',state:'scheduled',timeConfirmed:true,start:'2026-10-03T02:45:00+08:00',home:{name:'法國'},away:{name:'義大利'}};
test('menu reads the three supported pregame sports without changing baseball request',()=>{
 assert.deepEqual(hrSportsRequests(menu).map(r=>r.CatID),[101,102,1]);
 assert.equal(hrBaseballRequest(menu).CatID,101);
 const duplicate=structuredClone(menu);duplicate.data.list[0].LeftMenu.item.push(duplicate.data.list[0].LeftMenu.item.find(c=>c.catid===102));
 assert.throws(()=>hrSportsRequests(duplicate));
});
// CatID 31 is the dedicated 冠軍聯賽 category in SUPER's public
// /api/GameInfo/GameOnlyCatID/tw response captured on 2026-10-13.
// The event and all quotes below are synthetic regression data, not live odds.
const championsNow=Date.parse('2026-10-13T10:25:00Z');
const championsGame={id:'test-arsenal-lille',league:'uefa.champions',state:'scheduled',timeConfirmed:true,start:'2026-10-14T03:00:00+08:00',home:{name:'阿森納'},away:{name:'里爾'}};
function championsCategory(){
 const category=structuredClone(fixture().data.find(c=>c.CatID===1));
 category.CatID=31;category.CatName='冠軍聯賽';
 category.Items.List=category.Items.List.slice(0,1);
 const league=category.Items.List[0];league.LeagueNameStr='歐洲冠軍聯賽';league.Team=league.Team.slice(0,1);
 Object.assign(league.Team[0],{EvtID:910031,HomeTeamStr:'阿仙奴(主)',AwayTeamStr:'利爾',ScheduleTimeStr:'2026/10/14 03:00:00',Live:false});
 return category;
}
const championsSnapshot=categories=>parseHrGameDetail({code:200,data:categories},new Date(championsNow).toISOString());
test('dedicated Champions menu is collected even when general football is absent',()=>{
 const input=structuredClone(menu),items=input.data.list[0].LeftMenu.item;
 items.splice(items.findIndex(c=>c.catid===1),1,{catid:31,catName:'冠軍聯賽',Items:[{WagerTypeKey:9}]});
 assert.deepEqual(hrSportsRequests(input).map(r=>r.CatID),[101,102,31]);
 assert.deepEqual(hrSportsRequests(input).at(-1),{GameType:3,CatID:31,WagerTypeKey:9});
 assert.deepEqual(hrBaseballRequest(input),hrBaseballRequest(menu));
 input.data.list[0].GameType=2;assert.deepEqual(hrSportsRequests(input),[]);
 input.data.list[0].GameType=3;items.push(structuredClone(items.find(c=>c.catid===31)));
 assert.throws(()=>hrSportsRequests(input));
});
test('dedicated Champions events reach all three markets with exact cross-day Arsenal/Lille pairing',()=>{
 const snapshot=championsSnapshot([championsCategory()]);
 const matched=matchSportEvent(snapshot,championsGame,'FOOTBALL',championsNow);
 assert.ok(matched);for(const kind of ['spread','total','moneyline'])assert.ok(matched[kind],kind);
 assert.equal(snapshot.games.length,0);assert.equal(snapshot.sportGames.length,1);
 for(const change of [{league:'eng.1'},{start:'2026-10-15T03:00:00+08:00'},{home:championsGame.away,away:championsGame.home},{state:'live'}])assert.equal(matchSportEvent(snapshot,{...championsGame,...change},'FOOTBALL',championsNow),null);
 assert.equal(matchSportEvent(snapshot,championsGame,'FOOTBALL',championsNow+150000),null);
 for(const name of ['歐洲女子冠軍聯賽','歐洲U19冠軍聯賽','其他冠軍聯賽']){
  const category=championsCategory();category.Items.List[0].LeagueNameStr=name;
  assert.equal(matchSportEvent(championsSnapshot([category]),championsGame,'FOOTBALL',championsNow),null);
 }
});
test('identical cross-category Champions copies collapse, but conflicting or same-category duplicates fail closed',()=>{
 const cup=championsCategory(),general=structuredClone(cup);general.CatID=1;general.CatName='足球';
 for(const categories of [[general,cup],[cup,general]]){
  const snapshot=championsSnapshot(categories);assert.equal(snapshot.sportGames.length,1);
  assert.ok(matchSportEvent(snapshot,championsGame,'FOOTBALL',championsNow)?.spread);
 }
 assert.throws(()=>championsSnapshot([cup,cup]));
 assert.throws(()=>championsSnapshot([general,cup,cup]));
 for(const change of [t=>t.AwayTeamStr='其他球隊',t=>t.Wager[0].Odds[0].Status=0,t=>t.ScheduleTimeStr='2026/10/14 04:00:00']){
  const conflict=structuredClone(cup);change(conflict.Items.List[0].Team[0]);
  assert.throws(()=>championsSnapshot([general,conflict]));
 }
});
// Category 932 is deliberately synthetic: the collector must discover the ID
// from the authenticated menu label, rather than assume a production number.
const europaNow=Date.parse('2026-10-15T12:00:00Z');
const europaGame={id:'test-juventus-rennes',league:'uefa.europa',state:'scheduled',timeConfirmed:true,start:'2026-10-23T00:45:00+08:00',home:{name:'尤文圖斯'},away:{name:'雷恩'}};
function europaCategory(){
 const category=championsCategory();category.CatID=932;category.CatName='歐足總歐霸聯賽';
 category.Items.List[0].LeagueNameStr='歐足總歐霸聯賽';
 Object.assign(category.Items.List[0].Team[0],{EvtID:910932,HomeTeamStr:'祖雲達斯(主)',AwayTeamStr:'雷恩',ScheduleTimeStr:'2026/10/23 00:45:00'});
 return category;
}
const europaSnapshot=categories=>parseHrGameDetail({code:200,data:categories},new Date(europaNow).toISOString());
test('Europa category follows the authenticated pregame label and wager key, without a fixed ID',()=>{
 for(const name of ['歐霸','歐足總歐霸聯賽','歐洲足總歐霸聯賽','UEFA Europa League']){
  const input=structuredClone(menu);input.data.list[0].LeftMenu.item.push({catid:932,catName:name,Items:[{WagerTypeKey:'17'}]});
  assert.deepEqual(hrSportsRequests(input).at(-1),{GameType:3,CatID:932,WagerTypeKey:'17'});
  assert.deepEqual(hrBaseballRequest(input),hrBaseballRequest(menu));
  input.data.list[0].GameType=2;assert.deepEqual(hrSportsRequests(input),[]);
 }
 for(const name of ['歐洲協會聯賽','歐霸聯賽U21','歐洲女子聯賽','其他歐霸','熱門']){
  const input=structuredClone(menu);input.data.list[0].LeftMenu.item.push({catid:932,catName:name,Items:[{WagerTypeKey:17}]});
  assert.deepEqual(hrSportsRequests(input),hrSportsRequests(menu));
 }
 for(const id of [888888,0,-1,1.5,'932']){
  const input=structuredClone(menu);input.data.list[0].LeftMenu.item.push({catid:id,catName:'歐霸',Items:[]});
  assert.throws(()=>hrSportsRequests(input));
 }
 const duplicate=structuredClone(menu);duplicate.data.list[0].LeftMenu.item.push(...[932,933].map(catid=>({catid,catName:'歐霸',Items:[]})));
 assert.throws(()=>hrSportsRequests(duplicate));
});
test('Europa category reaches all three markets and retains exact league, time, and team guards',()=>{
 const snapshot=europaSnapshot([europaCategory()]),matched=matchSportEvent(snapshot,europaGame,'FOOTBALL',europaNow);
 assert.ok(matched);for(const kind of ['spread','total','moneyline'])assert.ok(matched[kind],kind);
 for(const change of [{league:'uefa.champions'},{start:'2026-10-16T00:45:00+08:00'},{home:europaGame.away,away:europaGame.home},{home:{name:'尤文圖斯U21'}}])assert.equal(matchSportEvent(snapshot,{...europaGame,...change},'FOOTBALL',europaNow),null);
 assert.equal(matchSportEvent(snapshot,europaGame,'FOOTBALL',europaNow+150000),null);
 for(const label of ['歐洲協會聯賽','歐洲女子聯賽','歐霸聯賽U21']){
  const category=europaCategory();category.Items.List[0].LeagueNameStr=label;
  assert.equal(matchSportEvent(europaSnapshot([category]),europaGame,'FOOTBALL',europaNow),null);
 }
});
test('identical general/Europa events collapse, but conflicting or same-category events are rejected',()=>{
 const cup=europaCategory(),general=structuredClone(cup);general.CatID=1;general.CatName='足球';
 for(const categories of [[cup,general],[general,cup]])assert.equal(europaSnapshot(categories).sportGames.length,1);
 assert.throws(()=>europaSnapshot([cup,cup]));
 for(const change of [t=>t.AwayTeamStr='其他球隊',t=>t.Wager[0].Odds[0].Status=0,t=>t.ScheduleTimeStr='2026/10/23 01:45:00']){
  const conflict=structuredClone(cup);change(conflict.Items.List[0].Team[0]);assert.throws(()=>europaSnapshot([general,conflict]));
 }
});
test('captured Heat primary uses away 1-25 and total 228.5; alternate stays alternate',()=>{
 const snapshot=parseHrGameDetail(fixture(),captured),r=matchSportEvent(snapshot,nba,'NBA',now);
 assert.ok(r);assert.equal(snapshot.games.length,0);
 assert.equal(r.spread.display,'客讓 1-25');assert.equal(r.spread.line,1);assert.equal(r.spread.boundary,.25);
 assert.equal(r.total.line,228.5);assert.equal(r.moneyline.away,.876);
 const q=r.spread;
 assert.equal(settleSportGrid([{value:-1,p:1}],q,'away').partialLoss,1);
 assert.equal(settleSportGrid([{value:-2,p:1}],q,'away').win,1);
 assert.equal(settleSportGrid([{value:1,p:1}],q,'home').win,1);
});
test('football source has separate types, three-way prices and quarter-ball settlement',()=>{
 const r=matchSportEvent(parseHrGameDetail(fixture(),captured),soccer,'FOOTBALL',now);
 assert.ok(r);assert.equal(r.spread.line,-1.25);assert.deepEqual(r.spread.parts,[-1,-1.5]);assert.equal(r.total.line,3);assert.equal(r.moneyline.draw,3.922);
 assert.equal(settleSportGrid([{value:1,p:1}],r.spread,'home').partialLoss,1);
 assert.equal(settleSportGrid([{value:1,p:1}],r.spread,'away').partialWin,1);
 assert.equal(settleSportGrid([{value:3,p:1}],r.total,'over').push,1);
});
test('stale, live, reversed, ambiguous and wrong-competition events fail closed',()=>{
 const snapshot=parseHrGameDetail(fixture(),captured);
 assert.equal(matchSportEvent(snapshot,nba,'NBA',now+150000),null);
 assert.equal(matchSportEvent(snapshot,{...nba,state:'live'},'NBA',now),null);
 assert.equal(matchSportEvent(snapshot,{...nba,home:nba.away,away:nba.home},'NBA',now),null);
 assert.equal(matchSportEvent({...snapshot,sportGames:[...snapshot.sportGames,...snapshot.sportGames]},nba,'NBA',now),null);
 assert.equal(matchSportEvent(snapshot,{...soccer,league:'eng.1'},'FOOTBALL',now),null);
});
test('closed primary cannot promote an open alternate and duplicate markets fail closed',()=>{
 const snapshot=parseHrGameDetail(fixture(),captured),m=snapshot.sportGames[0].displayMarkets.find(m=>m.type===103);
 m.quotes[0].open=false;assert.equal(matchSportEvent(snapshot,nba,'NBA',now).spread,null);
 m.quotes[0].open=true;snapshot.sportGames[0].displayMarkets.push(m);assert.equal(matchSportEvent(snapshot,nba,'NBA',now).spread,null);
});
test('basketball distributions exclude a tied final and conserve settlement mass',()=>{
 const grid=basketballMarketGrid(2,10.5,'margin');assert.ok(!grid.some(r=>r.value===0));
 const r=matchSportEvent(parseHrGameDetail(fixture(),captured),nba,'NBA',now),a=settleSportGrid(grid,r.spread,'home'),b=settleSportGrid(grid,r.spread,'away');
 assert.ok(Math.abs(a.win+a.partialWin+a.push+a.partialLoss+a.loss-1)<1e-9);
 assert.ok(Math.abs(a.win-b.loss)<1e-9);assert.ok(Math.abs(a.partialWin-b.partialLoss)<1e-9);
 assert.equal(basketballMarketGrid(230,undefined,'total').length,0);
 const calibrated=basketballMarketGrid(2,10.5,'margin',.555);assert.ok(Math.abs(calibrated.filter(r=>r.value>0).reduce((n,r)=>n+r.p,0)-.555)<1e-9);
});
test('football rejects an old score distribution after another model changes expectations',()=>{
 const analysis={expected:{home:1,away:1},probabilities:{home:.25,draw:.5,away:.25},scoreDistribution:{home:1,away:1,scores:[{home:2,away:0,probability:.25},{home:0,away:2,probability:.25},{home:1,away:1,probability:.5}]}};
 assert.ok(footballMarketGrids(analysis));assert.equal(footballMarketGrids({...analysis,expected:{home:2,away:1}}),null);
});

test('observed San Marino source spelling matches the official football identity',()=>{
 assert.equal(sportTeamKey('聖馬力諾'),sportTeamKey('聖馬利諾'));
 const snapshot=parseHrGameDetail(fixture(),captured);
 const row=snapshot.sportGames.find(g=>g.league==='FOOTBALL');row.home='白俄羅斯(主)';row.away='聖馬力諾';
 const game={...soccer,home:{name:'白俄羅斯'},away:{name:'聖馬利諾'}};
 assert.ok(matchSportEvent(snapshot,game,'FOOTBALL',now));
});

test('each side displays its own handicap and percentage direction',()=>{
 const r=matchSportEvent(parseHrGameDetail(fixture(),captured),nba,'NBA',now);
 assert.equal(sportQuoteLabel(r.spread,'home'),'主受讓 +1+25');
 assert.equal(sportQuoteLabel(r.spread,'away'),'客讓 -1-25');
 const home={...r.spread,line:-1,boundary:.15,display:'主讓 1+15'};
 assert.equal(sportQuoteLabel(home,'home'),'主讓 -1+15');
 assert.equal(sportQuoteLabel(home,'away'),'客受讓 +1-15');
 const split={...home,line:-.25,boundary:0,parts:[0,-.5],display:'主讓 0/0.5'};
 assert.equal(sportQuoteLabel(split,'home'),'主讓 -0/0.5');
 assert.equal(sportQuoteLabel(split,'away'),'客受讓 +0/0.5');
 const total={...r.total,line:8,boundary:.5,display:'8+50'};
 assert.equal(sportQuoteLabel(total,'over'),'8+50');
 assert.equal(sportQuoteLabel(total,'under'),'8-50');
});

test('Kosovo Austria 2.5 total recommends the higher profit probability like MLB despite a slightly negative EV',()=>{
 const quote={kind:'total',line:2.5,boundary:0,display:'2.5',home:.854,away:1,signature:'regression'};
 const grid=[{value:3,p:.539},{value:2,p:.461}];
 const over=settleSportGrid(grid,quote,'over'),under=settleSportGrid(grid,quote,'under');
 assert.ok(over.ev<0);assert.ok(under.ev<0);assert.equal(preferredSportOutcome([over,under]),0);
 const repriced={...quote,home:.5,away:2};
 assert.equal(preferredSportOutcome([settleSportGrid(grid,repriced,'over'),settleSportGrid(grid,repriced,'under')]),0);
 assert.equal(preferredSportOutcome([under,over]),1);
});
test('preferred sport outcomes include partial wins, ignore refunds, and leave ties or missing data unmarked',()=>{
 const a={win:.32,partialWin:.249,push:0,partialLoss:0,loss:.431,ev:0};
 const b={win:.431,partialWin:0,push:0,partialLoss:.249,loss:.32,ev:0};
 assert.equal(preferredSportOutcome([a,b]),0);
 const push={win:.3,partialWin:0,push:.4,partialLoss:0,loss:.3,ev:0};
 assert.equal(preferredSportOutcome([push,push]),null);
 assert.equal(preferredSportOutcome([a,null]),null);assert.equal(preferredSportOutcome([]),null);
 assert.equal(preferredSportOutcome([{...a,win:NaN},b]),null);
});
