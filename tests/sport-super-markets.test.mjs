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
