import assert from 'node:assert/strict';
import test from 'node:test';
import {moduleUrl} from './profile-loader.mjs';
const {multifactorWin}=await import(moduleUrl('lib/multifactor-win.ts'));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const now=Date.parse('2026-09-13T12:00:00Z');
const team=id=>({id,wins:70,losses:70,pitcherId:id+100,pitcherEra:4,pitcherWhip:1.3});
const g={id:1,date:'2026-09-14T00:00:00Z',season:2026,home:team(1),away:team(2)};
function report(){const features={};for(const side of ['home','away'])Object.assign(features,{[side+'_starter_recent_era']:4,[side+'_lineup_wrc_plus']:100,[side+'_bullpen_last3_pitches']:100,[side+'_bullpen_back_to_back']:2});return {game:g,capturedAt:new Date(now).toISOString(),features,issues:[],context:{sides:{home:{lineupStatus:'confirmed'},away:{lineupStatus:'confirmed'}}}};}
test('equal inputs are 50/50, full weight budget and unavailable factors stay neutral',()=>{const m=multifactorWin(g,report(),now);assert.equal(m.homeWin,.5);near(m.coverage,100-20/3);near(m.factors.reduce((a,x)=>a+x.weight,0),100);assert.equal(m.ready,true)});
test('better starting pitcher and lineup independently increase home estimate',()=>{const better=structuredClone(g);better.home.pitcherEra=2;assert.ok(multifactorWin(better,report(),now).homeWin>.5);const r=report();r.features.home_lineup_wrc_plus=130;assert.ok(multifactorWin(g,r,now).homeWin>.5)});
test('stale, mismatched, unconfirmed or conflicting reports never recommend',()=>{for(const change of [r=>r.capturedAt=new Date(now-300001).toISOString(),r=>r.game={...g,id:2},r=>r.context.sides.home.lineupStatus='expected',r=>r.issues=['傷兵衝突']]){const r=report();change(r);assert.equal(multifactorWin(g,r,now).ready,false)}});
test('missing data is omitted, not filled or weight redistributed',()=>{const m=multifactorWin(g,undefined,now);near(m.coverage,45+40/3);assert.equal(m.ready,false);assert.equal(m.factors.find(x=>x.name==='九棒對左右投 wRC+').score,null)});
test('contributions reconcile and reversing measured advantages complements',()=>{const r=report();r.features.home_starter_recent_era=2;r.features.home_bullpen_last3_pitches=20;const a=multifactorWin(g,r,now);for(const k of ['starter_recent_era','bullpen_last3_pitches'])[r.features['home_'+k],r.features['away_'+k]]=[r.features['away_'+k],r.features['home_'+k]];const b=multifactorWin(g,r,now);assert.ok(Math.abs(a.homeWin+b.homeWin-1)<1e-10);assert.equal(a.homeWin,.5+a.factors.reduce((s,f)=>s+f.contribution,0)/100)});
