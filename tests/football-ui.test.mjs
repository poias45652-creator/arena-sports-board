import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {moduleUrl} from './profile-loader.mjs';

const football=await import(moduleUrl('lib/football.ts'));
const reports=await import(moduleUrl('lib/football-recommendations.ts'));
const refresh=await import(moduleUrl('app/football-report-refresh.ts'));
const scenarios=await import(moduleUrl('lib/football-score-scenarios.ts'));
const profile=await import(moduleUrl('lib/football-team-profile.ts'));
function component(file,dependencies){
  const code=ts.transpileModule(readFileSync(file,'utf8'),{fileName:file,compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  return new Function('require','exports','React',code+'\nreturn exports;')(key=>{if(key in dependencies)return dependencies[key];throw Error('Unmapped dependency '+key);},{},React);
}
function declaration(file,name,scope){
  const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const node=source.statements.find(x=>ts.isFunctionDeclaration(x)&&x.name?.text===name);
  const code=ts.transpileModule(node.getText(source).replace(/^export\s+/,''),{fileName:file,compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
  return new Function(...Object.keys(scope),code+'\nreturn '+name+';')(...Object.values(scope));
}
const SportMarkets=component('app/sport-markets.tsx',{'@/lib/sport-super-markets':await import(moduleUrl('lib/sport-super-markets.ts'))}).default;
const FootballTeamIdentity=component('app/football-team.tsx',{'react':React,'@/lib/football-team-profile':profile}).default;
const FootballAnalysisNumbers=declaration('app/football-recommendations.tsx','FootballAnalysisNumbers',{React,...scenarios,percent:n=>(n*100).toFixed(1)+'%'});
const time=value=>new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
const Card=declaration('app/football-board.tsx','FootballCard',{React,...football,...reports,...refresh,FootballTeamIdentity,FootballAnalysisNumbers,SportMarkets,time,RefreshCw:props=>React.createElement('svg',{'aria-hidden':true,...props})});
const fixture=JSON.parse(readFileSync('tests/fixtures/football-qualifying-20261012.json','utf8'));
const now=Date.parse(fixture.capturedAt);
const schedule=fixture.sources.find(s=>s.url.endsWith('uefa.champions/scoreboard?dates=20261013&limit=100')).data;
const game=football.parseFootballEvents(schedule,'uefa.champions').find(g=>g.id==='401915436');
const {reconcileFootballHistory}=await import(moduleUrl('lib/football-history.ts'));
const history=reconcileFootballHistory(fixture.sources.filter(s=>s.data.team).flatMap(s=>football.parseFootballTeamHistory(s.data,s.data.team.id)),[]).games;
const analysis=football.analyzeFootball(game,history,now,history);
const beforeHistory=history.filter(g=>!g.league.endsWith('_qual'));
const waiting=football.analyzeFootball(game,beforeHistory,now,beforeHistory);
const snapshot={fetchedAt:fixture.capturedAt,sportGames:[{league:'FOOTBALL',competition:'eng.1',home:'阿森納',away:'切爾西',start:game.start,live:false,id:'different-fixture'}]};
const base={game,now,unavailable:false,snapshot,oddsError:''};
const render=props=>renderToStaticMarkup(React.createElement(Card,{...base,...props}));

test('recorded Sabah card displays recovered probabilities and three scores independently of unopened markets',()=>{
  assert.equal(analysis.status,'ready');
  const html=render({report:{game,analysis}});
  assert.ok(html.includes((analysis.probabilities.home*100).toFixed(1)+'%'));
  assert.match(html,/三組比分(?:預測|情境)/);assert.equal((html.match(/class="football-score-label"/g)||[]).length,3);
  assert.ok(html.includes('來源尚未提供本場玩法'));
  assert.match(html,/10\/14\s+00:45/);
  assert.ok(html.includes(profile.footballTeamHref(game.league,game.home.id,football.footballDay(game.start)).replaceAll('&','&amp;')));
  assert.ok(!html.includes('分析更新中'));
  assert.ok(!html.includes('全場獨贏'));
  assert.ok(!html.includes('animate-spin'));
});

test('a completed short-history report exposes its exact reason and stays distinct from a retry in flight',()=>{
  assert.equal(waiting.status,'waiting');
  for(const activity of [undefined,'loading']){
    const html=render({report:{game,analysis:waiting},activity});
    assert.ok(html.includes('data-analysis-state="waiting"'));
    assert.ok(html.includes('歷史不足：主隊1場、客隊7場；各需至少5場。'));
    assert.ok(!html.includes('分析更新中'));
    assert.ok(!html.includes('football-probabilities'));
    assert.equal(html.includes('正在重新檢查來源'),!!activity);
  }
});

test('queue, transport failure and an unsupported schedule produce different visible card states',()=>{
  const queued=render({activity:'queued',snapshot:null,oddsLoading:true});
  assert.ok(queued.includes('等待計算分析'));
  assert.ok(queued.includes('玩法資料載入中'));
  assert.ok(queued.includes('animate-spin'));
  const failed=render({report:{game,error:'分析請求逾時，稍後會自動重試。'},oddsError:'玩法來源連線失敗'});
  assert.ok(failed.includes('data-analysis-state="error"'));
  assert.ok(failed.includes('分析請求逾時'));
  assert.ok(failed.includes('玩法來源連線失敗'));
  assert.ok(!failed.includes('animate-spin'));
  const unsupported=render({analysisAvailable:false,notice:'此賽程來源目前沒有分析資料',snapshot:null});
  assert.ok(unsupported.includes('data-analysis-state="unavailable"'));
  assert.ok(unsupported.includes('此賽程來源目前沒有分析資料'));
  assert.ok(unsupported.includes('尚未取得玩法資料'));
  assert.ok(!unsupported.includes('animate-spin'));
});

test('expired and mismatched reports never display probabilities, while same-day kickoff retention remains frozen',()=>{
  const report={game,analysis};
  for(const props of [{report:{game:{...game,start:'2026-10-13T17:45:00Z'},analysis}},{report,now:now+15*60000},{report,unavailable:true}]){
    const html=render(props);assert.ok(!html.includes('football-probabilities'));assert.ok(!html.includes('三組比分'));
  }
  const html=render({game:{...game,state:'live',homeScore:0,awayScore:0},report,now:Date.parse(game.start)+60000,unavailable:true});
  assert.ok(html.includes('賽前預測・保留至今日 24:00'));
  assert.ok(html.includes((analysis.probabilities.home*100).toFixed(1)+'%'));
  assert.match(html,/三組比分(?:預測|情境)/);assert.equal((html.match(/class="football-score-label"/g)||[]).length,3);
  assert.ok(!html.includes('sport-market-details'));
});

if(process.env.FOOTBALL_UI_PREVIEW_PATH){
  const css=['app/globals.css','app/football.css','app/sport-markets.css'].map(p=>readFileSync(p,'utf8').replace(/^@import[^;]+;/gm,'')).join('\n');
  const rows=[render({report:{game,analysis}}),render({report:{game,analysis:waiting}}),render({report:{game,error:'分析請求逾時，稍後會自動重試。'}}),render({activity:'queued',snapshot:null,oddsLoading:true})];
  writeFileSync(process.env.FOOTBALL_UI_PREVIEW_PATH,'<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'\nbody{margin:0;padding:16px;background:#071320;font-family:Arial,sans-serif;color:#e8eef5}</style><div class="football-games">'+rows.join('')+'</div></html>');
}

test('floating recommendations only show loading for actual work and explain unsupported schedules',()=>{
  const Pane=component('app/football-recommendations.tsx',{'react':{useId:()=>':football:'},'react-dom':{createPortal:child=>child},'@/lib/football-team-profile':profile,'@/lib/football-score-scenarios':scenarios,'@/lib/football-recommendations':reports,'./sport-markets':{default:SportMarkets},'./super-workspace':{useSuperWorkspace:()=>({activePane:':football:',host:{}})}}).default;
  const props={snapshot,oddsError:'',games:[game],reports:{},league:game.league,leagueName:'歐冠',day:football.footballDay(game.start),now,sourceFetchedAt:fixture.capturedAt,unavailable:false,loading:false};
  const previous=Date.now;Date.now=()=>now;
  try{
    const renderPane=patch=>renderToStaticMarkup(React.createElement(Pane,{...props,...patch}));
    const idle=renderPane({});assert.ok(idle.includes('目前沒有可用的賽前推薦'));assert.ok(!idle.includes('正在整理'));
    const queued=renderPane({analysisActivity:{[reports.footballFixtureKey(game)]:'queued'}});assert.ok(queued.includes('正在整理足球推薦'));
    const unsupported=renderPane({analysisNotice:'目前的賽程來源尚未提供分析資料。'});assert.ok(unsupported.includes('目前的賽程來源尚未提供分析資料。'));assert.ok(!unsupported.includes('正在整理'));
    const complete=renderPane({reports:{[game.id]:{game,analysis}}});assert.ok(complete.includes((analysis.probabilities.home*100).toFixed(1)+'%'));
  }finally{Date.now=previous;}
});
