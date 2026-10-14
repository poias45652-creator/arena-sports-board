import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
test('public front page retains exactly MLB plus NPB baseball LIVE coverage',()=>{
 const page=read('app/page.tsx');
 assert.ok(page.includes("useLeagueLive(['NPB'])"));
 assert.ok(page.includes("leagueLive.NPB"));
 assert.ok(page.includes("liveGames.some(game=>game.live)"));
 assert.match(page,/MLB・NPB/);
});
test('international LIVE hook still defaults to all leagues for admin or other callers',()=>{
 const hook=read('app/use-league-live.ts');
 assert.ok(hook.includes("selected:readonly League[]=leagues"));
 assert.ok(hook.includes("const leagues:League[]=['CPBL','NPB','KBO']"));
 assert.ok(hook.includes("active.map(async league=>"));
 assert.ok(hook.includes("},[scope])"));
});
