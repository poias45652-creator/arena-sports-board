import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import {visibleTrial,taipeiDay,probabilityLabel} from '../public/ui/homepage-data.js';
import {moduleUrl} from './profile-loader.mjs';
const {GET}=await import(moduleUrl('app/welcome/route.ts'));
const response=GET(),html=await response.text();
const leagues=JSON.parse(html.match(/<script id="frontLeagueConfig" type="application\/json">(.*?)<\/script>/s)[1]);
const now=Date.parse('2026-10-27T10:00:00Z');
const sample=()=>({status:'ready',day:taipeiDay(now),updatedAt:new Date(now).toISOString(),game:{key:'NPB:real-123',id:'real-123',sport:'baseball',league:'NPB',leagueName:'日本職棒',start:'2026-10-27T10:30:00Z',away:'客隊名稱',home:'主隊名稱'},probabilities:{home:.634,away:.366},progress:{state:'scheduled',label:'未開賽',stale:false}});
test('homepage league list matches the current front end and excludes backend-only competitions',()=>{
 assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/text\/html/);
 assert.equal(leagues.length,12);assert.deepEqual(leagues.filter(l=>l.sport==='baseball').map(l=>l.code),['MLB','NPB']);
 for(const text of ['CPBL','KBO','中職','韓職','中信兄弟','統一獅','道奇 vs 洋基','湖人 vs 勇士','__LEAGUE_COUNT__','__FRONT_LEAGUES__'])assert.ok(!html.includes(text),text);
 assert.match(html,/12 個熱門聯盟/);assert.doesNotMatch(html,/data-entry=|entryDialog|GPT 首頁設計預覽/);
 for(const path of ['/login','/free-trial','/game-life','/ai-assistant'])assert.ok(html.includes('href="'+path+'"'));
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
test('anonymous root opens homepage, direct analysis stays gated, existing sessions retain the board',async()=>{
 const req=p=>new Request('https://arena-sports-board.onrender.com'+p);
 let r=await gateRequest(req('/'),{session:null});assert.equal(r.status,307);assert.match(r.headers.get('location'),/\/welcome$/);
 r=await gateRequest(req('/?league=NBA'),{session:null});assert.equal(r.status,307);assert.match(r.headers.get('location'),/\/login$/);
 assert.equal((await gateRequest(req('/api/nba'),{session:null})).status,401);
 assert.equal(await gateRequest(req('/'),{session:{memberId:'existing'}}),null);
 assert.equal(await gateRequest(req('/welcome'),{session:null}),null);
});
