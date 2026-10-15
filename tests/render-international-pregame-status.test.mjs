import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {moduleUrl} from './profile-loader.mjs';

const {internationalPregameNotice}=await import(moduleUrl('app/international-pregame-status.ts'));
const {internationalPregameHealth}=await import(moduleUrl('lib/international-pregame-health.ts'));
test('merged complete NPB data remains ready when an optional provider fails or fixtures have started',()=>{
 const feed={status:'ok',stale:false},ready={status:'ready'},started={status:'started'};
 assert.equal(internationalPregameHealth(feed,[ready,ready]),'ready');
 assert.equal(internationalPregameHealth(feed,[ready,started]),'ready');
 assert.equal(internationalPregameHealth(feed,[started,started]),'ready');
 assert.equal(internationalPregameHealth(feed,[ready,{status:'waiting_data'}]),'partial');
 assert.equal(internationalPregameHealth(feed,[{status:'ready',mode:'simulation'}]),'partial');
 assert.equal(internationalPregameHealth({status:'partial'},[ready]),'partial');
 assert.equal(internationalPregameHealth({status:'unavailable'},[ready]),'stale');
 assert.equal(internationalPregameHealth({status:'ok',stale:true},[ready]),'stale');
});
const tomorrow='2026-10-13',today='2026-10-12';
const unavailable={status:'unavailable',pregame:{date:tomorrow,games:[],observedAt:''},fetchedAt:null,playsport:{errors:['玩運彩 HTTP 403']}};
test('unavailable with no records reports missing data without claiming retained data or analysis',()=>{
  const before=JSON.stringify(unavailable),notice=internationalPregameNotice(unavailable,tomorrow);
  assert.equal(notice.status,'unavailable');assert.equal(notice.hasRecords,false);assert.equal(notice.retained,false);assert.equal(notice.observedAt,null);
  assert.match(notice.message,/來源暫時無法取得/);assert.match(notice.message,/尚未取得可用/);
  assert.doesNotMatch(notice.message,/保留|更新中|正在|已完成/);
  assert.equal(JSON.stringify(unavailable),before);
});
test('retention depends on actual same-day records and keeps their observation time',()=>{
  const observedAt='2026-10-12T10:00:00Z';
  for(const status of ['stale','unavailable']){
    const source={status,pregame:{date:today,games:[{date:today}],observedAt},fetchedAt:'2026-10-12T11:00:00Z'};
    const notice=internationalPregameNotice(source,today);
    assert.equal(notice.retained,true);assert.equal(notice.observedAt,'2026-10-12T10:00:00.000Z');assert.match(notice.message,/保留上次取得的同日資料/);
    for(const games of [[],[null],[{date:tomorrow}]]){
      const empty=internationalPregameNotice({...source,pregame:{...source.pregame,games}},today);
      assert.equal(empty.retained,false);assert.equal(empty.observedAt,null);assert.doesNotMatch(empty.message,/保留/);
    }
  }
  const failedBeforeFirstResponse=internationalPregameNotice({status:'stale',error:'private source detail'},today);
  assert.equal(failedBeforeFirstResponse.hasRecords,false);assert.match(failedBeforeFirstResponse.message,/更新失敗/);assert.doesNotMatch(failedBeforeFirstResponse.message,/保留|private/);
  for(const observedAt of [undefined,'','invalid']){
    const withoutOriginalTime=internationalPregameNotice({status:'stale',pregame:{date:today,games:[{date:today}],observedAt},fetchedAt:'2026-10-12T11:59:59Z'},today);
    assert.equal(withoutOriginalTime.retained,true);assert.equal(withoutOriginalTime.observedAt,null,'a recent response timestamp is never substituted for the original capture time');
  }
});
test('partial is distinct from retained stale data; successful empty days are not marked failed',()=>{
  const source={status:'partial',pregame:{date:today,games:[{date:today}],observedAt:'2026-10-12T10:00:00Z'}};
  const notice=internationalPregameNotice(source,today);
  assert.equal(notice.hasRecords,true);assert.equal(notice.retained,false);assert.match(notice.message,/部分賽前來源尚未齊全/);assert.match(notice.message,/仍可查看/);
  assert.equal(internationalPregameNotice({...source,status:'ready'},today),null);
  assert.equal(internationalPregameNotice({status:'ready',pregame:{date:today,games:[]},noGames:true},today),null);
  assert.equal(internationalPregameNotice(source,tomorrow),null);
  assert.equal(internationalPregameNotice(undefined,today),null);
  const invalidTime=internationalPregameNotice({...source,pregame:{...source.pregame,observedAt:'private bad timestamp'}},today);
  assert.equal(invalidTime.observedAt,null);assert.doesNotMatch(invalidTime.message,/private/);
});

