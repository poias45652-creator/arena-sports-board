import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import assert from 'node:assert/strict';
const origin='http://127.0.0.1:3036',cookie='__Host-arena_tz='+'f'.repeat(64);
const server=spawn(process.execPath,['scripts/render-start.mjs'],{env:{...process.env,YJ_AI_ASSISTANT_SMOKE:'1',YJ_RENDER_HTTP_TEST:'1',YJ_FOOTBALL_ADMIN_SMOKE:'1',YJ_BACKGROUND_REFRESH:'0',DATABASE_URL:'postgresql://local-test/fixture',TZ_BINDING_KEY:Buffer.alloc(32).toString('base64'),PLATFORM_ADMIN_USERNAME:'render-test-admin',APP_ORIGIN:origin,PORT:'3036',NODE_OPTIONS:'--import ./tests/ai-assistant-http-preload.mjs'},stdio:['ignore','pipe','pipe']});
let output='',checks=0;server.stdout.on('data',b=>output+=b);server.stderr.on('data',b=>output+=b);
async function request(path,status,options={}){const r=await fetch(origin+path,{redirect:'manual',...options});assert.equal(r.status,status,`${path}: ${await r.clone().text()}`);checks++;return r;}
try{
 let ready=false;for(let i=0;i<120;i++){if(server.exitCode!==null)throw Error('Server exited');try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await delay(250);}assert.ok(ready,'Server startup');
 await request('/ai-assistant',307);await request('/api/ai-assistant?kind=status',401);await request('/api/admin/ai-assistant',401);
 const html=await (await request('/ai-assistant',200,{headers:{cookie}})).text();assert.match(html,/AI星準助手/);
 const member='__Host-arena_tz='+'e'.repeat(64);await request('/api/admin/ai-assistant',403,{headers:{cookie:member}});
 const status=await (await request('/api/ai-assistant?kind=status',200,{headers:{cookie}})).json();assert.equal(status.aiEnabled,false);
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(Date.now()+3600000));
 const matches=await (await request('/api/ai-assistant?league=MLB&date='+day,200,{headers:{cookie}})).json();assert.equal(matches.matches[0].id,'999001');
 const headers={cookie,origin,'Content-Type':'application/json'},ask=(body)=>({method:'POST',headers,body:JSON.stringify({league:'MLB',day,gameId:'999001',...body})});
 await request('/api/ai-assistant',403,{...ask({action:'analysis'}),headers:{...headers,origin:'https://wrong.test'}});
 const answer=await (await request('/api/ai-assistant',200,ask({action:'analysis'}))).json();assert.match(answer.answer,/紐約洋基/);assert.match(answer.answer,/先發本季 ERA/);
 const weight=await (await request('/api/ai-assistant',200,ask({action:'weights'}))).json();assert.equal(weight.suggestion.storageKey,'xingzhun:team-weights:v1:MLB');assert.equal(weight.suggestion.teams.length,2);assert.notDeepEqual(weight.suggestion.teams[0].weights,weight.suggestion.teams[1].weights);for(const team of weight.suggestion.teams)assert.ok(Math.abs(team.weights.reduce((n,w)=>n+w.value,0)-100)<1e-8);
 const risk=await (await request('/api/ai-assistant',200,ask({action:'risk'}))).json();assert.equal(risk.answer,'因分析資料不足無法分析');
 const missing=await (await request('/api/ai-assistant',200,ask({gameId:'unlisted',action:'analysis'}))).json();assert.deepEqual(missing,{answer:'因分析資料不足無法分析'});
 await request('/api/ai-assistant',503,ask({question:'為什麼看好主隊？'}));
 await request('/api/admin/ai-assistant',200,{method:'POST',headers,body:JSON.stringify({key:'sk-isolated-test-'+ 'a'.repeat(30)})});
 const config=await (await request('/api/admin/ai-assistant',200,{headers:{cookie}})).json();assert.equal(config.enabled,true);assert.doesNotMatch(JSON.stringify(config),/sk-isolated/);
 const ai=await (await request('/api/ai-assistant',200,ask({question:'為什麼看好主隊？'}))).json();assert.equal(ai.mode,'ai');assert.match(ai.answer,/紐約洋基/);
 const aiRisk=await (await request('/api/ai-assistant',200,ask({question:'這場有哪些不利因素？'}))).json();assert.equal(aiRisk.answer,'因分析資料不足無法分析');
 const off=await (await request('/api/ai-assistant',200,ask({question:'推薦股票'}))).json();assert.equal(off.answer,'僅能詢問所選星準場次的分析原因與建議權重。');
 console.log(`${checks} compiled HTTP checks passed with isolated database and synthetic sports/provider fixtures.`);
}catch(e){console.error(output);throw e;}finally{server.kill('SIGTERM');}
