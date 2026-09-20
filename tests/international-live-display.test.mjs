import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleUrl} from './profile-loader.mjs';
const {internationalInningRecords,internationalBatter}=await import(moduleUrl('lib/international-live-display.ts'));
const fixture=()=>({key:'KBO:fixture',status:'live',inning:3,half:'top',innings:{away:[{inning:1,runs:1},{inning:2,runs:0},{inning:3,runs:2}],home:[{inning:1,runs:0},{inning:2,runs:1},{inning:3,runs:0}]},lineups:{away:[],home:[]},batting:{away:[],home:[]}});
test('inning summaries use the score at each half inning and exclude future zeroes',()=>{
 const rows=internationalInningRecords(fixture());
 assert.deepEqual(rows.map(r=>[r.inning,r.half,r.awayScore,r.homeScore]),[[1,'top',1,0],[1,'bottom',1,0],[2,'top',1,0],[2,'bottom',1,1],[3,'top',3,1]]);
 assert.equal(rows.at(-1).active,true);assert.equal(rows[0].active,false);
 assert.ok(rows.every(r=>!('batter' in r)&&!('outs' in r)&&!('bases' in r)));
});
test('missing or conflicting innings never become fabricated cumulative scores',()=>{
 const g=fixture();g.innings.away[0].runs=null;let r=internationalInningRecords(g);
 assert.equal(r.find(x=>x.inning===3).awayScore,null);
 assert.equal(r.find(x=>x.inning===3).homeScore,1);
 g.innings.away[0].runs=1;g.innings.away.push({inning:1,runs:2});r=internationalInningRecords(g);
 assert.equal(r.some(x=>x.inning===1&&x.half==='top'),false);assert.equal(r.at(-1).awayScore,null);
 g.status='pregame';assert.deepEqual(internationalInningRecords(g),[]);
});
test('extra innings remain separate and missing home halves are not invented',()=>{
 const g=fixture();g.status='final';g.innings.away.push({inning:10,runs:1});
 const rows=internationalInningRecords(g);assert.equal(rows.at(-1).inning,10);assert.equal(rows.at(-1).half,'top');assert.equal(rows.at(-1).awayScore,null);
});
test('current batter matches the batting side and player ID, including zero-valued stats',()=>{
 const g=fixture();g.currentBatter={id:'a',name:'同名選手'};g.batting.away=[{id:'a',name:'同名選手',stats:{HITS:0}},{id:'b',name:'同名選手',stats:{HITS:3}}];g.batting.home=[{id:'a',name:'同名選手',stats:{HITS:9}}];g.lineups.away=[{id:'a',name:'同名選手',order:2}];
 assert.equal(internationalBatter(g).stats.HITS,0);assert.equal(internationalBatter(g).order,2);
 g.currentBatter=null;assert.equal(internationalBatter(g),null);
});
