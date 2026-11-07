import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
import {renderToStaticMarkup} from 'react-dom/server';
import {moduleUrl} from './profile-loader.mjs';

const {projectScheduleReport,validScheduleCatalog,validScheduleReceipt,siteSchedules} = await import(moduleUrl('lib/project-schedules.ts'));
const registration = JSON.parse(readFileSync('data/operations/schedules.json','utf8'));
const require = createRequire(import.meta.url);

test('排程來源或回執失聯時仍可呈現登記，從未收到結果的任務不可標成成功', async t=>{
  t.mock.method(globalThis,'fetch',async()=>{throw new Error('offline');});
  const report = await projectScheduleReport();
  assert.equal(report.synced,false);
  assert.deepEqual(report.tasks.map(t=>t.key),registration.map(t=>t.key));
  assert.ok(report.tasks.every(t=>t.receipt===null));
  assert.ok(report.workflows.every(w=>!w.observed && w.started===null));
});

test('讀取各任務專屬回執，網站定時工作只採正式分支的排程紀錄', async t=>{
  const [task, pending] = registration;
  const done = {key:task.key,reportedAt:'2026-11-07T10:00:00Z',outcome:'partial',checked:3,issues:1};
  t.mock.method(globalThis,'fetch',async url=>{
    if(url.endsWith('/schedules.json'))return Response.json([task,pending]);
    if(url.endsWith('/runs/'+task.key+'.json'))return Response.json(done);
    if(url.endsWith('/runs/'+pending.key+'.json'))return Response.json({...done,key:pending.key,outcome:null,reportedAt:null,checked:null,issues:null});
    assert.match(url,/event=schedule&branch=main&per_page=1/);
    return Response.json({workflow_runs:[{conclusion:'failure',run_started_at:done.reportedAt}]});
  });
  const report=await projectScheduleReport();
  assert.equal(report.synced,true);
  assert.deepEqual(report.tasks[0].receipt,done);
  assert.equal(report.tasks[1].receipt.outcome,null);
  assert.ok(report.workflows.every(w=>w.observed&&w.state==='failure'));
  assert.equal(validScheduleReceipt(done,pending.key),false);
  assert.equal(validScheduleReceipt({...done,checked:-1},task.key),false);
  assert.equal(validScheduleReceipt({...done,reportedAt:null},task.key),false);
  assert.equal(validScheduleCatalog([task,task]),false);
  assert.equal(validScheduleCatalog([{...task,key:'../invalid'}]),false);
});

test('登記所有網站定時工作流；來訪者未取得管理員身分前不讀取排程', async()=>{
  const workflowFolder='.github/workflows/';
  const scheduled=readdirSync(workflowFolder).filter(f=>/\bcron:\s*/.test(readFileSync(workflowFolder+f,'utf8')));
  assert.deepEqual(siteSchedules.map(w=>w.file).sort(),scheduled.sort());
  const source=readFileSync('app/admin/schedules/page.tsx','utf8');
  const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  let authenticated=false, reads=0;
  const exports={};
  const deps={
    'next/navigation':{redirect:url=>{throw Error(url);}},
    '../../admin-access':{adminIdentity:async()=>authenticated},
    '@/lib/project-schedules':{scheduleProjectUrl:'https://chatgpt.com',projectScheduleReport:async()=>{reads++;return {tasks:[{...registration[0],receipt:null}],workflows:[],synced:true};}},
    '@/server/baseball-background-state.mjs':{baseballBackgroundStatus:()=>({enabled:false})},
  };
  new Function('exports','require',code)(exports,id=>deps[id]??require(id));
  await assert.rejects(exports.default(),/\/login/);
  assert.equal(reads,0);
  authenticated=true;
  const html=renderToStaticMarkup(await exports.default());
  assert.equal(reads,1);
  assert.match(html,/結算星準賽前傷停預測/);
  assert.match(html,/單次排定/);
  assert.match(html,/回執暫時無法讀取/);
});
