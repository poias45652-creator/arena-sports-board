import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.BASKETBALL_PLAYWRIGHT_MODULE||'/tmp/player-browser/node_modules/playwright/index.mjs');
const origin='http://127.0.0.1:3039',directory='evidence/player-profile-browser',cookie='__Host-arena_tz='+'e'.repeat(64);mkdirSync(directory,{recursive:true});
const samples=Object.fromEntries(['nba','wnba','football'].map(k=>[k,JSON.parse(readFileSync(`tests/fixtures/player-profiles/${k}-profile.json`))]));
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3039'],{env:{...process.env,YJ_RENDER_HTTP_TEST:'1',YJ_FOOTBALL_ADMIN_SMOKE:'1',YJ_BACKGROUND_REFRESH:'0',DATABASE_URL:'postgresql://local-test/fixture',TZ_BINDING_KEY:Buffer.alloc(32).toString('base64'),PLATFORM_ADMIN_USERNAME:'render-test-admin',APP_ORIGIN:origin,NODE_OPTIONS:'--import ./tests/render-http-preload.mjs'},stdio:['ignore','pipe','pipe']});
let output='',browser;server.stdout.on('data',x=>output+=x);server.stderr.on('data',x=>output+=x);
try{
 let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await delay(250);}assert.ok(ready);
 assert.equal((await fetch(origin+'/api/sport-player?id=203083&league=NBA')).status,401,'API requires membership');
 assert.equal((await fetch(origin+'/api/sport-player?id=bad&league=NBA',{headers:{cookie}})).status,400,'invalid IDs rejected before source requests');
 browser=await chromium.launch({headless:true});
 for(const [size,viewport] of [['mobile',{width:390,height:844}],['desktop',{width:1440,height:1000}]]){
 const context=await browser.newContext({viewport,locale:'zh-TW'}),page=await context.newPage(),errors=[],requests=[];let failNext=false;
 page.on('pageerror',e=>errors.push(String(e)));
 await page.route(origin+'/**',async route=>{const request=route.request(),u=new URL(request.url());if(u.pathname==='/api/sport-player'){
  requests.push(Object.fromEntries(u.searchParams));if(failNext){failNext=false;return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'球員資料暫時無法讀取，請稍後重試。'})});}
  const key=u.searchParams.get('league')==='NBA'?'nba':u.searchParams.get('league')==='WNBA'?'wnba':'football',d=structuredClone(samples[key]);d.season=Number(u.searchParams.get('season')||d.season);d.phase=u.searchParams.get('phase')||'2';
  const selected=d.history.find(r=>r.season===d.season);d.summary=selected?.values||{};d.summaryLabel=selected?.label||String(d.season);if(d.season!==samples[key].season||d.phase!=='2')d.games=[];
  return route.fulfill({contentType:'application/json',body:JSON.stringify(d)});
 }const response=await route.fetch({headers:{...request.headers(),cookie}});return route.fulfill({response});});
 for(const [key,path] of [['nba','/players/nba/203083'],['wnba','/players/wnba/1642286'],['football','/players/football/eng.1/250787?team=382&season=2026']]){
  await page.goto(origin+path);await page.getByRole('heading',{name:samples[key].name,exact:true}).waitFor();assert.ok(await page.getByRole('heading',{name:'個人資料',exact:true}).isVisible());
  assert.ok(await page.locator('.sp-metrics strong').count()>=3);assert.equal(await page.getByRole('link',{name:'返回球隊'}).getAttribute('href'),samples[key].team.href);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'mobile page must not overflow');await page.screenshot({path:`${directory}/${size}-${key}-overview.png`});
  await page.getByRole('button',{name:'歷年成績',exact:true}).click();assert.equal(await page.locator('tbody tr').count(),samples[key].history.length);
  await page.getByRole('button',{name:'逐場紀錄',exact:true}).click();assert.equal(await page.locator('tbody tr').count(),samples[key].games.length);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'only table may scroll');await page.locator('.sp-scroll').evaluate(el=>el.scrollLeft=el.scrollWidth);assert.ok(await page.locator('.sp-scroll').evaluate(el=>el.scrollWidth<=el.clientWidth+1||el.scrollLeft>0));
  await page.screenshot({path:`${directory}/${size}-${key}-games.png`});
  const old=samples[key].seasons.find(y=>y!==samples[key].season);await page.getByLabel('球員成績年度').selectOption(String(old));await page.getByText('此範圍尚無可用的逐場紀錄。',{exact:true}).waitFor();assert.equal(requests.at(-1).season,String(old));
  if(key!=='football'){await page.getByLabel('球員成績賽事類型').selectOption('3');await page.getByText('此範圍尚無可用的逐場紀錄。',{exact:true}).waitFor();assert.equal(requests.at(-1).phase,'3');assert.equal(requests.at(-1).season,String(old));}
  await page.getByRole('button',{name:'概覽',exact:true}).click();await page.getByRole('heading',{name:'個人資料',exact:true}).waitFor();
  failNext=true;await page.getByRole('button',{name:'更新',exact:true}).click();await page.locator('.sp-panel[role=alert]').waitFor();await page.getByRole('button',{name:'重新載入'}).click();await page.getByRole('heading',{name:'個人資料',exact:true}).waitFor();
 }
 assert.deepEqual(errors,[]);await page.unrouteAll({behavior:'ignoreErrors'});await context.close();
 }
 console.log('PASS: authenticated NBA/WNBA/football profiles, actual-source fixture metrics and tables, season/phase isolation, retry, phone/desktop layout and horizontal table scrolling');
}catch(e){if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:directory+'/failure.png'}).catch(()=>{});throw e;}
finally{writeFileSync(directory+'/server.log',output);if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.unrouteAll({behavior:'ignoreErrors'});await browser?.close();server.kill('SIGTERM');if(server.exitCode===null)await new Promise(r=>server.once('exit',r));}
