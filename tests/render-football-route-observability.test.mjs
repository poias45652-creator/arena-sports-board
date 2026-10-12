import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const routeSource=readFileSync('app/api/football/route.ts','utf8').replace(/^import .*;\n/gm,'');
const traceSource=readFileSync('lib/football-route-observability.ts','utf8');
let serial=0;
async function loadRoute(options={}){
  const harness=`
    let fixture,clock=1000;
    export const calls=[],logs=[];
    const performance={now:()=>clock};
    const console={warn(event,raw){if(fixture.logFailure)throw Error('log transport unavailable');logs.push({event,...JSON.parse(raw)});}};
    function called(stage,args=[]){calls.push({stage,args});clock+=10;if(fixture.errors?.[stage])throw fixture.errors[stage];}
    export function configure(value){fixture=value;}
    export function advanceClock(ms){clock+=ms;}
    const footballDay=()=>'2026-10-12';
    const isFootballLeague=value=>['eng.1','esp.1','ita.1','ger.1','fra.1','uefa.champions','uefa.nations'].includes(value);
    const validFootballDay=value=>/^\\d{4}-\\d{2}-\\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
    const getRawDb=()=>{called('db');return {fixtureDb:true};};
    async function footballGameAnalysis(...args){called('analysis',args);return fixture.report??null;}
    async function footballSchedule(league,day){called('schedule',[league,day]);return fixture.schedule??{league,day,games:[],fetchedAt:'2026-10-12T11:00:00Z',calendar:['2026-10-13']};}
    async function nextFootballDay(...args){called('next',args);return {day:'2026-10-13'};}
    async function loadFootballForecast(...args){called('load_forecast',args);return fixture.savedReport??null;}
    async function saveFootballForecast(...args){called('save_forecast',args);return fixture.snapshotSaved??args[2].status==='ready';}
    async function saveDailyForecast(...args){called('save_daily_forecast',args);return fixture.dailySaved??true;}
    async function saveFootballResults(...args){called('save_results',args);return 0;}
    async function saveDailyResults(...args){called('save_daily_results',args);return 0;}
  `;
  const source=ts.transpileModule(traceSource+'\n'+harness+'\n'+routeSource+'\n// instance '+serial++,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  mod.configure(options);return mod;
}
const request=(query='kind=analysis&league=uefa.champions&date=2026-10-14&game=12345')=>new Request('https://arena.test/api/football?'+query,{headers:{Cookie:'fixture-cookie-private',Authorization:'Bearer fixture-token-private'}});
const stages=mod=>mod.calls.map(c=>c.stage);
const context={league:'uefa.champions',date:'2026-10-14',kind:'analysis',game:'12345'};
const waiting=()=>({status:'waiting',reason:'歷史不足：主隊3場、客隊4場；各需至少5場。',version:'fixture-version',capturedAt:'2026-10-12T11:00:00Z',homeForm:{games:3,supplementGames:2},awayForm:{games:4,supplementGames:0},quality:{historyConflicts:1,archiveSupplementGames:2},notes:[]});
const ready=()=>({...waiting(),status:'ready',reason:'',probabilities:{home:.4,draw:.3,away:.3,over25:.5,under25:.5,btts:.5}});
const report=(analysis=waiting(),started=false)=>({game:{id:'12345',league:'uefa.champions',start:new Date(Date.now()+(started?-1:1)*86400000).toISOString()},analysis,sourceFetchedAt:'2026-10-12T11:00:00Z'});

test('football source failures log bounded context and elapsed category, preserving the public error',async()=>{
  const error=new DOMException('fixture-cookie-private Bearer fixture-token-private <html>private upstream body</html>','TimeoutError');
  const mod=await loadRoute({errors:{analysis:error}});
  const response=await mod.GET(request('kind=analysis&league=uefa.champions&date=2026-10-14&game=12345&token=fixture-query-private'));
  assert.equal(response.status,502);
  assert.equal(response.headers.get('Cache-Control'),'private, no-store');
  assert.deepEqual(await response.json(),{error:'足球資料暫時無法更新，請稍後重試。'});
  assert.deepEqual(mod.logs,[{event:'football-route-failure',...context,elapsedMs:10,stage:'analysis',errorCategory:'timeout'}]);
  assert.doesNotMatch(JSON.stringify(mod.logs),/fixture-cookie|fixture-token|fixture-query|Bearer|<html>|stack/);
  assert.deepEqual(stages(mod),['analysis']);
});

test('waiting analysis logs its reason category and real history counts without changing the response',async()=>{
  const input=report(),mod=await loadRoute({report:input});
  const response=await mod.GET(request());
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{...input,snapshotSaved:false,dailySaved:false});
  assert.deepEqual(stages(mod),['analysis','db','save_forecast']);
  assert.deepEqual(mod.logs,[{event:'football-analysis-result',...context,elapsedMs:30,stage:'response',status:'waiting',reasonCategory:'history_insufficient',historyCounts:{home:3,away:4,homeSupplement:2,awaySupplement:0,conflicts:1,archiveSupplement:2}}]);
  assert.doesNotMatch(JSON.stringify(mod.logs),/歷史不足|fixture-version|capturedAt|probabilities/);
});

