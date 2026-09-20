import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync('lib/hr9988.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {parseHrGameDetail,hrBaseballRequest}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));

// Synthetic menu entries test routing; they are not captured CPBL quotes.
test('baseball route uses the supplied pregame menu key, never hot or in-play categories',()=>{
 const menu={code:200,data:{list:[{GameType:2,LeftMenu:{item:[{catid:101,Items:[{WagerTypeKey:98}]}]}},{GameType:3,LeftMenu:{item:[{catid:888888,Items:[{WagerTypeKey:888888}]},{catid:101,Items:[{WagerTypeKey:'7'},{WagerTypeKey:99}]}]}}]}};
 assert.deepEqual(hrBaseballRequest(menu),{GameType:3,CatID:101,WagerTypeKey:'7'});
 menu.data.list[1].LeftMenu.item.pop();assert.equal(hrBaseballRequest(menu),null);
 assert.equal(hrBaseballRequest({code:200,data:{list:[]}}),null);
 assert.throws(()=>hrBaseballRequest({code:200,data:[]}));
 assert.throws(()=>hrBaseballRequest({code:200,data:{list:[{GameType:3,LeftMenu:{item:[{catid:101,Items:[{WagerTypeKey:{}}]}]}}]}}));
});

test('the original captured sample contains only MLB baseball odds',()=>{
 const result=parseHrGameDetail(JSON.parse(readFileSync('tests/fixtures/hr9988-game-detail.json','utf8')),new Date().toISOString());
 assert.equal(result.games.length,4);assert.deepEqual(result.internationalGames,[]);
 assert.deepEqual(result.sourceLeagues,[{name:'MLB 美國職棒',league:'MLB',games:4}]);
});
test('international source events stay separate from unchanged MLB model input',()=>{
 const raw=JSON.parse(readFileSync('tests/fixtures/hr9988-game-detail.json','utf8'));const before=parseHrGameDetail(raw,new Date().toISOString());
 const base=raw.data[0].Items.List[0];
 for(const [i,name] of ['CPBL 中華職棒','NPB 日本職棒','KBO 韓國職棒'].entries()){const l=structuredClone(base);l.LeagueNameStr=name;l.Team=l.Team.slice(0,1);l.Team[0].EvtID=900000+i;raw.data[0].Items.List.push(l);}
 const next=parseHrGameDetail(raw,before.fetchedAt);assert.deepEqual(next.games,before.games);assert.deepEqual(next.internationalGames.map(g=>g.league),['CPBL','NPB','KBO']);assert.equal(next.internationalGames[0].displayMarkets[0].quotes[0].homeLine,base.Team[0].Wager[0].Odds[0].HomeHdp||'');
});
