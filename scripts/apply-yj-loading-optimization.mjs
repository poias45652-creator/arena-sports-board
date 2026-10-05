import fs from 'node:fs';
import assert from 'node:assert/strict';

// One-time, fail-closed migration for the YJ performance branch only.
function replace(file, before, after) {
  const source = fs.readFileSync(file, 'utf8');
  assert.equal(source.split(before).length - 1, 1, `Unexpected source in ${file}: ${before.slice(0, 80)}`);
  fs.writeFileSync(file, source.replace(before, after));
}
function create(file, content) {
  assert.ok(!fs.existsSync(file), `Refusing to overwrite ${file}`);
  fs.writeFileSync(file, content);
}

replace('app/page.tsx', 'import { useCallback,', 'import dynamic from "next/dynamic";\nimport { useCallback,');
for (const [name, file] of [
  ['Pregame', 'pregame'], ['Standings', 'standings'], ['TeamsDirectory', 'teams-directory'],
  ['LiveScoreboard', 'live-scoreboard'], ['FootballBoard', 'football-board'],
  ['NbaBoard', 'nba-board'], ['InternationalBoard', 'international-board'],
]) {
  replace('app/page.tsx', `import ${name} from './${file}';`,
    `const ${name} = dynamic(() => import('./${file}'), { loading: BoardLoading });`);
}
replace('app/page.tsx', 'type LiveGame =',
  'function BoardLoading(){return <div className="panel min-h-40 p-6 text-sm text-slate-400" role="status" aria-live="polite">正在載入賽事內容…</div>;}\n\ntype LiveGame =');
replace('app/page.tsx', '<div hidden={view!==\'overview\'&&view!==\'standings\'}><Standings active={view===\'overview\'||view===\'standings\'}/></div>',
  "{(view==='overview'||view==='standings')&&<Standings active/>}");
replace('app/page.tsx', "<div hidden={view!=='overview'}>", "{view==='overview'&&<div>");
replace('app/page.tsx', '      </section>\n      </div>\n', '      </section>\n      </div>}\n');
replace('app/page.tsx', '<div hidden={view===\'live\'||view===\'standings\'||view===\'teams\'} className="analysis-workspace"><Pregame active={view===\'overview\'||view===\'analysis\'}/></div>',
  '{(view===\'overview\'||view===\'analysis\')&&<div className="analysis-workspace"><Pregame active/></div>}');

create('app/navigation-work.ts', `// Navigation badges must not flood the connection used by the active board.
type Job = {
  run: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  signal: AbortSignal;
  abort: () => void;
};
const queue: Job[] = [];
let running = 0;
const MAX_CONCURRENT_NAVIGATION_REQUESTS = 2;
function aborted(signal: AbortSignal) {
  return signal.reason ?? new DOMException('Aborted', 'AbortError');
}
function drain() {
  while (running < MAX_CONCURRENT_NAVIGATION_REQUESTS && queue.length) {
    const job = queue.shift()!;
    job.signal.removeEventListener('abort', job.abort);
    if (job.signal.aborted) { job.reject(aborted(job.signal)); continue; }
    running++;
    Promise.resolve().then(() => {
      if (job.signal.aborted) throw aborted(job.signal);
      return job.run();
    }).then(job.resolve, job.reject).finally(() => { running--; drain(); });
  }
}
export function runNavigationTask<T>(run: () => Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(aborted(signal));
  return new Promise<T>((resolve, reject) => {
    const job: Job = {run, resolve: value => resolve(value as T), reject, signal, abort: () => {
      const index = queue.indexOf(job);
      if (index !== -1) { queue.splice(index, 1); reject(aborted(signal)); }
    }};
    signal.addEventListener('abort', job.abort, {once: true});
    queue.push(job);
    drain();
  });
}
`);
for (const file of ['app/use-sport-live.ts', 'app/use-league-live.ts']) {
  replace(file, "'use client';", "'use client';\nimport {runNavigationTask} from './navigation-work';");
  replace(file, 'void refresh();const poll=', 'const initial=setTimeout(()=>void refresh(),3000);const poll=');
  replace(file, 'controller.abort();clearInterval(poll);', 'controller.abort();clearTimeout(initial);clearInterval(poll);');
}
replace('app/use-sport-live.ts', 'sources.map(async([code,url])=>{', 'sources.map(([code,url])=>runNavigationTask(async()=>{');
replace('app/use-sport-live.ts', '   }));busy=false;', '   },controller.signal)));busy=false;');
replace('app/use-league-live.ts', 'leagues.map(async league=>{', 'leagues.map(league=>runNavigationTask(async()=>{');
replace('app/use-league-live.ts', '   }));busy=false;', '   },controller.signal)));busy=false;');

create('app/login/background-video.tsx', `'use client';
import {useEffect, useState} from 'react';

export default function BackgroundVideo() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & {connection?: {saveData?: boolean; effectiveType?: string}}).connection;
    const update = () => {
      const slow = connection?.saveData || ['slow-2g', '2g'].includes(connection?.effectiveType ?? '');
      setEnabled(!motion.matches && !slow);
    };
    // No MP4 source on first paint: prioritize the login form and session settings.
    const timer = window.setTimeout(update, 3000);
    const reduceMotion = () => { if (motion.matches) setEnabled(false); };
    motion.addEventListener('change', reduceMotion);
    return () => { window.clearTimeout(timer); motion.removeEventListener('change', reduceMotion); };
  }, []);
  return <video className="yj-login-video" autoPlay={enabled} muted loop playsInline
    preload="none" poster="/backgrounds/yankee-stadium.jpg" aria-hidden="true"
    src={enabled ? '/0912-bg.mp4' : undefined}/>;
}
`);
replace('app/login/page.tsx', "import './cover.css';", "import './cover.css';\nimport BackgroundVideo from './background-video';");
replace('app/login/page.tsx', '<video className="yj-login-video" autoPlay muted loop playsInline preload="metadata" poster="/backgrounds/yankee-stadium.jpg" aria-hidden="true"><source src="/0912-bg.mp4" type="video/mp4"/></video>', '<BackgroundVideo/>');
replace('next.config.ts', 'const config: NextConfig = {serverExternalPackages:["pg"],experimental:{cpus:2},poweredByHeader:false};', `const config: NextConfig = {
  serverExternalPackages: ["pg"],
  experimental: {cpus: 2},
  poweredByHeader: false,
  compress: true,
  async headers() {
    // Only public visual assets. Never cache sessions, private data, or live APIs.
    return ["/backgrounds/:path*", "/yj-logo.png", "/line-contact.png", "/yj-app-icon.png", "/apple-touch-icon.png", "/0912-bg.mp4"].map(source => ({
      source,
      headers: [{key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400"}],
    }));
  },
};`);

create('tests/yj-loading-performance.test.mjs', `import {test} from 'node:test';
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
  assert.ok(!page.includes('<div hidden={view!==\\'overview\\'&&view!==\\'standings\\'}>'));
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
`);
console.log('YJ loading changes applied. Authentication, predictions, active-board polling and Maya are unchanged.');
