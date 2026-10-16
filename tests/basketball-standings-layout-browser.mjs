import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const engines=await import(process.env.BASKETBALL_PLAYWRIGHT_MODULE||'/tmp/basketball-layout-browser/node_modules/playwright/index.mjs');
const origin='http://127.0.0.1:3038',dir='evidence/basketball-standings-layout';mkdirSync(dir,{recursive:true});
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3038'],{env:{...process.env,YJ_RENDER_HTTP_TEST:'1',YJ_FOOTBALL_ADMIN_SMOKE:'1',YJ_BACKGROUND_REFRESH:'0',DATABASE_URL:'postgresql://local-test/fixture',TZ_BINDING_KEY:Buffer.alloc(32).toString('base64'),PLATFORM_ADMIN_USERNAME:'render-test-admin',APP_ORIGIN:origin,NODE_OPTIONS:'--import ./tests/basketball-live-http-preload.mjs'},stdio:['ignore','pipe','pipe']});
let output='',browser;server.stdout.on('data',x=>output+=x);server.stderr.on('data',x=>output+=x);const results=[];
try{
 for(let i=0;i<120;i++){try{if((await fetch(origin+'/api/health')).ok)break;}catch{}await delay(250);}
 for(const browserName of (process.env.BASKETBALL_LAYOUT_BROWSERS||'chromium,webkit').split(',')){
 browser=await engines[browserName].launch({headless:true});
 for(const width of [390,320,1440]){
  const context=await browser.newContext({viewport:{width,height:844},locale:'zh-TW'}),page=await context.newPage();
  await page.route(origin+'/**',async route=>{const response=await route.fetch({headers:{...route.request().headers(),cookie:'__Host-arena_tz='+'f'.repeat(64)}});await route.fulfill({response});});
  for(const league of ['NBA','WNBA']){
   await page.goto(origin+'/?league='+league+'&view=standings');
   await page.locator('.basketball-standings tbody tr').first().waitFor();
   if(league==='NBA'){await page.locator('.basketball-standings select').last().selectOption('1');await page.locator('.basketball-standings tbody tr').first().waitFor();}
   await page.locator('.basketball-standings').evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+scrollY-(innerWidth<768?16:90)));
   const geometry=await page.locator('.basketball-standings tbody tr').evaluateAll(rows=>rows.map(row=>{const name=row.querySelector('th a'),range=document.createRange();range.selectNodeContents(name);const a=range.getBoundingClientRect(),c=row.children[2].getBoundingClientRect();return {team:name.textContent,right:a.right,winLeft:c.left,overlap:a.right>c.left-2};}));
   const header=await page.locator('main>header').evaluate(el=>({position:getComputedStyle(el).position,bottom:el.getBoundingClientRect().bottom}));
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
   const entry={browserName,width,league,header,overflow,overlap:geometry.filter(g=>g.overlap)};results.push(entry);console.log(JSON.stringify(entry));
   await page.screenshot({path:dir+'/'+browserName+'-'+width+'-'+league+'.png'});
   {assert.equal(overflow,false);assert.equal(entry.overlap.length,0);if(width<768){assert.notEqual(header.position,'sticky');assert.ok(header.bottom<=0,'mobile header scrolls clear of the standings');}else assert.equal(header.position,'sticky');
    const scroll=page.locator('.basketball-standings .nba-table-scroll').first();await scroll.evaluate(el=>el.scrollLeft=el.scrollWidth);assert.ok(await scroll.evaluate(el=>el.scrollWidth<=el.clientWidth||el.scrollLeft>0));
    await page.locator('.basketball-standings header button').click();await page.locator('.basketball-standings tbody tr').first().waitFor();
   }
  }
  await page.unrouteAll({behavior:'ignoreErrors'});await context.close();
 }
 await browser.close();browser=null;
 }
 writeFileSync(dir+'/result.json',JSON.stringify(results,null,2));console.log('PASS: Chromium/WebKit standings keep every team separate from wins, scroll horizontally, and leave mobile content unobstructed.');
}finally{if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.unrouteAll({behavior:'ignoreErrors'});await browser?.close();writeFileSync(dir+'/server.log',output);server.kill('SIGTERM');if(server.exitCode===null)await new Promise(r=>server.once('exit',r));}
