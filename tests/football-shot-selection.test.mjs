import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
const {shotRates} = await import(moduleUrl('lib/football-shot-model.ts'));
const {applyShotSelection,selectDomesticForecast,selectionVersion} = await import(moduleUrl('lib/football-shot-selection.ts'));
const {footballSelectionAudit} = await import(moduleUrl('lib/football-selection-audit.ts'));
const {parseShotCalendar} = await import(moduleUrl('lib/football-shot-calendar.ts'));
const read = name => JSON.parse(readFileSync(name,'utf8'));
test('real ESPN Como fixture agrees with independently calculated log-link rates',()=>{
  const match=read('tests/fixtures/football-shot-espn.json');
  const rates=shotRates(match.features,read('data/football/shot-selection-v1.json'));
  rates.forEach((x,i)=>assert.ok(Math.abs(x-match.rates[i])<1e-12));
});
test('complete xG preserves the distribution; the draw is eligible and an expired fixture cannot qualify',async()=>{
  // Synthetic boundary inputs are used only in unit tests.
  const now=Date.now(),at=new Date(now-1000).toISOString();
  const game={league:'ita.1',timeConfirmed:true,neutral:false,id:'123',state:'scheduled',start:new Date(now+3600000).toISOString()};
  const base={status:'ready',probabilities:{home:.1,draw:.72,away:.18},homeForm:{games:10},awayForm:{games:10},external:{modelApplied:true,homeXgGames:8,awayXgGames:8,fetchedAt:at}};
  const a=await selectDomesticForecast(game,base,()=>assert.fail('unnecessary calendar request'));
  assert.equal(a.probabilities,base.probabilities);assert.equal(a.selection.pick,'draw');
  assert.equal(applyShotSelection({...game,state:'live'},base,[],at,now),base);
  assert.equal(applyShotSelection(game,{...base,external:undefined},[],at,now).selection,undefined);
  assert.throws(()=>parseShotCalendar({events:[],leagues:[{slug:'eng.1'}]},'ita.1',2026));
});
test('the settled ledger counts the latest capture once, including later withdrawal',()=>{
 const p={home:.71,draw:.19,away:.1};
 const row={league:'ita.1',game_id:'1',start_time:'2026-11-01T18:00:00Z',home_goals:0,away_goals:0,
   captured_at:'2026-11-01T15:00:00Z',payload:JSON.stringify({probabilities:p,selection:{version:selectionVersion,source:'shots',pick:'home',probability:.71}})};
 assert.equal(footballSelectionAudit([row]).picks,1);
 const later={...row,captured_at:'2026-11-01T16:00:00Z',payload:JSON.stringify({probabilities:p,selection:{version:selectionVersion,source:'shots',pick:null,probability:.62}})};
 assert.deepEqual(footballSelectionAudit([later,row]),{evaluated:1,picks:0,hits:0,drawPicks:0,drawHits:0});
});
test('精選與傷停校正後的畫面和結算採同一機率',async()=>{
  const {finalizeDomesticSelection}=await import(moduleUrl('lib/football-shot-selection.ts'));
  const selection={version:selectionVersion,source:'shots',pick:'home',probability:.72};
  const base={status:'ready',probabilities:{home:.69,draw:.20,away:.11},selection};
  assert.equal(finalizeDomesticSelection(base).selection.pick,null);
  const published={...base,probabilities:{home:.74,draw:.16,away:.10}};
  assert.equal(finalizeDomesticSelection(published).selection.probability,.74);
  const xg=finalizeDomesticSelection({...base,selection:undefined,domesticForecast:{shotApplied:true},probabilities:{home:.12,draw:.72,away:.16}},
    {homeGames:14,awayGames:17,fetchedAt:'2026-11-07T10:00:00Z'});
  assert.equal(xg.selection.source,'xg');assert.equal(xg.selection.pick,'draw');
  assert.equal(finalizeDomesticSelection({...published,selection:{...selection,pick:null}}).selection.pick,null);
});
