import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createDatabase} from '../server/database.mjs';
import {snapshot} from '../server/regional-basketball/archive.mjs';
import {captureLeague} from '../server/regional-basketball/capture.mjs';
import {readForecasts,saveForecast} from '../server/regional-basketball/forecast-store.mjs';
import {analysis, reportFor} from '../public/regional-basketball/analysis-ui.js';

const date='2026-11-09';
const league='KBL';
const info=(await snapshot('/data/leagues.json')).KBL;
const all=(await snapshot('/data/kbl-team-games.json')).filter(g=>g.season===2027);
const game=all.find(g=>g.id==='S49G01N62');
const boxes=await snapshot('/data/kbl-boxes.json');
const start=Date.parse(game.startsAt);
const state=()=>({info,league,all,teamGames:all,boxes,context:{injuries:[]},saved:{},frozen:{},
  projections:new Map(),version:1,visible:[],isLive:true,rosters:{}});
function viewer(t){
 const original=globalThis.document;
 globalThis.document={body:{dataset:{viewer:'true'}}};
 t.after(()=>{if(original)globalThis.document=original;else delete globalThis.document;});
}

test('水原 KT 對首爾三星：首次於第一節開頁也有回算，本場比分與同日資料均不影響數字',t=>{
 viewer(t);
 t.mock.method(Date,'now',()=>start+600000);
 const s=state(), playing={...game,status:'in_progress',awayScore:21,homeScore:20};
 const before=reportFor(s,playing);
 assert.ok(before.ready&&before.replay);
 assert.equal(before.homeMetrics.games,12);
 assert.equal(before.awayMetrics.games,12);
 s.all=[...s.all,{...playing,status:'final',homeScore:120,awayScore:98}];
 s.version++;
 const final={...playing,homeScore:1,awayScore:190,status:'final'};
 assert.deepEqual(reportFor(s,final),before);
 const html=analysis({...s,visible:[final]});
 assert.match(html,/歷史回算/);
 assert.match(html,/預估比分/);
 assert.doesNotMatch(html,/此場開賽前未收錄|勝方命中|勝方未命中|賽前存檔/);
 assert.deepEqual(s.saved,{});
 assert.equal(reportFor(s,{...game,status:'postponed'}).ready,false);
 assert.equal(reportFor(s,{...game,timeConfirmed:false}).ready,false);
});

test('server captures without viewers and a fresh viewer reads the exact pre-tip model',async t=>{
 viewer(t);
 const clock=t.mock.method(Date,'now',()=>start-7200000);
 const records=[];
 const source={feed:async day=>({games:day===date?[game]:[]}),history:async()=>all.filter(g=>g.status==='final'),
   box:async()=>{throw Error('no new boxes')}};
 const result=await captureLeague(league,async(l,g,report)=>{
   records.push({...report,startsAt:g.startsAt});return true;
 },source);
 assert.equal(result.written,1);
 const s=state(), k=[date,game.home,game.away].join('/');
 s.archived={[k+'/'+start]:records[0]};
 clock.mock.mockImplementation(()=>start+1);
 const after=reportFor(s,{...game,status:'in_progress'});
 assert.deepEqual(after,{...records[0],frozen:true});
 assert.equal(reportFor(s,{...game,status:'in_progress',time:'17:59',startsAt:date+'T17:59:00+08:00'}).replay,true);
 assert.equal((await captureLeague(league,()=>assert.fail('late capture'),source)).eligible,0);
});

test('durable archive rejects late writes and preserves the newest valid record across retries',async t=>{
 const pg=new PGlite();
 t.after(()=>pg.close());
 await pg.exec('BEGIN;'+await readFile('db/render-schema.sql','utf8')+'COMMIT;SET search_path TO yj_platform_v1,pg_catalog;');
 const db=createDatabase({async query(sql,values){const r=await pg.query(sql,values);return {...r,rowCount:r.affectedRows};}});
 const day=new Date(Date.now()+2*86400000).toISOString().slice(0,10);
 const g={...game,date:day,time:'12:00'}, now=Date.now();
 const report={ready:true,asOf:new Date(now).toISOString(),homeProb:.55};
 assert.ok(await saveForecast(db,league,g,report));
 assert.equal(await saveForecast(db,league,g,report),false);
 assert.equal(await saveForecast(db,league,g,{...report,asOf:new Date(now-1000).toISOString()}),false);
 assert.equal(await saveForecast(db,league,g,{...report,replay:true}),false);
 const updated={...report,asOf:new Date(now+1).toISOString(),homeProb:.52};
 assert.ok(await saveForecast(db,league,g,updated));
 const [row]=await readForecasts(db,league,day);
 assert.equal(row.fixture,day+'/SAM/KT');
 assert.equal(row.report.homeProb,.52);
 assert.equal(row.report.asOf,updated.asOf);
 assert.deepEqual(await readForecasts(db,'NBL',day),[]);
 const yesterday=new Date(now-2*86400000).toISOString().slice(0,10);
 assert.equal(await saveForecast(db,league,{...g,date:yesterday},{...report,asOf:yesterday+'T00:00:00.000Z'}),false);
 assert.deepEqual(await readForecasts(db,league,yesterday),[]);
});
