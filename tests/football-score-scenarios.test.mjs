import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {moduleUrl} from './profile-loader.mjs';
const {footballDistribution}=await import(moduleUrl('lib/football.ts'));
const scenarios=await import(moduleUrl('lib/football-score-scenarios.ts'));
const make=(home,away,rho=0)=>({status:'ready',expected:{home,away},...footballDistribution(home,away,rho)});
const arsenal=()=>make(2.3639225441683607,.8826300407851961,-.003994213685603078);
test('captured Arsenal model selects distinct attacking scenarios without changing any forecast probability',()=>{
 const a=arsenal(),before=JSON.stringify(a),r=scenarios.footballScoreScenarios(a);
 assert.equal(r.mode,'attacking');assert.deepEqual(r.scores.map(s=>[s.label,s.home,s.away]),[['主推',2,0],['進攻',3,1],['大勝',3,0]]);
 assert.ok(Math.abs(r.winBy2Plus-.4756255890491027)<1e-10);
 assert.ok(Math.abs(r.winBy3Plus-.2685904731179839)<1e-10);
 for(const s of r.scores)assert.equal(s.probability,a.scoreDistribution.scores.find(x=>x.home===s.home&&x.away===s.away).probability);
 assert.equal(JSON.stringify(a),before);
});
test('away favourites are symmetrical and never label a home win as the away dominant scenario',()=>{
 const a=arsenal(),b=make(a.expected.away,a.expected.home,a.scoreDistribution.rho);
 const r=scenarios.footballScoreScenarios(b);assert.equal(r.favourite,'away');
 assert.deepEqual(r.scores.map(s=>[s.home,s.away]),[[0,2],[1,3],[0,3]]);
 assert.ok(Math.abs(r.winBy3Plus-scenarios.footballScoreScenarios(a).winBy3Plus)<1e-10);
});
test('close matches and low-scoring favourites keep the original three most likely scores',()=>{
 for(const a of [make(1.762680459444644,1.5339094794510058),make(1.5,1.5),make(1.5,.03)]){
  const r=scenarios.footballScoreScenarios(a);assert.equal(r.mode,'ranked');
  assert.deepEqual(r.scores.map(({label,...s})=>s),a.scores);
 }
});
test('missing, inconsistent or invalid distributions never create aggressive scenarios',()=>{
 const variants=[a=>a.status='waiting',a=>delete a.scoreDistribution,a=>a.expected.home++,a=>a.probabilities.home=.99,a=>a.scoreDistribution.scores[0].probability=NaN,a=>a.scoreDistribution.scores.push(a.scoreDistribution.scores[0]),a=>a.scoreDistribution.scores.splice(0,5)];
 for(const mutate of variants){const a=arsenal();mutate(a);assert.equal(scenarios.footballScoreScenarios(a).mode,'ranked');}
});
const source=ts.transpileModule(fs.readFileSync('app/football-recommendations.tsx','utf8'),{fileName:'recommendations.tsx',compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const component=new Function('require','exports','React',source+'\nreturn exports.FootballAnalysisNumbers;')(key=>{
 if(key==='react')return React;
 if(key==='@/lib/football-score-scenarios')return scenarios;
 if(['react-dom','@/lib/football-team-profile','@/lib/football-recommendations','./super-workspace','./sport-markets'].includes(key))return {};
 throw Error('Unexpected import '+key);
},{},React);
test('shared card and floating panel renderer labels scenario probabilities and margin probabilities separately',()=>{
 const html=renderToStaticMarkup(React.createElement(component,{analysis:arsenal()}));
 for(const text of ['data-score-mode="attacking"','三組比分情境','主推','進攻','大勝','70.3%','47.6%','26.9%','10.9%','7.6%','8.6%'])assert.ok(html.includes(text),text);
 const close=renderToStaticMarkup(React.createElement(component,{analysis:make(1.76,1.53)}));
 assert.ok(close.includes('三組比分預測'));assert.ok(!close.includes('大勝'));
});