test('analysis logs report the actual retained forecast returned after kickoff without new writes',async()=>{
  const input=report({...waiting(),status:'closed',reason:'已開賽、完場或非正常賽程，不提供賽前分析。'},true);
  const saved={...input,analysis:ready(),retained:true,snapshotSaved:true,sourceFetchedAt:'2026-10-12T10:00:00Z'};
  const mod=await loadRoute({report:input,savedReport:saved});
  const response=await mod.GET(request());
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{...saved,sourceFetchedAt:input.sourceFetchedAt});
  assert.deepEqual(stages(mod),['analysis','db','load_forecast']);
  assert.equal(mod.logs.length,1);
  assert.equal(mod.logs[0].status,'ready');
  assert.equal(mod.logs[0].reasonCategory,'none');
});

test('optional forecast write failures keep the existing saved flags and successful analysis',async t=>{
  for(const [stage,snapshotSaved,expectedCalls] of [
    ['db',false,['analysis','db']],
    ['save_forecast',false,['analysis','db','save_forecast']],
    ['save_daily_forecast',true,['analysis','db','save_forecast','save_daily_forecast']],
  ])await t.test(stage,async()=>{
    const input=report(ready()),mod=await loadRoute({report:input,errors:{[stage]:new Error('postgres://fixture-private-secret@db/internal query')}});
    const response=await mod.GET(request());
    assert.equal(response.status,200);
    assert.deepEqual(await response.json(),{...input,snapshotSaved,dailySaved:false});
    assert.deepEqual(stages(mod),expectedCalls);
    assert.equal(mod.logs[0].event,'football-route-failure');
    assert.equal(mod.logs[0].stage,stage==='db'?'save_forecast':stage);
    assert.equal(mod.logs[0].errorCategory,'unknown');
    assert.equal(mod.logs[1].status,'ready');
    assert.doesNotMatch(JSON.stringify(mod.logs),/fixture-private|postgres:|internal query/);
  });
});

test('retained forecast read failure still returns the existing 502 with a distinct stage',async()=>{
  const mod=await loadRoute({report:report(waiting(),true),errors:{load_forecast:new Error('private database detail')}});
  const response=await mod.GET(request());
  assert.equal(response.status,502);
  assert.deepEqual(await response.json(),{error:'足球資料暫時無法更新，請稍後重試。'});
  assert.equal(mod.logs.length,1);
  assert.equal(mod.logs[0].stage,'load_forecast');
  assert.deepEqual(stages(mod),['analysis','db','load_forecast']);
});

test('missing fixture is observable as not found and never starts a ledger operation',async()=>{
  const mod=await loadRoute(),response=await mod.GET(request());
  assert.equal(response.status,404);
  assert.deepEqual(await response.json(),{error:'本日找不到此賽事，請更新賽程'});
  assert.deepEqual(stages(mod),['analysis']);
  assert.equal(mod.logs[0].status,'not_found');
  assert.equal(mod.logs[0].reasonCategory,'fixture_missing');
  assert.equal(mod.logs[0].historyCounts.home,null);
});

test('valid schedule and next successes stay quiet and keep the existing response contract',async()=>{
  const mod=await loadRoute();
  const schedule=await mod.GET(request('kind=schedule&league=eng.1&date=2026-10-12&game=fixture-query-private'));
  assert.deepEqual(await schedule.json(),{league:'eng.1',day:'2026-10-12',games:[],fetchedAt:'2026-10-12T11:00:00Z'});
  assert.equal(schedule.status,200);
  const next=await mod.GET(request('kind=next&league=eng.1&date=2026-10-12'));
  assert.deepEqual(await next.json(),{day:'2026-10-13'});
  assert.deepEqual(stages(mod),['schedule','db','save_results','save_daily_results','next']);
  assert.deepEqual(mod.logs,[]);
});

test('failed result persistence remains nonfatal and retries on the next schedule visit',async t=>{
  for(const stage of ['save_results','save_daily_results'])await t.test(stage,async()=>{
    const errors={[stage]:new Error('private sql detail')},mod=await loadRoute({errors});
    assert.equal((await mod.GET(request('kind=schedule'))).status,200);
    assert.equal(mod.logs.length,1);
    assert.equal(mod.logs[0].stage,stage);
    assert.equal(mod.logs[0].game,null);
    delete errors[stage];
    assert.equal((await mod.GET(request('kind=schedule'))).status,200);
    const countAfterSuccess=stages(mod).filter(s=>s==='save_results').length;
    assert.equal(countAfterSuccess,2);
    assert.equal((await mod.GET(request('kind=schedule'))).status,200);
    assert.equal(stages(mod).filter(s=>s==='save_results').length,countAfterSuccess,'successful result writes keep their ten-minute throttle');
    assert.equal(mod.logs.length,1,'successful retry and schedule polls do not emit success logs');
  });
});

