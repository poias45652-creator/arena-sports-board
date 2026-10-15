// Built app + isolated authentication and captured public basketball source fixtures.
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.BASKETBALL_PLAYWRIGHT_MODULE||'/tmp/basketball-browser/node_modules/playwright/index.mjs');
const origin='http://127.0.0.1:3032',directory='evidence/basketball-live';mkdirSync(directory,{recursive:true});
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3032'],{env:{...process.env,YJ_RENDER_HTTP_TEST:'1',YJ_FOOTBALL_ADMIN_SMOKE:'1',YJ_BACKGROUND_REFRESH:'0',DATABASE_URL:'postgresql://local-test/fixture',TZ_BINDING_KEY:Buffer.alloc(32).toString('base64'),PLATFORM_ADMIN_USERNAME:'render-test-admin',APP_ORIGIN:origin,NODE_OPTIONS:'--import ./tests/basketball-live-http-preload.mjs'},stdio:['ignore','pipe','pipe']});
let output='',browser;const results=[];server.stdout.on('data',x=>output+=x);server.stderr.on('data',x=>output+=x);
try{
 let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await delay(250);}assert.ok(ready,'server ready');const proxyUrl=process.env.HTTPS_PROXY||process.env.HTTP_PROXY;const proxy=proxyUrl?{server:proxyUrl,bypass:'127.0.0.1,localhost'}:undefined;browser=await chromium.launch({headless:true,proxy});
 for(const [size,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,locale:'zh-TW',ignoreHTTPSErrors:true}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route(origin+'/**',async route=>{const response=await route.fetch({headers:{...route.request().headers(),cookie:'__Host-arena_tz='+'e'.repeat(64)}});await route.fulfill({response});});
  await page.clock.install({time:new Date('2026-10-15T17:00:00Z')});
  for(const [league,day,player,score,rows] of [['NBA','2026-10-15','Julius Randle','128:144',19],['WNBA','2026-10-02','Caitlin Clark','83:94',11]]){
   const nav=await page.goto(`${origin}/?league=${league}&view=live&date=${day}`);assert.equal(nav.status(),200);
   await page.getByRole('heading',{name:'球員數據 BOX SCORE'}).waitFor({timeout:60000});
   assert.equal(await page.locator('.basketball-boxscore .basketball-player-card').count(),rows);
   assert.equal((await page.locator('.basketball-scoreboard .nba-match-score').textContent()).replaceAll(' ',''),score);
   assert.ok((await page.locator('.basketball-play').first().textContent()).includes('比賽結束'));
   await page.locator('.basketball-player-card').first().locator('summary').click();assert.ok(await page.locator('.basketball-player-card').first().getByText('正負值',{exact:true}).isVisible());
   await page.getByRole('group',{name:'逐球節次'}).getByRole('button',{name:'第1節',exact:true}).click();assert.ok((await page.locator('.basketball-play time').allTextContents()).every(t=>t.startsWith('第1節')));
   await page.getByRole('group',{name:'逐球節次'}).getByRole('button',{name:'全部',exact:true}).click();
   const before=await page.locator('.basketball-play').count();await page.getByRole('button',{name:/載入較早紀錄/}).click();assert.ok(await page.locator('.basketball-play').count()>before);
   await page.getByRole('group',{name:'球員球隊'}).getByRole('button').last().click();assert.ok(!(await page.locator('.basketball-boxscore').textContent()).includes(player));
   await page.getByRole('group',{name:'球員球隊'}).getByRole('button').first().click();assert.ok((await page.locator('.basketball-boxscore').textContent()).includes(player));
   await page.locator('.nba-board').evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-180));await page.screenshot({path:`${directory}/${size}-${league}-scoreboard.png`});
   await page.locator('.basketball-live-columns').evaluate(el=>window.scrollTo(0,el.getBoundingClientRect().top+window.scrollY-180));await page.screenshot({path:`${directory}/${size}-${league}-players.png`});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no page overflow');
   const filters=page.getByRole('group',{name:`${league} 賽事狀態`});await filters.getByRole('button',{name:/未開賽/}).click();await page.getByRole('heading',{name:'沒有符合篩選的比賽'}).waitFor();assert.equal(await page.locator('.basketball-detail').count(),0);await filters.getByRole('button',{name:/全部/}).click();
   await page.getByRole('navigation',{name:`${league} 頁面`}).getByRole('button',{name:'戰績排名',exact:true}).click();await page.locator('.basketball-standings tbody tr').first().waitFor();assert.equal(await page.locator('.basketball-standings tbody tr').count(),league==='NBA'?30:15);
   if(league==='NBA')await page.getByText('此球季尚無已完成賽事，可切換球季或賽季查看戰績。').waitFor();
   await page.screenshot({path:`${directory}/${size}-${league}-standings.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'standings no page overflow');
   await page.getByRole('navigation',{name:`${league} 頁面`}).getByRole('button',{name:'概覽',exact:true}).click();await page.getByRole('button',{name:'查看比分與球員成績'}).waitFor();
   const trigger=page.getByRole('button',{name:/模型比例/}),dialog=page.getByRole('dialog',{name:`${league} 籃球模型比例`});await trigger.click();assert.equal(await dialog.getByRole('slider').count(),5);
   const slider=dialog.getByRole('slider').first();assert.equal(await slider.inputValue(),'20');await slider.press('End');await dialog.getByRole('button',{name:'取消',exact:true}).click();await trigger.click();assert.equal(await slider.inputValue(),'20');await slider.press('End');await dialog.getByRole('button',{name:'套用',exact:true}).click();
   const storageKey=`yj:${league.toLowerCase()}:model-weights:v1`;assert.deepEqual(JSON.parse(await page.evaluate(k=>localStorage.getItem(k),storageKey)).weights,[100,20,20,20,20]);
   await page.reload();await trigger.click();assert.equal(await slider.inputValue(),'100');await page.screenshot({path:`${directory}/${size}-${league}-weights.png`});await page.keyboard.press('Escape');
   assert.deepEqual(errors,[]);results.push({size,league,passed:true});
  }
  // Source errors preserve the selected identity, surface a retry, and recover.
  await page.goto(`${origin}/?league=NBA&view=live&date=2026-10-15`);await page.locator('.basketball-player-card').first().waitFor();
  await page.route('**/api/nba?kind=detail**',route=>route.fulfill({status:502,contentType:'application/json',body:JSON.stringify({error:'測試來源暫時無法更新'})}));
  await page.getByRole('button',{name:'更新比賽明細',exact:true}).click();await page.getByRole('alert').filter({hasText:'測試來源暫時無法更新'}).waitFor();assert.equal(await page.locator('.basketball-player-card').count(),19);
  await page.unroute('**/api/nba?kind=detail**');await page.getByRole('alert').filter({hasText:'測試來源暫時無法更新'}).getByRole('button',{name:'重試'}).click();await page.getByRole('alert').filter({hasText:'測試來源暫時無法更新'}).waitFor({state:'hidden'});
  await page.getByLabel('NBA 比賽日期').fill('2026-10-16');await page.getByRole('heading',{name:'2026-10-16 沒有 NBA 賽事'}).waitFor();assert.equal(await page.locator('.basketball-player-card').count(),0);
  // Synthetic live transition tests timers without waiting for an actual live game.
  let schedulePolls=0,detailPolls=0;
  await page.route('**/api/nba?date=2026-10-15',async route=>{schedulePolls++;const response=await route.fetch({headers:{...route.request().headers(),cookie:'__Host-arena_tz='+'e'.repeat(64)}}),data=await response.json();data.games=data.games.map(g=>({...g,state:'live',statusLabel:'第4節 1:00'}));await route.fulfill({response,json:data});});
  await page.route('**/api/nba?kind=detail**',async route=>{detailPolls++;const response=await route.fetch({headers:{...route.request().headers(),cookie:'__Host-arena_tz='+'e'.repeat(64)}}),data=await response.json();data.game={...data.game,state:'live',statusLabel:'第4節 1:00'};await route.fulfill({response,json:data});});
  await page.goto(`${origin}/?league=NBA&view=live&date=2026-10-15`);await page.locator('.basketball-player-card').first().waitFor();const s=schedulePolls,d=detailPolls;await page.clock.fastForward(11000);await page.waitForFunction(()=>document.querySelector('.basketball-scoreboard')?.textContent.includes('LIVE'));
  for(let i=0;i<20&&(schedulePolls<=s||detailPolls<=d);i++)await delay(100);
  assert.ok(schedulePolls>s,'schedule polls every 10 seconds');assert.ok(detailPolls>d,'live detail polls every 10 seconds');
  assert.deepEqual(errors,[]);await page.unrouteAll({behavior:'ignoreErrors'});await context.close();
 }
 writeFileSync(directory+'/result.json',JSON.stringify({results},null,2));console.log('PASS: NBA/WNBA desktop/mobile scoreboards, players, periods, pagination, filters, rankings, overview, independent weights, reload, error recovery and date switching.');
}catch(error){writeFileSync(directory+'/failure.json',JSON.stringify({error:String(error),stack:error.stack,results},null,2));if(browser)for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:directory+'/failure.png'}).catch(()=>{});throw error;}
finally{writeFileSync(directory+'/server.log',output);if(browser)for(const context of browser.contexts())for(const page of context.pages())await page.unrouteAll({behavior:'ignoreErrors'});await browser?.close();server.kill('SIGTERM');if(server.exitCode===null)await new Promise(resolve=>server.once('exit',resolve));}
