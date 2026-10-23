import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseNpbSeasonBackup,createNpbSeasonBackup} from '../server/npb-season-backup.mjs';
import {moduleUrl} from './profile-loader.mjs';
const {supplementSeasonPitching}=await import(moduleUrl('lib/international-season-pitching.ts'));
const {supplementBullpens}=await import(moduleUrl('lib/international-bullpen.ts'));
const {buildRunAnalysis}=await import(moduleUrl('lib/baseball-run-analysis.ts'));
const {defaultBaseballSettings}=await import(moduleUrl('lib/baseball-model-settings.ts'));
const {aiTeamSuggestion}=await import(moduleUrl('server/ai-team-suggestions.ts'));
const {buildAiFacts}=await import(moduleUrl('lib/ai-assistant-facts.ts'));
const {quickAiAnswer,AI_INSUFFICIENT}=await import(moduleUrl('lib/ai-assistant.ts'));
const date='2026-10-24',at='2026-10-23T13:00:00Z',now=Date.parse(at);
const pages=code=>Object.fromEntries(['team','pitch','yahoo'].map(kind=>[kind,readFileSync(`tests/fixtures/npb-season-backup/${code}-${kind}.html`,'utf8')]));
test('actual source rows recover both announced starters, complete team runs and verified relief totals',()=>{
 const db=parseNpbSeasonBackup('db',pages('db'),date,at),h=parseNpbSeasonBackup('h',pages('h'),date,at);
 const a=db.rows.find(r=>r.name==='石田裕太郎'),b=h.rows.find(r=>r.name==='上沢直之');
 assert.deepEqual([a.stats.era,a.stats.whip,a.stats.innings],['2.91','1.15','120.2']);
 assert.deepEqual([b.stats.era,b.stats.whip,b.stats.innings],['2.39','1.12','135.1']);
 assert.deepEqual(db.bullpens.map(r=>[r.stats.era,r.stats.innings]),[['2.95','503.1']]);
 assert.deepEqual(h.bullpens.map(r=>[r.stats.era,r.stats.innings]),[['2.26','466']]);
 assert.equal(db.teamRuns[0].scored,557);assert.equal(h.teamRuns[0].scored,707);
 const side=(r,teamCode)=>({team:r.team,teamCode,starter:{name:r.name,season:{era:r.stats.era},quality:'source_reported',warnings:[],recent:{headers:[],rows:[]}},bullpen:null});
 const data={league:'NPB',date,games:[{id:'2026-series',league:'NPB',date,start:date+' 17:30:00',kind:'pregame_snapshot',source:{observedAt:at},home:side(a,'3'),away:side(b,'12')}]};
 const enriched=supplementBullpens(supplementSeasonPitching(data,{rows:[...db.rows,...h.rows]},now),{rows:[...db.bullpens,...h.bullpens],teamRuns:[...db.teamRuns,...h.teamRuns]},now).games[0];
 const analysis=buildRunAnalysis(enriched,now,'NPB',false,defaultBaseballSettings());assert.equal(analysis.status,'ready',analysis.reason);assert.equal(analysis.mode,undefined);
 assert.equal(enriched.comparison.title,'NPB 已核對本季團隊得失分');
 const match={id:enriched.id,league:'NPB',day:date,home:enriched.home.team,away:enriched.away.team,homeId:'3',awayId:'12',start:date+'T09:30:00Z'};
 const inputs={...analysis,probabilities:analysis.win,factors:analysis.personalModel.multifactor.factors,weightEvidence:{home:{starterOuts:362},away:{starterOuts:406}}};
 const suggestion=aiTeamSuggestion(match,inputs,'baseball');assert.ok(suggestion);assert.notDeepEqual(suggestion.teams[0].weights,suggestion.teams[1].weights);
 const snapshot=buildAiFacts(match,inputs,suggestion,'baseball');for(const action of ['analysis','risk','weights'])assert.notEqual(quickAiAnswer(snapshot,action).answer,AI_INSUFFICIENT);
});
test('backup rejects wrong seasons, identities, dates, aggregate conflicts and altered individual stats',()=>{
 const p=pages('db');
 for(const bad of [{...p,pitch:p.pitch.replaceAll('2026年度','2025年度')},{...p,yahoo:pages('h').yahoo},{...p,team:p.team.replaceAll('557','558')},{...p,pitch:p.pitch.replace('>120.2<','>121.2<')}]){
  assert.throws(()=>parseNpbSeasonBackup('db',bad,date,at));
 }
 for(const day of ['2026-10-22','2026-11-10','2027-10-24'])assert.throws(()=>parseNpbSeasonBackup('db',p,day,at));
 const bad={...p,yahoo:p.yahoo.replace('>120.2<','>121.2<')};assert.ok(!parseNpbSeasonBackup('db',bad,date,at).rows.some(r=>r.name==='石田裕太郎'));
});
test('collector uses bounded public sources, caches successful data, and does not retry denials',async()=>{
 const p=pages('db'),calls=[];const collect=createNpbSeasonBackup({now:()=>now,fetcher:async url=>{calls.push(url);return new Response(url.includes('baseball.yahoo')?p.yahoo:url.includes('/t/teamdata')?p.team:p.pitch);}});
 const result=await collect(date,['橫濱 DeNA 海灣之星']);assert.equal(result.errors.length,0);assert.ok(result.rows.length>0);assert.equal(calls.length,3);
 await collect(date,['橫濱 DeNA 海灣之星']);assert.equal(calls.length,3);
 await collect('2026-10-22',['橫濱 DeNA 海灣之星']);assert.equal(calls.length,3);
 let denied=0;const unavailable=createNpbSeasonBackup({now:()=>now,fetcher:async()=>{denied++;return new Response('denied',{status:403});}});
 const failed=await unavailable(date,['橫濱 DeNA 海灣之星']);assert.equal(failed.rows.length,0);assert.equal(failed.bullpens.length,0);assert.equal(denied,3);await unavailable(date,['橫濱 DeNA 海灣之星']);assert.equal(denied,3);
});
