import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const m=await import(moduleUrl('lib/wnba-player-strength.ts')),e=await import(moduleUrl('lib/basketball-efficiency.ts')),s=await import(moduleUrl('lib/nba-model-weights.ts')),w=await import(moduleUrl('lib/wnba.ts'));
const snapshot=JSON.parse(readFileSync('data/wnba-player-strength.json')),rosters=JSON.parse(readFileSync('tests/fixtures/player-strength/wnba-rosters.json')),now=Date.parse(snapshot.capturedAt)+1000;
const home=rosters.home.map(p=>({...p,status:'expected'})),away=rosters.away.map(p=>({...p,status:'expected'}));
const game={id:'synthetic-weights',home:w.wnbaTeam('20'),away:w.wnbaTeam('9'),phase:3,season:2026,state:'scheduled',timeConfirmed:true,neutral:false,start:new Date(now+86400000).toISOString()};
test('all five WNBA weights affect the final player model; defaults remain unchanged',()=>{
 const metrics=(patch={})=>({games:20,ortg:105,drtg:105,pace:80,threePct:.33,threeRate:.4,ftRate:.25,observations:Array.from({length:20},(_,i)=>({offense:105+(i%2?4:-4),defense:105+(i%2?5:-5),three:.33+(i%2?.04:-.04),freeThrows:.25+(i%2?.03:-.03),margin:i%2?10:-10})),...patch});
 const h=metrics({ortg:120,drtg:100,threePct:.42,ftRate:.36}),a=metrics();
 const report=weights=>{const c=e.projectEfficiency(h,a,'WNBA',false,weights);return {status:'ready',capturedAt:new Date(now).toISOString(),homeForm:{games:20},awayForm:{games:20},model:'wnba-efficiency-monte-carlo-v2',totalSigma:15,weightsKey:e.weightKey(weights),customWeights:!s.isDefaultNbaWeights(weights),inputs:{calculation:c},expected:{home:c.home,away:c.away,total:c.home+c.away,margin:c.home-c.away},probabilities:{home:.5,away:.5}};};
 const base=report([20,20,20,20,20]),normal=m.applyPlayerStrength(game,base,home,away,now),old=m.applyPlayerStrength(game,{...base,inputs:undefined},home,away,now);
 assert.equal(normal.status,'ready');assert.deepEqual(normal.expected,old.expected);assert.deepEqual(normal.probabilities,old.probabilities);
 for(let i=0;i<5;i++){const weights=[20,20,20,20,20];weights[i]=90;const changed=m.applyPlayerStrength(game,report(weights),home,away,now);assert.equal(changed.status,'ready');assert.notEqual(changed.expected.margin,normal.expected.margin,`weight ${i}`);assert.notEqual(changed.probabilities.home,normal.probabilities.home,`weight ${i}`);assert.equal(changed.playerContext.calibrated,false);}
});
test('saved NBA and WNBA weights use distinct namespaces',()=>{assert.equal(s.basketballWeightStorageKey('NBA'),s.NBA_WEIGHT_STORAGE_KEY);assert.notEqual(s.basketballWeightStorageKey('NBA'),s.basketballWeightStorageKey('WNBA'));});
