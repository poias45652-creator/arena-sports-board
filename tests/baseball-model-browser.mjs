import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.BASKETBALL_PLAYWRIGHT_MODULE||'/tmp/basketball-browser/node_modules/playwright/index.mjs');
const origin='http://127.0.0.1:3035',directory='evidence/baseball-model',cookie='__Host-arena_tz='+'e'.repeat(64),now='2026-09-20T04:00:00Z';mkdirSync(directory,{recursive:true});
// Synthetic MLB inputs exercise opposite strengths; NPB uses the captured source fixture.
const game={id:1,date:'2026-09-20T07:00:00Z',season:2026,state:'Preview',status:'Scheduled',gameType:'R',startTimeTBD:false,away:{id:121,name:'New York Mets',wins:90,losses:60,pitcherId:101,pitcherName:'測試先發甲',pitcherEra:2,pitcherWhip:1},home:{id:120,name:'Washington Nationals',wins:60,losses:90,pitcherId:102,pitcherName:'測試先發乙',pitcherEra:5,pitcherWhip:1.6}};
const runs={year:2026,league:4.5,source:'test-only',fetchedAt:now,rows:[{id:121,scored:760,allowed:600,batGames:150,pitchGames:150},{id:120,scored:600,allowed:750,batGames:150,pitchGames:150}]};
const report={game,capturedAt:now,features:{home_starter_recent_era:5,away_starter_recent_era:2},issues:[],context:{sides:{home:{lineupStatus:'confirmed'},away:{lineupStatus:'confirmed'}}}};
const npb=JSON.parse(readFileSync('data/npb-pregame-20260920.json','utf8'));npb.games=[npb.games[3]];const n=npb.games[0];
const market=(period,type,line='PK')=>({period,type,quotes:[{primary:true,open:true,homeLine:line,awayLine:'',total:'7.5',homePrice:'.95',awayPrice:'.95',over:'.95',under:'.95'}]});
const displayMarkets=[market('full',103),market('full',104),market('full',111),market('full',106,'1'),market('firstHalf',103),market('firstHalf',104),market('firstHalf',105)];
const odds={fetchedAt:now,source:'hr9988',games:[{id:777,home:'華盛頓國民',away:'紐約大都會',start:'2026/09/20 15:00:00',live:false,displayMarkets}],internationalGames:[{id:888,league:'NPB',home:n.home.team,away:n.away.team,start:n.start,live:false,displayMarkets}]};
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3035'],{env:{...process.env,YJ_RENDER_HTTP_TEST:'1',YJ_FOOTBALL_ADMIN_SMOKE:'1',YJ_BACKGROUND_REFRESH:'0',DATABASE_URL:'postgresql://local-test/fixture',TZ_BINDING_KEY:Buffer.alloc(32).toString('base64'),PLATFORM_ADMIN_USERNAME:'render-test-admin',APP_ORIGIN:origin,NODE_OPTIONS:'--import ./tests/render-http-preload.mjs'},stdio:['ignore','pipe','pipe']});
let output='',browser;const results=[];server.stdout.on('data',x=>output+=x);server.stderr.on('data',x=>output+=x);
try{
 let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error(output);try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await delay(250);}assert.ok(ready,'server ready');
 browser=await chromium.launch({headless:true});
 for(const [size,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  const context=await browser.newContext({viewport,locale:'zh-TW'}),page=await context.newPage(),errors=[],writes=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route(origin+'/**',async route=>{
   const request=route.request(),u=new URL(request.url()),path=u.pathname,kind=u.searchParams.get('kind');
   const json=body=>route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
   if(path==='/api/member-odds')return json(odds);
   if(path==='/api/baseball')return json(kind==='schedule'?{games:[game],fetchedAt:now,source:'test-only'}:kind==='runs'?runs:{games:[],rows:[],fetchedAt:now});
   if(path==='/api/analysis') {writes.push(request.postData());return json(report);}
   if(path==='/api/analysis/results')return json({});
   if(path==='/api/international')return json(kind==='npb-pregame'?{pregame:npb,status:'ready',fetchedAt:npb.observedAt}:{tables:[],games:[],status:'ok',fetchedAt:now});
   if(path==='/api/sport-live'||path==='/api/international-live')return json({games:[],fetchedAt:now});
   const response=await route.fetch({headers:{...request.headers(),cookie}});return route.fulfill({response});
  });
  await page.route('https://baseballsavant.mlb.com/**',route=>route.fulfill({contentType:'text/csv',body:'player_id,avg_hit_speed\n101,90'}));
  await page.clock.install({time:new Date(now)});
  await page.goto(origin+'/?league=MLB&view=analysis');
  const mlb=page.locator('[data-super-league="MLB"]'),trigger=mlb.getByRole('button',{name:/模型比例/}),dialog=page.getByRole('dialog',{name:'棒球模型比例'}),card=mlb.locator('[data-game-id="1"]');
  await card.waitFor();await page.waitForFunction(()=>document.querySelector('[data-game-id="1"] .match-team-summary[data-side="home"]')?.textContent.includes('25%'));
  const before=await card.locator('.match-team-summary[data-side="home"]').textContent();
  await trigger.click();assert.equal(await dialog.getByRole('slider').count(),10);const first=dialog.getByRole('slider').first(),initial=Number(await first.inputValue());assert.ok(Math.abs(initial-13.333333)<.05);
  await first.press('End');await dialog.getByRole('button',{name:'取消',exact:true}).click();await trigger.click();assert.equal(Number(await first.inputValue()),initial);
  await dialog.getByRole('slider',{name:/先發投手本季防禦率/}).press('End');await dialog.getByRole('button',{name:'套用',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-game-id="1"] .match-team-summary[data-side="home"]')?.textContent.includes('13%'));assert.notEqual(await card.locator('.match-team-summary[data-side="home"]').textContent(),before);
  await trigger.click();await dialog.getByLabel('全場獨贏套用模型').selectOption('innings');await dialog.getByRole('button',{name:'逐局得分',exact:true}).click();assert.equal(await dialog.getByRole('slider').count(),4);
  await dialog.getByRole('slider',{name:/己方得分能力/}).press('End');await dialog.getByRole('button',{name:'套用',exact:true}).click();
  const expectRuns=await card.locator('.tabular-nums').first().textContent();assert.match(expectRuns,/5\.0.*4\.1/);
  await card.locator('.match-market-details>summary').click();await card.getByRole('tab',{name:'全場獨贏',exact:true}).click();await card.getByRole('button').filter({hasText:'紐約大都會'}).click();assert.ok(await mlb.getByText('已選 1／3 關',{exact:true}).isVisible());
  await trigger.click();await dialog.getByRole('slider',{name:/先發投手防禦率/}).press('End');await dialog.getByRole('button',{name:'套用',exact:true}).click();assert.ok(await mlb.getByText('已選 0／3 關',{exact:true}).isVisible());
  await page.reload();await card.waitFor();await trigger.click();assert.equal(await dialog.getByLabel('全場獨贏套用模型').inputValue(),'innings');assert.equal(Number(await dialog.getByRole('slider').first().inputValue()),100);
  await page.screenshot({path:`${directory}/${size}-innings.png`});
  assert.ok(await dialog.evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight&&el.getBoundingClientRect().top>=0));
  await page.keyboard.press('Escape');await page.getByRole('navigation',{name:'棒球聯盟切換'}).getByRole('button',{name:/NPB/}).click();
  const npbRoot=page.locator('[data-super-league="NPB"]'),npbTrigger=npbRoot.getByRole('button',{name:/模型比例/}),npbCard=npbRoot.locator('.international-match-card').first();
  await npbCard.waitFor();const npbBefore=await npbCard.locator('.international-match-name').allTextContents();await npbTrigger.click();assert.equal(await dialog.getByLabel('全場獨贏套用模型').inputValue(),'multifactor');assert.equal(await dialog.getByRole('slider').count(),10);
  await dialog.getByRole('slider',{name:/先發投手本季防禦率/}).press('End');await page.screenshot({path:`${directory}/${size}-multifactor.png`});
  await dialog.locator('.baseball-model-body').evaluate(el=>el.scrollTop=el.scrollHeight);assert.ok(await dialog.getByRole('slider',{name:/主場優勢/}).isVisible());await page.screenshot({path:`${directory}/${size}-scroll.png`});await dialog.getByRole('button',{name:'套用',exact:true}).click();
  assert.notDeepEqual(await npbCard.locator('.international-match-name').allTextContents(),npbBefore);
  await page.reload();await npbCard.waitFor();await npbTrigger.click();assert.equal(Number(await dialog.getByRole('slider',{name:/先發投手本季防禦率/}).inputValue()),100);await page.keyboard.press('Escape');
  await npbCard.scrollIntoViewIfNeeded();await page.screenshot({path:`${directory}/${size}-analysis.png`});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'analysis page horizontal overflow');
  await npbTrigger.click();await dialog.getByRole('button',{name:'還原此模型預設'}).click();assert.ok(Math.abs(Number(await dialog.getByRole('slider').first().inputValue())-initial)<.001);await dialog.getByRole('button',{name:'套用',exact:true}).click();
  await page.getByRole('navigation',{name:'棒球聯盟切換'}).getByRole('button',{name:/MLB/}).click();await trigger.click();assert.equal(await dialog.getByLabel('全場獨贏套用模型').inputValue(),'innings');await page.keyboard.press('Escape');
  for(const label of ['概覽','戰績排名','球隊一覽','即時比分']){await mlb.getByRole('tab',{name:label,exact:true}).click();assert.ok(await trigger.isVisible());}await mlb.getByRole('tab',{name:'賽前分析・串關'}).click();
  assert.ok(writes.every(body=>{const d=JSON.parse(body);return Object.keys(d).length===1&&d.gameId===1;}),'personal settings never sent to shared forecast writes');
  assert.deepEqual(errors,[]);results.push({size,passed:true});await page.unrouteAll({behavior:'ignoreErrors'});await context.close();
 }
 writeFileSync(directory+'/result.json',JSON.stringify(results,null,2));console.log('PASS: MLB/NPB desktop and mobile model calculations, apply/cancel/reset, persistence, league isolation, selected-leg reset, shared-ledger isolation, dialog scrolling and navigation.');
}catch(error){writeFileSync(directory+'/failure.json',JSON.stringify({error:String(error),stack:error.stack,results},null,2));if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.screenshot({path:directory+'/failure.png'}).catch(()=>{});throw error;}
finally{writeFileSync(directory+'/server.log',output);if(browser)for(const c of browser.contexts())for(const p of c.pages())await p.unrouteAll({behavior:'ignoreErrors'});await browser?.close();server.kill('SIGTERM');if(server.exitCode===null)await new Promise(resolve=>server.once('exit',resolve));}
