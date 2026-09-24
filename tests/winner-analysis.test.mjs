import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleUrl} from './profile-loader.mjs';
const {winnerAnalysis,winnerParlayProbability}=await import(moduleUrl('lib/winner-analysis.ts'));
const now=Date.parse('2026-09-24T12:00:00Z');
const team=id=>({id,wins:80,losses:70,pitcherId:id+100,pitcherEra:4,pitcherWhip:1.3});
const game=()=>({id:1,date:'2026-09-25T00:00:00Z',season:2026,gameType:'R',state:'Preview',status:'Scheduled',home:{...team(1),pitcherEra:2},away:team(2)});
test('usable preliminary data can recommend while retaining partial status and missing factors',()=>{const a=winnerAnalysis(game(),undefined,now,true);assert.equal(a.canRecommend,true);assert.equal(a.status,'preliminary');assert.equal(a.ready,false);assert.equal(a.favoredSide,'home');assert.ok(a.missing.length>0);});
test('started games, stale schedules, missing core data and tied estimates cannot recommend',()=>{for(const change of [g=>g.state='Live',g=>g.date=new Date(now-1).toISOString(),g=>g.home.pitcherId=null,g=>g.home.pitcherWhip=null,g=>g.home.pitcherEra=4]){const g=game();change(g);assert.equal(winnerAnalysis(g,undefined,now,true).canRecommend,false);}assert.equal(winnerAnalysis(game(),undefined,now,false).canRecommend,false);});
test('expired, mismatched and conflicting reports remain blocked',()=>{for(const change of [r=>r.capturedAt=new Date(now-300001).toISOString(),r=>r.game.home.pitcherId=999,r=>r.issues=['先發投手來源不一致']]){const g=game(),r={game:structuredClone(g),capturedAt:new Date(now).toISOString(),features:{},issues:[]};change(r);const a=winnerAnalysis(g,r,now,true);assert.equal(a.canRecommend,false);assert.equal(a.status,'blocked');}});

test('partial estimates produce a combined probability without promoting input completeness',()=>{
 const estimates=[.717,.687,.616].map(homeWin=>({analysis:{...winnerAnalysis(game(),undefined,now,true),homeWin},side:'home'}));
 assert.ok(Math.abs(winnerParlayProbability(estimates,3)-0.303428664)<1e-10);
 assert.equal(estimates[0].analysis.status,'preliminary');
 assert.equal(winnerParlayProbability([{analysis:{canEstimate:true,homeWin:.3},side:'away'}],1),.7);
});
test('incomplete, blocked and invalid parlay inputs never display an invented probability',()=>{
 const leg={analysis:{canEstimate:true,homeWin:.6},side:'home'};
 assert.equal(winnerParlayProbability([leg],3),null);
 for(const p of [null,NaN,Infinity,-.1,1.1])assert.equal(winnerParlayProbability([{...leg,analysis:{canEstimate:true,homeWin:p}}],1),null);
 assert.equal(winnerParlayProbability([{...leg,analysis:{canEstimate:false,homeWin:.6}}],1),null);
});
