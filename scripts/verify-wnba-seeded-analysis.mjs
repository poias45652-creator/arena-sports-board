import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {moduleUrl} from '../tests/profile-loader.mjs';
const day=process.argv[2]||'2026-10-08',expectedIds=['401918297','401918298'];
const seed=JSON.parse(readFileSync('data/wnba-public-cache-seed.json','utf8'));
assert.ok(seed.entries.length>0);assert.ok(seed.entries.every(row=>row.kind==='efficiency'&&row.key.startsWith('WNBA:')));
let summaryRequests=0;const liveFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 if(url.hostname==='site.api.espn.com'&&url.pathname.endsWith('/basketball/wnba/summary')){
  summaryRequests++;throw Error('A verified WNBA historical box was missing from the build seed');
 }
 return liveFetch(input,options);
};
const {wnbaSchedule,wnbaGameAnalysis}=await import(moduleUrl('lib/wnba-source.ts'));
const {readyNbaAnalysis}=await import(moduleUrl('lib/nba-analysis.ts'));
const board=await wnbaSchedule(day),rows=[],startedAt=new Date().toISOString();
for(const id of expectedIds){
 const game=board.games.find(g=>g.id===id);assert.ok(game,`Missing requested fixture ${id}`);
 const started=Date.now(),report=await wnbaGameAnalysis(day,id),analysis=report&&readyNbaAnalysis(game,report);
 assert.ok(analysis,`Analysis unavailable for ${id}`);assert.equal(analysis.status,'ready');assert.equal(analysis.playerContext?.status,'applied');
 rows.push({id,ready:true,status:analysis.status,context:analysis.playerContext.status,statsCapturedAt:analysis.playerContext.statsCapturedAt,sourceFetchedAt:report.sourceFetchedAt,elapsedMs:Date.now()-started});
}
assert.equal(summaryRequests,0);
const evidence={origin:'github-runner-not-browser',runId:process.env.GITHUB_RUN_ID,runAttempt:process.env.GITHUB_RUN_ATTEMPT,commit:process.env.GITHUB_SHA,day,startedAt,finishedAt:new Date().toISOString(),seedEntries:seed.entries.length,summaryRequests,rows,passed:true};
mkdirSync('evidence',{recursive:true});writeFileSync('evidence/wnba-seeded-verification.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
