import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleUrl} from './profile-loader.mjs';

const {sportTeamKey,sportMarketStatus}=await import(moduleUrl('lib/sport-super-markets.ts'));
// Reconstructed from the two user screenshots supplied on October 16.
// IDs and capture time are test metadata; these are not a live source response.
const now=Date.parse('2026-10-16T12:06:26Z');
const fixture={id:'screenshot-fulham-hull',league:'eng.1',start:'2026-10-17T14:00:00Z',timeConfirmed:true,state:'scheduled',home:{name:'富勒姆'},away:{name:'赫爾城'}};
const source=()=>({source:'screenshot-replay',fetchedAt:new Date(now).toISOString(),sportGames:[{
 id:1,league:'FOOTBALL',competition:'eng.1',live:false,start:'2026/10/17 22:00:00',home:'富勒姆(主)',away:'侯城',
 displayMarkets:[
  {period:'full',type:101,quotes:[{primary:true,open:true,homeLine:'0.5/1',awayLine:'',homePrice:.892,awayPrice:1.020}]},
  {period:'full',type:102,quotes:[{primary:true,open:true,total:'2.5/3',over:.990,under:.900}]},
  {period:'full',type:110,quotes:[{primary:true,open:true,homePrice:.676,awayPrice:3.895,drawPrice:3.010}]},
 ]
}]});

test('reported Fulham versus Hull card exposes all three full-game markets',()=>{
 const result=sportMarketStatus(source(),fixture,'FOOTBALL',now);
 assert.equal(result.code,'matched');
 assert.equal(result.availableCount,3);
 assert.deepEqual(result.event.spread.parts,[-.5,-1]);
 assert.deepEqual(result.event.total.parts,[2.5,3]);
 assert.equal(result.event.moneyline.home,.676);
 assert.equal(result.event.moneyline.away,3.895);
 assert.equal(result.event.moneyline.draw,3.010);
 const closed=source();closed.sportGames[0].displayMarkets[0].quotes[0].open=false;
 const status=sportMarketStatus(closed,fixture,'FOOTBALL',now);
 assert.equal(status.availableCount,2);assert.equal(status.markets.spread.code,'closed');
});

test('Hull alias uses the exact senior football identity, including home markers',()=>{
 for(const name of ['侯城',' 侯城（主） ','Hull City','赫爾城'])assert.equal(sportTeamKey(name,'FOOTBALL'),'赫爾城');
 for(const name of ['侯城U21','侯城女足','侯城二隊'])assert.notEqual(sportTeamKey(name,'FOOTBALL'),'赫爾城');
 for(const sport of ['NBA','WNBA'])assert.notEqual(sportTeamKey('侯城',sport),'赫爾城');
});

test('Hull pairing keeps opponent, orientation, kickoff, league and freshness checks',()=>{
 for(const patch of [{away:{name:'曼城'}},{home:fixture.away,away:fixture.home},{start:'2026-10-18T14:00:00Z'},{league:'uefa.champions'}]){
  assert.equal(sportMarketStatus(source(),{...fixture,...patch},'FOOTBALL',now).event,null);
 }
 assert.equal(sportMarketStatus(source(),fixture,'FOOTBALL',now+150000).event,null);
 const duplicate=source();duplicate.sportGames.push({...duplicate.sportGames[0],id:2});
 assert.equal(sportMarketStatus(duplicate,fixture,'FOOTBALL',now).code,'fixture_ambiguous');
});
