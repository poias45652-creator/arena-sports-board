// Verify a fresh process, not a previously warmed in-memory model.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const original=globalThis.fetch;let officialRequests=0,summaryRequests=0,otherPublicRequests=0;
globalThis.fetch=async(...args)=>{const u=new URL(String(args[0]));if(u.hostname==='www.nba.com')officialRequests++;else if(u.pathname.endsWith('/summary'))summaryRequests++;else otherPublicRequests++;return original(...args);};
const started=Date.now();mkdirSync('evidence',{recursive:true});
try{await import('./verify-nba-live-analysis.mjs');}
finally{globalThis.fetch=original;}
const result=JSON.parse(readFileSync('evidence/nba-live-verification.json','utf8'));
result.sourceReadCounts={officialRequests,summaryRequests,otherPublicRequests};result.totalElapsedMs=Date.now()-started;result.environment='CI fresh process, not Render or browser';
writeFileSync('evidence/nba-live-verification.json',JSON.stringify(result,null,2)+'\n');
console.log('nba-seeded-load-check',JSON.stringify({passed:result.passed,...result.sourceReadCounts,totalElapsedMs:result.totalElapsedMs}));