// Render the actual Board -> Markets JSX path. Only unrelated UI wrappers are
// simplified; fixture selection, retirement exclusions and analysis stay real.
let clock=Date.parse('2026-10-12T11:00:00Z'),selectedDay='auto';
function FixtureDate(...args){return args.length?new Date(...args):new Date(clock);}
FixtureDate.now=()=>clock;FixtureDate.parse=Date.parse;FixtureDate.UTC=Date.UTC;
const Box=({children})=>React.createElement('div',null,children),Empty=()=>null;
const renderedButtons=[];
const Button=({children,disabled,onClick})=>{renderedButtons.push({children,disabled,onClick});return React.createElement('button',{disabled},children);};
const analysisSeen=[];
const model=await import(moduleUrl('lib/baseball-run-analysis.ts'));
const dependencies={
  react:{...React,useState(initial){return React.useState(initial==='auto'?selectedDay:initial);}},
  '@/components/ui/button':{Button},
  '@/components/ui/tabs':{Tabs:Box,TabsList:Box,TabsTrigger:Box,TabsContent:Box},
  '@/components/ui/select':{Select:Box,SelectContent:Box,SelectItem:Box,SelectTrigger:Box,SelectValue:Empty},
  'lucide-react':{RefreshCw:Empty},
  './baseball-model-details':{default:Empty},'./parlay-pane':{default:Box},'./market-outcomes':{default:Empty},'./international-team-logo':{default:Empty},
  './international-profile-link':{InternationalTeamLink:Box,NpbPlayerLink:({name})=>name},
  './international-market-analysis':{default:({analysis})=>{analysisSeen.push(analysis);return React.createElement('output',{'data-analysis-status':analysis?.status||'missing'},analysis?.win?'existing analysis':'no analysis');}},
  '@/lib/baseball-run-analysis':model,
};
for(const file of ['baseball-model-settings','board-markets','international-market-options','international-fixtures','international-board-fixtures','international-teams','international-pregame'])dependencies['@/lib/'+file]=await import(moduleUrl('lib/'+file+'.ts'));
const compiled=ts.transpileModule(readFileSync('app/international-markets.tsx','utf8'),{fileName:'markets.tsx',compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const Markets=new Function('require','exports','React','Date',compiled+'\nreturn exports.default;')(key=>{assert.ok(key in dependencies,'Mapped dependency: '+key);return dependencies[key];},{},React,FixtureDate);
const board=ts.createSourceFile('board.tsx',readFileSync('app/international-board.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let marketNode;function visit(node){if(ts.isJsxSelfClosingElement(node)&&node.tagName.getText(board)==='InternationalMarkets')marketNode=node;ts.forEachChild(node,visit);}visit(board);
assert.ok(marketNode,'Test the actual Board forwarding expression');
const wiringCode=ts.transpileModule('const element='+marketNode.getText(board),{fileName:'wiring.tsx',compilerOptions:{jsx:ts.JsxEmit.React,target:ts.ScriptTarget.ES2022}}).outputText;
function renderSource(source,date,{league='NPB',loading=false,now=Date.parse('2026-10-12T11:00:00Z'),onRefresh=()=>{},onOddsRefresh=async()=>{}}={}){
  clock=now;selectedDay=date;analysisSeen.length=0;renderedButtons.length=0;
  const scope={React,baseballModel:{settings:dependencies['@/lib/baseball-model-settings'].defaultBaseballSettings()},InternationalMarkets:Markets,internationalPregameNotice,data:{pregame:source},analysisDate:date,league,loading,setAnalysisDate:()=>{},setRevision:onRefresh,superData:{data:null,error:'',loading:false,refresh:onOddsRefresh}};
  const element=new Function(...Object.keys(scope),wiringCode+'\nreturn element;')(...Object.values(scope));
  assert.equal(element.props.pregame,source?.pregame,'Source records are forwarded unchanged');
  return renderToStaticMarkup(element);
}
test('a finished unavailable response renders a clear message even while unrelated data is loading',()=>{
  for(const league of ['NPB','CPBL','KBO']){
    const html=renderSource({...unavailable,error:'private source body'},tomorrow,{league,loading:true});
    assert.match(html,/role="status"/);assert.match(html,/2026-10-13 賽前來源暫時無法取得/);assert.match(html,/尚未取得可用的同日賽前資料/);
    assert.doesNotMatch(html,/正在取得|分析更新中|private source body|existing analysis/);
    assert.deepEqual(analysisSeen,[],'Empty source records never manufacture analysis cards');
  }
});
test('same-day partial and stale notices leave real ready analyses intact with the original timestamp',()=>{
  const snapshot=JSON.parse(readFileSync('data/playsport-capture-20260921.json','utf8')).find(x=>x.league==='NPB');
  const now=Date.parse('2026-09-21T04:05:00Z'),expected=model.buildRunAnalysis(snapshot.games[0],now,'NPB',true);
  assert.equal(expected.status,'ready');
  for(const status of ['partial','stale']){
    const before=JSON.stringify(snapshot),html=renderSource({status,pregame:snapshot,fetchedAt:snapshot.observedAt},snapshot.date,{now});
    assert.match(html,/data-analysis-status="ready"/);assert.ok(analysisSeen.some(a=>a?.status==='ready'));
    assert.match(html,status==='partial'?/部分賽前來源尚未齊全/:/賽前來源更新失敗/);
    assert.match(html,/資料擷取：/);assert.ok(html.includes(new Date(snapshot.observedAt).toISOString()));
    assert.equal(JSON.stringify(snapshot),before,'Notice never changes records, excluded fixtures or analysis inputs');
  }
  const ready=renderSource({status:'ready',pregame:snapshot},snapshot.date,{now});
  assert.match(ready,/data-analysis-status="ready"/);assert.doesNotMatch(ready,/賽前來源更新失敗|部分賽前來源尚未齊全/);
});
test('after first pitch the board explains why pregame recommendations stopped',()=>{
 const snapshot=JSON.parse(readFileSync('data/playsport-capture-20260921.json','utf8')).find(x=>x.league==='NPB');
 const html=renderSource({status:'ready',pregame:snapshot},snapshot.date,{now:Date.parse('2026-09-21T15:00:00Z')});
 assert.match(html,/賽事均已開賽，賽前推薦已停止/);
 assert.doesNotMatch(html,/部分賽前來源尚未齊全/);
 assert.ok(analysisSeen.every(a=>a?.status==='started'));
});

test('analysis refresh reloads both fixture statistics and quotes, and mobile reading order puts games first',()=>{
 const snapshot=JSON.parse(readFileSync('data/playsport-capture-20260921.json','utf8')).find(x=>x.league==='NPB');
 let dataRefresh=0,oddsRefresh=0;
 const html=renderSource({status:'ready',pregame:snapshot},snapshot.date,{now:Date.parse('2026-09-21T04:05:00Z'),onRefresh:()=>dataRefresh++,onOddsRefresh:async()=>{oddsRefresh++;}});
 const button=renderedButtons.find(b=>b.children==='更新資料');
 assert.ok(button);assert.equal(button.disabled,false);button.onClick();
 assert.equal(dataRefresh,1);assert.equal(oddsRefresh,1);
 assert.ok(html.indexOf('international-match-card')<html.indexOf('arena-analysis-summary'),'game cards precede the parlay form in the reading order');
});
