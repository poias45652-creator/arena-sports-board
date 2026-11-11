import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleUrl} from './profile-loader.mjs';
import {visibleTrialHistory,trialRecommendation,trialOutcomeLabel} from '../public/ui/homepage-data.js';
const {savedTrialHistory}=await import(moduleUrl('lib/free-trial-history.ts'));
const now=Date.parse('2026-11-11T10:00:00Z');
const leagues=[{code:'MLB',sport:'baseball',name:'MLB'},{code:'NBA',sport:'basketball',name:'NBA'},{code:'eng.1',sport:'football',name:'英超'}];
function saved(i,sport='baseball',result='hit'){
 const day='2026-11-'+String(10-i).padStart(2,'0'),league=leagues.find(l=>l.sport===sport).code;
 const game={key:league+':'+i,id:String(i),sport,league,leagueName:league,start:day+'T10:00:00Z',home:'主隊',away:'客隊'};
 const p={state:'final',label:'已完賽',home:result==='miss'?1:3,away:2,observedAt:day+'T13:00:00Z',settleable:true};
 return {day,fixture_key:game.key,fixture:JSON.stringify(game),forecast:JSON.stringify({game,probabilities:{home:.6,away:.4},predictionAt:day+'T09:00:00Z',secret:'must-not-leak'}),progress:JSON.stringify(p)};
}
test('each sport retains the latest five published picks including wins and losses across midnight',()=>{
 const input=leagues.flatMap(l=>Array.from({length:8},(_,i)=>saved(i,l.sport,i%2?'miss':'hit')));
 const rows=savedTrialHistory(input,now);
 assert.equal(rows.length,15);
 for(const {sport}of leagues){
  const group=rows.filter(r=>r.game.sport===sport);assert.equal(group.length,5);
  assert.deepEqual(group.map(r=>r.game.id),['0','1','2','3','4']);
  assert.ok(group.some(r=>r.result==='hit'));assert.ok(group.some(r=>r.result==='miss'));
 }
 assert.equal(visibleTrialHistory({history:rows},leagues,now).length,15);
 assert.equal(visibleTrialHistory({history:rows},leagues,now+86400000).length,15);
 assert.ok(!JSON.stringify(rows).includes('must-not-leak'));
});
test('invalid or postgame forecasts are not manufactured into public recommendations',()=>{
 const post=saved(0),flipped=saved(1),broken=saved(2),invalid=saved(3);
 const f=JSON.parse(post.forecast);f.predictionAt=f.game.start;post.forecast=JSON.stringify(f);
 const g=JSON.parse(flipped.fixture);g.home='另一隊';flipped.fixture=JSON.stringify(g);
 broken.forecast='{bad';
 const p=JSON.parse(invalid.forecast);p.probabilities={home:.9,away:.9};invalid.forecast=JSON.stringify(p);
 assert.deepEqual(savedTrialHistory([post,flipped,broken,invalid],now),[]);
 const row=saved(0);assert.equal(savedTrialHistory([row,row],now).length,1);
});
test('final scores grade both outcomes and missing/non-final scores stay pending',()=>{
 const win=saved(0),loss=saved(1,'baseball','miss'),pending=saved(2),stale=saved(3);
 pending.progress=JSON.stringify({...JSON.parse(pending.progress),state:'live',home:1,away:2});
 stale.progress=JSON.stringify({...JSON.parse(stale.progress),stale:true});
 const rows=savedTrialHistory([win,loss,pending,stale],now);
 assert.deepEqual(rows.map(trialOutcomeLabel),['命中','未命中','進行中','命中']);
 assert.equal(trialRecommendation(rows[0]),'主隊 勝');
});
