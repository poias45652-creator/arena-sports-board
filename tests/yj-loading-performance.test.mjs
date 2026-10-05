import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
const source = fs.readFileSync('app/navigation-work.ts', 'utf8');
const js = stripTypeScriptTypes(source);
const {runNavigationTask} = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const tick = () => new Promise(resolve => setImmediate(resolve));

test('navigation requests share a two-request cap across all badges', async () => {
  let active=0, maximum=0;
  const signal=new AbortController().signal;
  const results=await Promise.all(Array.from({length:12}, (_,i)=>runNavigationTask(async()=>{
    active++;maximum=Math.max(maximum,active);await tick();active--;return i;
  },signal)));
  assert.equal(maximum,2);assert.deepEqual(results,Array.from({length:12},(_,i)=>i));
});
test('queued cancellation never starts unnecessary network work', async () => {
  let release;
  const blocked=new Promise(resolve=>{release=resolve;});
  const a=runNavigationTask(()=>blocked,new AbortController().signal);
  const b=runNavigationTask(()=>blocked,new AbortController().signal);
  const controller=new AbortController();let called=false;
  const c=runNavigationTask(async()=>{called=true;},controller.signal);
  controller.abort();await assert.rejects(c);release();await Promise.all([a,b]);
  assert.equal(called,false);
});
test('failed and pre-aborted tasks do not wedge the queue', async () => {
  const controller=new AbortController();controller.abort();
  await assert.rejects(runNavigationTask(async()=>1,controller.signal));
  await assert.rejects(runNavigationTask(async()=>{throw new Error('expected');},new AbortController().signal));
  assert.equal(await runNavigationTask(async()=>42,new AbortController().signal),42);
});
test('heavy sport boards and inactive tabs are loaded on demand', () => {
  const page=fs.readFileSync('app/page.tsx','utf8');
  for(const name of ['pregame','standings','teams-directory','live-scoreboard','football-board','nba-board','international-board']){
    assert.ok(page.includes("dynamic(() => import('./"+name+"')"));
  }
  assert.ok(!page.includes('<div hidden={view!==\'overview\'&&view!==\'standings\'}>'));
  assert.ok(page.includes("(view==='overview'||view==='analysis')&&"));
});
test('navigation is deferred without dropping leagues or changing polling cadence', () => {
  for(const file of ['app/use-sport-live.ts','app/use-league-live.ts']){
    const text=fs.readFileSync(file,'utf8');
    assert.ok(text.includes('setTimeout(()=>void refresh(),3000)'));
    assert.ok(text.includes('clearTimeout(initial)'));
    assert.ok(text.includes('runNavigationTask'));
    assert.ok(text.includes('visibilitychange'));
    assert.ok(text.includes('arena-refresh-all'));
  }
  assert.ok(fs.readFileSync('app/use-sport-live.ts','utf8').includes('30000'));
  assert.ok(fs.readFileSync('app/use-league-live.ts','utf8').includes("['CPBL','NPB','KBO']"));
});
test('login video does not compete with initial login resources', () => {
  const video=fs.readFileSync('app/login/background-video.tsx','utf8');
  assert.ok(video.includes('useState(false)'));
  assert.ok(video.includes('preload="none"'));
  assert.ok(video.includes('saveData'));
  assert.ok(video.includes('prefers-reduced-motion'));
  assert.ok(video.includes("enabled ? '/0912-bg.mp4' : undefined"));
});
test('public asset caching does not target APIs or account pages', () => {
  const config=fs.readFileSync('next.config.ts','utf8');
  assert.ok(config.includes('max-age=3600'));
  assert.ok(!config.includes('source: "/api'));
  assert.ok(!config.includes('"/:path*"'));
});
