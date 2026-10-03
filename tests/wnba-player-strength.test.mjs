import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {moduleUrl} from './profile-loader.mjs';
const m=await import(moduleUrl('lib/wnba-player-strength.ts'));
const core=await import(moduleUrl('lib/basketball-player-strength.ts'));
const official=await import(moduleUrl('lib/wnba-official.ts'));
const w=await import(moduleUrl('lib/wnba.ts'));
const presentation=await import(moduleUrl('lib/nba-analysis.ts'));
const snapshot=JSON.parse(readFileSync('data/wnba-player-strength.json'));
const model=JSON.parse(readFileSync('data/wnba-player-model.json'));
const captured=JSON.parse(readFileSync('tests/fixtures/player-strength/wnba-rosters.json'));
const now=Date.parse(snapshot.capturedAt)+1000;
// Explicit hypothetical availability isolates the calculation; actual captured
// evidence remains unknown and is tested separately below.
const home=captured.home.map(p=>({...p,status:'expected'})),away=captured.away.map(p=>({...p,status:'expected'}));
const game={id:'sdv:401918295',home:w.wnbaTeam('20'),away:w.wnbaTeam('9'),phase:3,season:2026,state:'scheduled',timeConfirmed:true,neutral:false,start:new Date(now+24*3600000).toISOString()};
const base={status:'ready',capturedAt:new Date(now).toISOString(),homeForm:{games:20},awayForm:{games:20},expected:{home:85,away:85,total:170,margin:0},probabilities:{home:.5,away:.5},model:'wnba-efficiency-monte-carlo-v2',weightsKey:'0.20000000,0.20000000,0.20000000,0.20000000,0.20000000',totalSigma:15};

test('WNBA shares the engine with NBA while using its own IDs, coefficients and 200 minutes',()=>{
 for(const preseason of [false,true])for(const e of [home,away])for(const scenario of ['low','central','high']){
  const rows=m.allocateMinutes(e,preseason,scenario);
  assert.ok(Math.abs(rows.reduce((n,p)=>n+p.minutes,0)-200)<1e-7);
  assert.ok(rows.every(p=>p.minutes>=0&&p.minutes<=40));
 }
 const star=home.filter(p=>m.playerRatings[p.id]).reduce((a,b)=>m.playerRatings[a.id].rate>m.playerRatings[b.id].rate?a:b);
 const capped=home.map(p=>p.id===star.id?{...p,minutesCap:10}:p);
 assert.ok(m.allocateMinutes(capped,false,'high').find(p=>p.id===star.id).minutes<=10);
 assert.throws(()=>m.allocateMinutes(home.map(p=>({...p,status:'out'})),false,'central'));
 assert.notDeepEqual(model.coefficients,JSON.parse(readFileSync('data/nba-player-model.json')).coefficients);
});

test('removing a productive WNBA starter redistributes minutes and lowers her team forecast',()=>{
 const star=home.filter(p=>m.playerRatings[p.id]).sort((a,b)=>m.playerRatings[b.id].rate-m.playerRatings[a.id].rate)[0];
 const full=m.applyPlayerStrength(game,base,home,away,now),out=m.applyPlayerStrength(game,base,home.map(p=>p.id===star.id?{...p,status:'out'}:p),away,now);
 assert.equal(full.status,'ready');assert.equal(full.model,'wnba-player-opponent-v3');assert.equal(out.status,'ready');
 assert.ok(full.probabilities.home>out.probabilities.home);
 assert.equal(out.playerContext.home.find(p=>p.id===star.id).minutes,0);
 assert.equal(full.probabilities.home+full.probabilities.away,1);
 assert.ok((full.probabilities.home-.5)*full.expected.margin>=0);
 assert.equal(full.expected.total,base.expected.total);assert.equal(full.totalSigma,base.totalSigma);
 assert.equal(full.playerContext.calibrated,model.regularSeasonValidated);
 assert.ok(presentation.readyNbaAnalysis(game,{game,analysis:full,sourceFetchedAt:base.capturedAt},now,false,base.weightsKey));
 assert.equal(presentation.readyNbaAnalysis(game,{game,analysis:{...full,model:'nba-player-opponent-v3'},sourceFetchedAt:base.capturedAt},now),null);
});

