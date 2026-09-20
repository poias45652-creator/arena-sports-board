import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const url=s=>'data:text/javascript;base64,'+Buffer.from(s).toString('base64');
const code=f=>ts.transpileModule(readFileSync('lib/'+f,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {parseHrGameDetail}=await import(url(code('hr9988.ts')));
const {internationalMarketOptions}=await import(url(code('international-market-options.ts').replace("'./settlement'",JSON.stringify(url(code('settlement.ts')))).replace("'./market-display'",JSON.stringify(url(code('market-display.ts'))))));
// Synthetic source responses model the two screenshot lines; never imported as live odds.
function fixture(){
 return {code:200,data:[{CatName:'棒球',Items:{List:[{LeagueNameStr:'CPBL 中華職棒',Team:[
  {EvtID:1,HomeTeamStr:'中信兄弟',AwayTeamStr:'味全龍',ScheduleTimeStr:'2026/09/20 15:05:00',Live:false,EvtStatus:1,Wager:[
   {WagerGrpID:0,WagerTypeID:103,Odds:[{GameID:11,Status:1,HomeHdp:'1-5',HomeHdpOdds:'0.950',AwayHdpOdds:'0.950'}]},
   {WagerGrpID:0,WagerTypeID:104,Odds:[{GameID:12,Status:1,OULine:'8+80',OverOdds:'0.930',UnderOdds:'0.930'}]},
   {WagerGrpID:0,WagerTypeID:105,Odds:[{GameID:13,Status:1,OverOdds:'0.940',UnderOdds:'0.940'}]},
  ]},
  {EvtID:2,HomeTeamStr:'統一獅',AwayTeamStr:'富邦悍將',ScheduleTimeStr:'2026/09/20 16:05:00',Live:false,EvtStatus:1,Wager:[
   {WagerGrpID:0,WagerTypeID:103,Odds:[{GameID:21,Status:1,HomeHdp:'1-25',HomeHdpOdds:'0.950',AwayHdpOdds:'0.950'}]},
   {WagerGrpID:0,WagerTypeID:104,Odds:[{GameID:22,Status:1,OULine:'6-30',OverOdds:'0.930',UnderOdds:'0.930'}]},
  ]},
 ]}]}}]};
}
test('CPBL primary spread and total prices preserve source percentages and side signs',()=>{
 const {internationalGames:games,games:mlb}=parseHrGameDetail(fixture(),'2026-09-20T03:45:00Z');
 assert.deepEqual(mlb,[]);
 for(const [i,g] of games.entries()){
  const spread=internationalMarketOptions(g,'CPBL','full','103');
  const total=internationalMarketOptions(g,'CPBL','full','104');
  assert.deepEqual(spread.map(q=>q.lineLabel),i?['主讓 -1-25','客受讓 +1+25']:['主讓 -1-5','客受讓 +1+5']);
  assert.deepEqual(spread.map(q=>q.price),[.95,.95]);
  assert.deepEqual(total.map(q=>q.lineLabel),i?['6-30','6+30']:['8+80','8-80']);
  assert.deepEqual(total.map(q=>q.price),[.93,.93]);
  for(const [period,type] of [['full','111'],['full','106'],['firstHalf','103'],['firstHalf','104'],['firstHalf','105']])assert.deepEqual(internationalMarketOptions(g,'CPBL',period,type),[]);
 }
});
test('closed CPBL primary quotes never promote alternate lines to the displayed main line',()=>{
 const raw=fixture();const wager=raw.data[0].Items.List[0].Team[0].Wager[0];
 wager.Odds.push({...wager.Odds[0],GameID:99,HomeHdp:'1.5'});wager.Odds[0].Status=-1;
 const game=parseHrGameDetail(raw,'2026-09-20T03:45:00Z').internationalGames[0];
 assert.deepEqual(internationalMarketOptions(game,'CPBL','full','103'),[]);
});

test('current group 0/1 and legacy 10/11 encode the same full-game and first-half quotes',()=>{
 const raw=JSON.parse(readFileSync('tests/fixtures/hr9988-game-detail.json','utf8'));
 const before=parseHrGameDetail(raw,'2026-09-20T03:45:00Z');
 for(const league of raw.data[0].Items.List)for(const team of league.Team)for(const w of team.Wager)w.WagerGrpID-=10;
 const after=parseHrGameDetail(raw,before.fetchedAt);
 assert.deepEqual(after,before);
});
test('unknown periods and ambiguous duplicate primary markets stay unavailable',()=>{
 const raw=fixture(),team=raw.data[0].Items.List[0].Team[0];
 team.Wager[0].WagerGrpID=2;
 let game=parseHrGameDetail(raw,'2026-09-20T03:45:00Z').internationalGames[0];
 assert.deepEqual(internationalMarketOptions(game,'CPBL','full','103'),[]);
 team.Wager[0].WagerGrpID=0;team.Wager.push({...team.Wager[0],WagerGrpID:10});
 game=parseHrGameDetail(raw,'2026-09-20T03:45:00Z').internationalGames[0];
 assert.deepEqual(internationalMarketOptions(game,'CPBL','full','103'),[]);
});