test('schedule and next failures retain distinct source stages and ignore irrelevant game text',async t=>{
  for(const kind of ['schedule','next'])await t.test(kind,async()=>{
    const mod=await loadRoute({errors:{[kind]:new Error('足球資料來源暫時無法連線')}});
    const response=await mod.GET(request('kind='+kind+'&game=fixture-query-private'));
    assert.equal(response.status,502);
    assert.equal(mod.logs[0].stage,kind);
    assert.equal(mod.logs[0].kind,kind);
    assert.equal(mod.logs[0].game,null);
    assert.equal(mod.logs[0].errorCategory,'source_http');
    assert.doesNotMatch(JSON.stringify(mod.logs),/fixture-query-private/);
  });
});

test('rejected route parameters are never echoed into diagnostics or sent to sources',async()=>{
  const mod=await loadRoute();
  for(const query of ['kind=fixture-private','league=fixture-private','date=fixture-private','date=2026-02-30','kind=analysis&game=fixture-private'])assert.equal((await mod.GET(request(query))).status,400);
  assert.deepEqual(mod.calls,[]);
  assert.deepEqual(mod.logs,[]);
});

test('diagnostic categories whitelist known failures and never serialize arbitrary thrown values',async()=>{
  const mod=await loadRoute(),trace=mod.createFootballRouteTrace(context);
  trace.stage('analysis');
  const samples=[
    [new DOMException('fixture-private','AbortError'),'aborted'],
    [new SyntaxError('fixture-private response body'),'invalid_json'],
    [Object.assign(new Error('fixture-private'),{cause:{code:'ETIMEDOUT'}}),'timeout'],
    [Object.assign(new Error('fixture-private'),{code:'ECONNRESET'}),'network'],
    [new Error('足球來源格式改變'),'source_format'],
    [new Error('足球來源資料過大'),'source_too_large'],
    [new Error('球隊歷史來源身分不符'),'history_identity'],
    [new Error('國家隊歷史來源超出分頁上限'),'history_limit'],
    [new Error('無效進球參數'),'model_input'],
    [new Error('fixture-private unknown failure'),'unknown'],
    [{code:'fixture-private',body:'fixture-private',stack:'fixture-private'},'unknown'],
  ];
  for(const [error,category] of samples){trace.failure(error);assert.equal(mod.logs.at(-1).errorCategory,category);}
  assert.doesNotMatch(JSON.stringify(mod.logs),/fixture-private|stack|body|cause/);
});

test('waiting reason categories cover existing data gates and unknown details stay private',async()=>{
  const mod=await loadRoute(),trace=mod.createFootballRouteTrace(context);
  for(const [reason,expected] of [
    ['開賽時間尚未確認。','kickoff_unconfirmed'],
    ['近期賽果超過120天，等待較新的比賽資料。','history_stale'],
    ['本季賽果來源未完整更新，暫停分析以免遺漏最新比賽。','current_history_incomplete'],
    ['本年國家隊賽果來源尚未完整更新，等待最新資料。','national_history_incomplete'],
    ['國家隊對手強度資料尚未更新。','national_strength_unavailable'],
    ['國家隊對手強度資料尚未完整更新。','national_strength_unavailable'],
    ['fixture-private unexpected upstream detail','other'],
  ]){trace.analysis({...waiting(),reason});assert.equal(mod.logs.at(-1).reasonCategory,expected);}
  const malformed={...waiting(),status:'fixture-private',reason:'fixture-private',homeForm:{games:'fixture-private',supplementGames:-1},awayForm:{games:Infinity,supplementGames:1000001},quality:{historyConflicts:.5,archiveSupplementGames:NaN}};
  trace.analysis(malformed);
  assert.equal(mod.logs.at(-1).status,'unknown');
  assert.deepEqual(Object.values(mod.logs.at(-1).historyCounts),[null,null,null,null,null,null]);
  assert.equal(malformed.homeForm.games,'fixture-private','logging never edits the analysis');
  assert.doesNotMatch(JSON.stringify(mod.logs),/fixture-private/);
  trace.analysis(undefined);
  assert.equal(mod.logs.at(-1).status,'unknown');
  assert.equal(mod.logs.at(-1).reasonCategory,'analysis_missing');
  mod.advanceClock(-20);trace.failure(new Error('private'));
  assert.equal(mod.logs.at(-1).elapsedMs,0);
});

test('a failed log sink cannot turn a successful analysis into an error or hide the existing 502',async()=>{
  const input=report(ready()),mod=await loadRoute({report:input,logFailure:true});
  const response=await mod.GET(request());
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{...input,snapshotSaved:true,dailySaved:true});
  mod.configure({errors:{analysis:new Error('private source detail')},logFailure:true});
  const failed=await mod.GET(request());
  assert.equal(failed.status,502);
  assert.deepEqual(await failed.json(),{error:'足球資料暫時無法更新，請稍後重試。'});
});
