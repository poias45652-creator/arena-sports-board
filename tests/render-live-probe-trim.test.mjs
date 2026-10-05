import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('front page only probes NPB among international baseball leagues',()=>{
 const page=read('app/page.tsx'),hook=read('app/use-league-live.ts');
 assert.ok(page.includes("useLeagueLive(['NPB'])"));
 assert.ok(hook.includes("selected:readonly League[]=leagues"));
 assert.ok(hook.includes("active.map(async league=>"));
});
test('hidden sports do not generate LIVE badge polling',()=>{
 const page=read('app/page.tsx'),hook=read('app/use-sport-live.ts');
 assert.ok(page.includes("league==='WNBA'?'WNBA':'NONE'"));
 assert.ok(hook.includes("type Active='NBA'|'WNBA'|'FOOTBALL'|'ALL'|'NONE'"));
 assert.ok(hook.includes("if(!sources.length){setUntil({});return;}"));
 assert.ok(hook.includes("active==='NBA'?[basketball[0]]"));
 assert.ok(hook.includes("active==='WNBA'?[basketball[1]]"));
});
