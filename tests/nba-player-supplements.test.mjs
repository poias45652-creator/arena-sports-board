import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {moduleUrl} from './profile-loader.mjs';
const official=await import(moduleUrl('lib/nba-official.ts'));
const {nbaPlayerSupplement}=await import(moduleUrl('lib/nba-player-supplements.ts'));
const {playerPhoto,positionZh}=await import(moduleUrl('lib/nba-profile.ts'));
const {nbaTeamHref}=await import(moduleUrl('lib/nba.ts'));
const records=JSON.parse(readFileSync('data/nba-player-supplements.json','utf8'));
const raw=(row,info={},stats={})=>({props:{pageProps:{player:{info:{PERSON_ID:row.id,DISPLAY_FIRST_LAST:row.name,SEASON_EXP:0,...info},stats,gameLogs:[]}}}});

test('supplements require matching NBA ID and full name, not a team or fuzzy name match',()=>{
 assert.equal(nbaPlayerSupplement(1643620,'Tucker DeVries')?.bio.height,'6-7');
 assert.equal(nbaPlayerSupplement(1643620,'Tucker Smith'),null);
 assert.equal(nbaPlayerSupplement(1,'Tucker DeVries'),null);
});
test('verified profiles use explicit photo sources and separate sourced NCAA season averages',()=>{
 assert.ok(records.length>=4);assert.equal(new Set(records.map(r=>r.id)).size,records.length);
 for(const row of records){
  const p=official.parseOfficialPlayer(raw(row),row.id);
  if(row.photo.path){assert.equal(p.photo,row.photo.path);assert.match(p.photoFallback,/cdn.nba.com\/headshots\/nba/);if(p.photo.startsWith('/'))assert.ok(existsSync('public'+p.photo));else assert.match(p.photo,/^https:\/\//);}
  assert.deepEqual(p.stats,{season:'',points:null,rebounds:null,assists:null});
  assert.equal(p.games.length,0);if(p.supplement.collegeStats){const stats=p.supplement.collegeStats;assert.equal(stats.league,'NCAA');assert.match(stats.season,/^20\d\d–\d\d$/);assert.match(stats.sourceUrl,/^https:\/\//);for(const key of ['points','rebounds','assists'])assert.ok(stats[key]===null||stats[key]>=0&&stats[key]<=40);} 
 }
});
test('upstream NBA bio and performance remain authoritative; missing roster index still gets verified bio',()=>{
 const row=records.find(r=>r.id===1643620);
 const p=official.parseOfficialPlayer(raw(row,{HEIGHT:'6-8',WEIGHT:'220',POSITION:'Guard',COUNTRY:'USA'},{PLAYER_ID:row.id,TimeFrame:'2026-27',PTS:7.4,REB:2.1,AST:1.6}),row.id);
 assert.equal(p.height,'6-8');assert.equal(p.weight,'220');assert.equal(p.position,'Guard');
 assert.deepEqual(p.stats,{season:'2026-27',points:7.4,rebounds:2.1,assists:1.6});
 const roster=official.enrichNbaRoster([{id:row.id,name:row.name,height:'',weight:'',position:'',school:'Indiana'}],1610612738,null)[0];
 assert.equal(roster.height,'6-7');assert.equal(roster.weight,'215');assert.equal(roster.position,'F');assert.equal(roster.country,'USA');
 assert.equal(roster.averages,undefined);assert.equal(roster.supplementalStats.points,13.7);
});

function component(file,name){
 const ast=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);assert.ok(fn);
 const code=ts.transpileModule(fn.getText(ast).replace('export function','function'),{compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
 return new Function('React','playerPhoto','positionZh','nbaTeamHref','value',code+`;return ${name};`)(React,playerPhoto,positionZh,nbaTeamHref,v=>v===null?'—':v);
}
test('profile labels the NCAA fallback and keeps NBA averages when they become available',()=>{
 const Summary=component('app/nba-player-profile.tsx','PlayerSummary'),row=records[1];
 const render=data=>renderToStaticMarkup(React.createElement(Summary,{data}));
 const p=official.parseOfficialPlayer(raw(row),row.id),html=render(p);
 assert.match(html,/NCAA · 2025–26 · Indiana/);assert.match(html,/13\.7/);assert.match(html,/images\/players\/nba\/1643620-cutout.png/);
 assert.match(html,/NBA 場均數據尚未公布/);
 const nba=render({...p,stats:{season:'2026-27',points:7.4,rebounds:2.1,assists:1.6}});
 assert.match(nba,/NBA · 2026-27/);assert.match(nba,/7\.4/);assert.doesNotMatch(nba,/NCAA|13\.7/);
 const partial=render({...p,stats:{season:'2026-27',points:0,rebounds:null,assists:null}});
 assert.doesNotMatch(partial,/NCAA|13\.7/);
});

test('college schools fill upstream dash placeholders and unverified nationality remains missing',()=>{
 const row=records.find(r=>r.id===1643772);assert.ok(row);
 const p=official.parseOfficialPlayer(raw(row,{SCHOOL:'-',COUNTRY:null}),row.id);
 assert.equal(p.school,'Texas A&M');assert.equal(p.country,'');assert.equal(p.height,'6-8');
 assert.equal(official.enrichNbaRoster([{id:row.id,name:row.name,school:'-'}],1610612739,null)[0].school,'Texas A&M');
});
test('multi-season summaries are never labeled as a single NCAA season',()=>{
 const bruce=records.find(r=>r.id===1643570);assert.equal(bruce?.collegeStats??null,null);
});
