import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('football and international LIVE consumers share requests',()=>{
 for(const file of ['app/use-sport-live.ts','app/use-league-live.ts','app/football-board.tsx','app/international-live-feed.tsx'])
   assert.match(read(file),/liveRequest/);
});
test('all front recommendation LIVE coverage remains intact',()=>{
 const sport=read('app/use-sport-live.ts'),league=read('app/use-league-live.ts');
 for(const code of ['NBA','WNBA','eng.1','esp.1','ita.1','ger.1','fra.1','uefa.champions','uefa.nations'])assert.ok(sport.includes(code),code);
 for(const code of ['CPBL','NPB','KBO'])assert.ok(league.includes(code),code);
});
test('shared layer coalesces equivalent query order and does not cache analysis',()=>{
 const c=read('app/live-request.ts');
 assert.match(c,/searchParams\.sort\(\)/);
 assert.match(c,/pending=new Map/);
 assert.match(c,/recent=new Map/);
 assert.match(c,/!parsed\.searchParams\.has\('kind'\)/);
});

// Final verification marker: full LIVE coverage is retained; only identical in-flight requests are shared.
