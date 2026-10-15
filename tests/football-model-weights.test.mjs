import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {moduleUrl} from './profile-loader.mjs';
const weights=await import(moduleUrl('lib/football-model-weights.ts'));
const {footballModelCatalog}=await import(moduleUrl('lib/football-model-catalog.ts'));
const football=await import(moduleUrl('lib/football.ts'));
const {externalFootballRates}=await import(moduleUrl('lib/football-external-model.ts'));
const {marketFootballRates}=await import(moduleUrl('lib/football-market-core.ts'));
const {nationalExpectedGoals}=await import(moduleUrl('lib/football-national-model.ts'));
test('sliders redistribute all remaining enabled factors, retain 100 percent and isolate family drafts',()=>{
 const v=[10,15,0,0,75],enabled=[true,true,false,false,true],next=weights.rebalanceFootballWeight(v,0,40,enabled);
 assert.deepEqual(v,[10,15,0,0,75]);assert.equal(next[0],40);assert.equal(next.reduce((s,n)=>s+n),100);assert.equal(next[4]/next[1],5);assert.equal(next[2],0);
 const single=weights.rebalanceFootballWeight([100,0,0,0,0],0,20,enabled);assert.deepEqual(single,[20,40,0,0,40]);
});
test('settings reject nonfinite, negative, unsupported, zero and disabled factors',()=>{
 for(const value of [null,{},'{bad',{model:'fake',weights:{}},{model:'auto',weights:{elo:[0,0,0,0,0]}},{model:'auto',weights:{elo:[100,-1,0,0,1]}},{model:'auto',weights:{elo:[NaN,0,0,0,0]}}])assert.equal(weights.parseFootballSettings(value),null);
 const c=footballModelCatalog('uefa.champions',Date.parse('2026-10-15T18:00:00Z'));assert.equal(c.active,'elo');
 assert.equal(weights.validateFootballSettings({model:'recent',weights:{}},c),false);assert.equal(weights.validateFootballSettings({model:'auto',weights:{elo:[0,0,100,0,0]}},c),false);
 assert.equal(weights.validateFootballSettings({model:'auto',weights:{elo:[25,25,0,0,50]}},c),true);
 assert.notEqual(weights.footballSettingsKey('eng.1'),weights.footballSettingsKey('uefa.champions'));
});
test('actual goal and score parameters preserve defaults and make custom factors affect both teams',()=>{
 const p={goalAttack:.2,goalDefense:.3,xgAttack:0,xgDefense:0,elo:1,homeIntercept:.1,awayIntercept:0,blend:1,rho:0,overTilt:0,bttsTilt:0,drawTilt:0};
 assert.equal(weights.footballWeightedParameters(p,undefined,'elo',['goalAttack','goalDefense','xgAttack','xgDefense','elo']),p);
 const custom={model:'auto',weights:{elo:[90,10,0,0,0],score:[90,10,0,0,0]}},a=weights.footballWeightedParameters(p,custom,'elo',['goalAttack','goalDefense','xgAttack','xgDefense','elo']),b=weights.footballWeightedParameters(p,custom,'score',['goalAttack','goalDefense','','','elo']);
 const x=[2,.7,.8,1.5,2,.7,.8,1.5,.4,0],baseline=[2,.7,.8,1.5];assert.notDeepEqual(externalFootballRates(x,baseline,p),externalFootballRates(x,baseline,a));
 assert.notDeepEqual(marketFootballRates([.7,-.2,-.3,.4,.5,0,1.6,1.2],[1.8,.8],p),marketFootballRates([.7,-.2,-.3,.4,.5,0,1.6,1.2],[1.8,.8],b));
 assert.equal(p.elo,1);assert.equal(a.elo,0);
 const game={home:{id:'1'},away:{id:'2'},neutral:false},now=Date.now(),fit={intercept:.2,homeEffect:.2,through:now,teams:{'1':{attack:.8,defense:-.4,games:10,effectiveGames:8,latest:now},'2':{attack:.1,defense:.3,games:10,effectiveGames:8,latest:now}}};
 assert.notDeepEqual(nationalExpectedGoals(game,fit,now),nationalExpectedGoals(game,fit,now,{model:'auto',weights:{elo:[80,20,0,0,0]}}));
});
test('custom Europa weights reach sparse and full source predictions without changing the default path',async t=>{
 const capture=JSON.parse(gunzipSync(readFileSync('tests/fixtures/football-europa-analysis-20261015.json.gz'))),now=Date.parse('2026-10-15T11:40:00Z'),RealDate=Date;
 globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}};t.after(()=>{globalThis.Date=RealDate;});
 t.mock.method(globalThis,'fetch',async url=>{const path=String(url).split('/soccer/')[1],key=path.replace(/&limit=100$/,'&limit=1000'),source=capture.sources.find(s=>s.path===path||s.path===key);if(source)return Response.json(source.data);if(path==='uefa.europa/scoreboard?dates=20261016&limit=100')return Response.json({events:[]});throw Error(path);});
 const {footballGameAnalysis}=await import(moduleUrl('lib/football-source.ts'));
 for(const id of ['401915575','401915570']){const base=await footballGameAnalysis('uefa.europa','2026-10-16',id);if(!base)continue;
  const changed=await footballGameAnalysis('uefa.europa','2026-10-16',id,{model:'auto',weights:{elo:[80,20,0,0,0]}});assert.equal(base.analysis.status,'ready');assert.equal(changed.analysis.status,'ready');assert.notDeepEqual(changed.analysis.probabilities,base.analysis.probabilities);assert.ok(Math.abs(Object.values(changed.analysis.probabilities).slice(0,3).reduce((s,n)=>s+n)-1)<1e-9);
 }
});
