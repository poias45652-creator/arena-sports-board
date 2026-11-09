import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {visibleTrial,taipeiDay,probabilityLabel} from '../public/ui/homepage-data.js';
import {moduleUrl} from './profile-loader.mjs';
const {GET}=await import(moduleUrl('app/welcome/route.ts'));
const {BASEBALL_LEAGUES,BASKETBALL_LEAGUES}=await import(moduleUrl('lib/sport-navigation.ts'));
const {FOOTBALL_LEAGUES}=await import(moduleUrl('lib/football.ts'));
const leagues=[...BASEBALL_LEAGUES.map(l=>({...l,sport:'baseball'})),...BASKETBALL_LEAGUES.map(l=>({...l,sport:'basketball'})),...FOOTBALL_LEAGUES.map(l=>({...l,sport:'football'}))];
const now=Date.parse('2026-10-27T10:00:00Z');
const sample=()=>({status:'ready',day:taipeiDay(now),updatedAt:new Date(now).toISOString(),game:{key:'NPB:real-123',id:'real-123',sport:'baseball',league:'NPB',leagueName:'日本職棒',start:'2026-10-27T10:30:00Z',away:'客隊名稱',home:'主隊名稱'},probabilities:{home:.634,away:.366},progress:{state:'scheduled',label:'未開賽',stale:false}});
test('the former landing URL opens the independent brand site',()=>{
 const response=GET();assert.equal(response.status,307);
 assert.equal(response.headers.get('location'),'https://xingzhun-sports-home.poias45652.chatgpt.site/');
});
test('reported CPBL fixture and any backend-only league never enter homepage results',()=>{
 for(const [league,home,away] of [['CPBL','中信兄弟','統一獅'],['KBO','三星獅','樂天巨人']]){const value=sample();Object.assign(value.game,{league,home,away});assert.equal(visibleTrial(value,leagues,now),null);}
 const value=sample();value.game.league='NBA';assert.equal(visibleTrial(value,leagues,now),null,'league/sport mismatch');
});
test('only fresh, same-day real fixtures are displayed; failures never retain a sample',()=>{
 assert.equal(visibleTrial(sample(),leagues,now).game.id,'real-123');
 for(const patch of [{status:'empty'},{status:'unavailable'},{game:undefined},{day:'2026-10-26'},{updatedAt:'2026-10-27T09:57:59Z'},{progress:{stale:true}}])assert.equal(visibleTrial({...sample(),...patch},leagues,now),null);
 assert.equal(visibleTrial(sample(),leagues,Date.parse('2026-10-27T16:00:00Z')),null,'Taiwan midnight clears prior day');
 for(const patch of [{id:''},{home:''},{start:'invalid'},{start:'2026-10-26T10:30:00Z'}]){const value=sample();Object.assign(value.game,patch);assert.equal(visibleTrial(value,leagues,now),null);}
});
test('real probabilities round correctly; missing or malformed model output remains blank',()=>{
 assert.equal(probabilityLabel(visibleTrial(sample(),leagues,now).probabilities.home),'63%');
 for(const probabilities of [undefined,{home:.6},{home:68,away:32},{home:.9,away:.5},{home:null,away:1}]){const value=visibleTrial({...sample(),probabilities},leagues,now);assert.ok(value);assert.equal(value.probabilities,undefined);assert.equal(probabilityLabel(value.probabilities?.home),'—');}
});
let gateSource=ts.transpileModule(readFileSync('server/request-gate.ts','utf8'),{compilerOptions:{module:99,target:9}}).outputText;
gateSource=gateSource.replace(/import.*?from ['"]\.\.\/lib\/arena-session['"];?/s,"const VIEWER_COOKIE='__Host-yj_viewer';const readSession=async db=>db.session;");
const {gateRequest}=await import('data:text/javascript;base64,'+Buffer.from(gateSource).toString('base64'));
test('root opens the member selector; explicit analysis remains authenticated',async()=>{
 const req=p=>new Request('https://arena-sports-board.onrender.com'+p);
 let r=await gateRequest(req('/'),{session:null});assert.equal(r.status,307);assert.match(r.headers.get('location'),/\/platforms$/);
 r=await gateRequest(req('/?league=NBA'),{session:null});assert.equal(r.status,307);assert.match(r.headers.get('location'),/\/login$/);
 assert.equal((await gateRequest(req('/api/nba'),{session:null})).status,401);
 assert.match((await gateRequest(req('/'),{session:{memberId:'existing'}})).headers.get('location'),/\/platforms$/);
 assert.equal(await gateRequest(req('/?league=MLB&view=analysis'),{session:{memberId:'existing'}}),null);
 for(const session of [null,{memberId:'viewer'}]){
  const r=await gateRequest(new Request('https://arena-sports-board.onrender.com/',{headers:{cookie:'__Host-yj_viewer=test'}}),{session});
  assert.equal(r.status,307);assert.match(r.headers.get('location'),/\/platforms$/);
 }
 assert.match((await gateRequest(new Request('https://arena-sports-board.onrender.com/',{method:'HEAD'}),{})).headers.get('location'),/\/platforms$/);
 assert.equal(await gateRequest(req('/welcome'),{session:null}),null);
});