test('opponent strength and neutral venue are actual features and transfers retain individual ratings',()=>{
 const first=m.applyPlayerStrength(game,base,home,away,now);
 const changed=structuredClone(snapshot);changed.teams[game.home.id].sos+=5;
 const engine=core.createPlayerStrengthEngine({league:'WNBA',regulationMinutes:40,model,snapshot:changed});
 const second=engine.applyPlayerStrength(game,base,home,away,now);
 assert.equal(second.playerContext.features[3]-first.playerContext.features[3],5);
 assert.notEqual(second.probabilities.home,first.probabilities.home);
 const neutral=m.applyPlayerStrength({...game,neutral:true},base,home,away,now);assert.equal(neutral.playerContext.features[0],0);
 const incoming=away.find(p=>m.playerRatings[p.id]);
 const moved=m.applyPlayerStrength(game,base,[...home,incoming],away.filter(p=>p.id!==incoming.id),now);
 assert.equal(moved.playerContext.home.find(p=>p.id===incoming.id).rating.sourceId,m.playerRatings[incoming.id].sourceId);
});

test('missing news never means healthy; stale or insufficient player data cannot create a pick',()=>{
 const uncertain=m.applyPlayerStrength(game,base,captured.home,captured.away,now);
 assert.equal(uncertain.status,'ready');assert.equal(uncertain.playerContext.recommendationEligible,false);assert.equal(presentation.nbaPick(game,uncertain),null);
 for(const t of [Date.parse(snapshot.capturedAt)-1,Date.parse(snapshot.capturedAt)+37*3600000])assert.equal(m.applyPlayerStrength({...game,start:new Date(t+3600000).toISOString()},base,home,away,t).status,'waiting');
 const missing=home.map((p,i)=>({...p,id:900000000+i}));assert.equal(m.applyPlayerStrength(game,base,missing,away,now).status,'waiting');
 assert.equal(m.applyPlayerStrength({...game,home:{...game.home,league:'NBA'},away:{...game.away,league:'NBA'}},base,home,away,now),base);
});

test('official WNBA parser checks membership and uses WNBA news IDs and matchup-specific limits',()=>{
 const raw={props:{pageProps:{player:{pid:1,info:{PERSON_ID:1,DISPLAY_FIRST_LAST:'Test Player'},teamSlug:'dream',rosterActive:true,slug:'test-player',rotowireLatestNews:[]}}}};
 const parse=()=>official.parseOfficialWnbaPlayer(raw,1,'dream');
 const p=parse(),news=(update,date=now)=>({...p,news:[{wnbaId:'1',date,update}]});
 assert.equal(official.wnbaPlayerEvidence(news('Available for the game against New York.'),now,['New York']).status,'expected');
 assert.equal(official.wnbaPlayerEvidence(news('Unlikely to play against New York.'),now,['New York']).status,'doubtful');
 assert.equal(official.wnbaPlayerEvidence(news('Will not play against New York.'),now,['New York']).status,'out');
 assert.equal(official.wnbaPlayerEvidence(news('Questionable against New York.'),now,['New York']).status,'questionable');
 assert.equal(official.wnbaPlayerEvidence(news('Limited to 18 minutes against New York.'),now,['New York']).minutesCap,18);
 assert.equal(official.wnbaPlayerEvidence(news('Limited to 45 minutes against New York.'),now,['New York']).minutesCap,undefined);
 for(const date of [now+1,now-73*3600000])assert.equal(official.wnbaPlayerEvidence(news('Available for New York.',date),now,['New York']).status,'unknown');
 assert.equal(official.wnbaPlayerEvidence(news('Available for Las Vegas.'),now,['New York']).status,'unknown');
 assert.throws(()=>official.parseOfficialWnbaPlayer(raw,1,'liberty'));
 raw.props.pageProps.player.info.PERSON_ID=2;assert.throws(parse);
});

