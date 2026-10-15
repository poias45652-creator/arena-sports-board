// Real built application; only the existing isolated source/auth fixtures are used.
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import('/tmp/nba-browser/node_modules/playwright/index.mjs');
const origin='http://127.0.0.1:3030',directory='evidence/nba-weights',key='yj:nba:model-weights:v1';
mkdirSync(directory,{recursive:true});
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3030'],{env:{...process.env,YJ_RENDER_HTTP_TEST:'1',YJ_FOOTBALL_ADMIN_SMOKE:'1',YJ_BACKGROUND_REFRESH:'0',DATABASE_URL:'postgresql://local-test/fixture',TZ_BINDING_KEY:Buffer.alloc(32).toString('base64'),PLATFORM_ADMIN_USERNAME:'render-test-admin',APP_ORIGIN:origin,NODE_OPTIONS:'--import ./tests/nba-http-preload.mjs'},stdio:['ignore','pipe','pipe']});
let output='',browser;
server.stdout.on('data',x=>output+=x);server.stderr.on('data',x=>output+=x);
const results=[];
try{
 let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await delay(250);}assert.ok(ready,'server ready');
 browser=await chromium.launch({headless:true});
 for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,locale:'zh-TW'});
  const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(String(e)));
  // The existing fixture session is sent only to this isolated HTTP server.
  // Production __Host cookies require HTTPS; production auth stays unchanged.
  await page.route(origin+'/**',route=>route.continue({headers:{...route.request().headers(),cookie:'__Host-arena_tz='+'e'.repeat(64)}}));
  await page.clock.install({time:new Date('2026-09-29T16:00:00Z')});
  page.on('request',r=>{if(r.url().includes('/api/nba?')&&r.url().includes('kind=analysis'))requests.push(r.url());});
  await page.goto(origin+'/?league=NBA&view=analysis&date=2026-10-09');
  const trigger=page.getByRole('button',{name:/模型比例/}),dialog=page.getByRole('dialog',{name:'NBA 籃球模型比例'});
  await trigger.waitFor();await trigger.click();await dialog.waitFor();
  assert.equal(await dialog.getByRole('slider').count(),5);
  const range=dialog.getByRole('slider').first(),saved=()=>page.evaluate(k=>localStorage.getItem(k),key);
  await page.screenshot({path:directory+'/'+name+'-default.png'});
  await range.press('End');assert.equal(await range.inputValue(),'100');
  await dialog.getByRole('button',{name:'取消',exact:true}).click();assert.equal(await saved(),null);
  await trigger.click();assert.equal(await range.inputValue(),'20');
  await range.press('End');await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  await trigger.click();assert.equal(await range.inputValue(),'20');
  for(const slider of await dialog.getByRole('slider').all())await slider.press('Home');
  assert.equal(await dialog.getByRole('button',{name:'套用',exact:true}).isDisabled(),true);
  await dialog.getByRole('alert').waitFor();
  await dialog.getByRole('button',{name:'還原預設比例',exact:true}).click();
  await range.press('End');
  const applied=page.waitForResponse(r=>r.url().includes('game=401898392')&&r.url().includes('weights=100,20,20,20,20'),{timeout:90000});
  await dialog.getByRole('button',{name:'套用',exact:true}).click();
  const response=await applied;assert.equal(response.status(),200);const report=await response.json();
  assert.equal(report.analysis.customWeights,true);assert.equal(report.dailySaved,false);
  assert.deepEqual(JSON.parse(await saved()).weights,[100,20,20,20,20]);
  await page.reload();await trigger.waitFor();await trigger.click();assert.equal(await range.inputValue(),'100');
  await page.screenshot({path:directory+'/'+name+'-custom.png'});
  const bounds=await dialog.boundingBox();assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=viewport.width&&bounds.y+bounds.height<=viewport.height);
  assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),true);
  await dialog.getByRole('button',{name:'還原預設比例',exact:true}).click();
  assert.deepEqual(JSON.parse(await saved()).weights,[100,20,20,20,20]);
  await dialog.getByRole('button',{name:'取消',exact:true}).click();await trigger.click();assert.equal(await range.inputValue(),'100');
  await dialog.getByRole('button',{name:'還原預設比例',exact:true}).click();await dialog.getByRole('button',{name:'套用',exact:true}).click();
  assert.deepEqual(JSON.parse(await saved()).weights,[20,20,20,20,20]);
  assert.deepEqual(errors,[]);
  results.push({viewport:name,passed:true,requests,customExpected:report.analysis.expected,customWeights:report.analysis.weightsKey});
  await context.close();
 }
 writeFileSync(directory+'/result.json',JSON.stringify({commit:process.env.GITHUB_SHA,results},null,2));
 console.log('Desktop and mobile passed: draft, cancel, Escape, zero guard, apply, real API, reload, reset, viewport.');
}catch(error){if(browser)for(const context of browser.contexts())for(const page of context.pages())await page.screenshot({path:directory+'/failure.png'}).catch(()=>{});throw error;}
finally{writeFileSync(directory+'/server.log',output);await browser?.close();server.kill('SIGTERM');if(server.exitCode===null)await new Promise(resolve=>server.once('exit',resolve));}