test('WNBA official integration bounds requests, caches pages and fails closed on a season mismatch',async()=>{
 const source=await import(moduleUrl('lib/wnba-player-strength-source.ts'));
 const directory=JSON.parse(readFileSync('tests/fixtures/player-strength/wnba-directory.json'));
 const native=globalThis.fetch,oldNow=Date.now;let active=0,peak=0,requests=0;
 Date.now=()=>now;
 const html=data=>new Response(`<script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script>`);
 globalThis.fetch=async input=>{
  const u=new URL(input);assert.equal(u.hostname,'www.wnba.com');requests++;
  if(u.pathname==='/players')return html(directory);
  active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,2));active--;
  const id=Number(u.pathname.split('/')[2]),row=directory.props.pageProps.currentPlayersData.find(r=>r[0]===id);assert.ok(row);
  return html({props:{pageProps:{player:{pid:id,info:{PERSON_ID:id,DISPLAY_FIRST_LAST:`${row[2]} ${row[1]}`},teamSlug:row[5],rosterActive:true,slug:row[3],rotowireLatestNews:[{wnbaId:String(id),date:now,injuredStatus:'PROBABLE',update:'Synthetic availability fixture'}]}}}});
 };
 try{
  const result=await source.enrichWnbaPlayerStrength(game,base);assert.equal(result.status,'ready');assert.equal(result.playerContext.status,'applied');assert.equal(peak,4);
  const before=requests;await source.enrichWnbaPlayerStrength(game,base);assert.equal(requests,before);
  const err=console.error;console.error=()=>{};try{const bad=await source.enrichWnbaPlayerStrength({...game,season:2027},base);assert.equal(bad.status,'waiting');assert.equal(bad.probabilities,undefined);}finally{console.error=err;}
 }finally{globalThis.fetch=native;Date.now=oldNow;}
});

test('player context appears only in the admin renderer while the front keeps its forecast',async()=>{
 const deps={'@/lib/nba':await import(moduleUrl('lib/nba.ts')),'@/lib/nba-analysis':presentation,'@/lib/basketball-score-display':await import(moduleUrl('lib/basketball-score-display.ts'))};
 const code=ts.transpileModule(readFileSync('app/nba-match.tsx','utf8'),{fileName:'nba-match.tsx',compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const component=new Function('require','exports','React',code+';return exports;')(key=>{assert.ok(key in deps);return deps[key];},{},React);
 const analysis=m.applyPlayerStrength(game,base,captured.home,captured.away,now);
 const html=renderToStaticMarkup(React.createElement(component.NbaAnalysisNumbers,{game,analysis}));
 assert.ok(html.includes('球員情境推估'));assert.ok(html.includes('預估比分'));
 assert.ok(!html.includes('球員數據與預估上場'));assert.ok(!html.includes('輪替情境・'));assert.ok(!html.includes('https://www.wnba.com/player/'));
 assert.ok(!html.includes('data-nba-recommendation'));
 const adminCode=ts.transpileModule(readFileSync('app/admin/basketball-player-details.tsx','utf8'),{fileName:'details.tsx',compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const Admin=new Function('exports','React',adminCode+';return exports.default;')({},React);
 const admin=renderToStaticMarkup(React.createElement(Admin,{game,analysis}));
 assert.ok(admin.includes('球員數據與預估上場'));assert.ok(admin.includes('輪替情境・客勝'));assert.ok(admin.includes('輪替情境・主勝'));
 assert.ok(admin.includes('https://www.wnba.com/player/'));assert.ok(!admin.includes('/players/nba/'));assert.ok(admin.includes('未確認'));
});
