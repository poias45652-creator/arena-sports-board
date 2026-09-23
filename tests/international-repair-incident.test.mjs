import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleUrl} from './profile-loader.mjs';
import {kboPublicForm,kboPageTargets,createKboSeasonPages} from '../server/kbo-season-pages.mjs';
const {internationalTeam}=await import(moduleUrl('lib/international-teams.ts'));
const {pitcherIdentity}=await import(moduleUrl('lib/international-pitcher-identity.ts'));
const {supplementSeasonPitching}=await import(moduleUrl('lib/international-season-pitching.ts'));
const {mergePregameFixtures}=await import(moduleUrl('lib/international-pregame.ts'));
const form=`<input type="hidden" name="__VIEWSTATE" value="public-state"><input type="hidden" name="__EVENTVALIDATION" value="public-validation"><input type="hidden" name="ctl$hfPage" value="1"><input type="hidden" name="ctl$hfOrderByCol" value="INN2_CN"><select name="ctl$ddlTeam"><option value="">全部</option><option value="LT">롯데</option></select><a href="javascript:__doPostBack('ctl$ucPager$btnNo2','')">2</a>`;
test('KBO public team and next-page filters retain actual form fields',()=>{
 const first=kboPublicForm(form,'LT');assert.equal(first.get('ctl$ddlTeam'),'LT');assert.equal(first.get('__EVENTTARGET'),'ctl$ddlTeam');assert.equal(first.get('ctl$hfOrderByCol'),'INN2_CN');
 const second=kboPublicForm(form,'LT',2);assert.equal(second.get('__EVENTTARGET'),'ctl$ucPager$btnNo2');assert.equal(second.get('ctl$hfPage'),'2');assert.equal(kboPageTargets(form).size,1);assert.throws(()=>kboPublicForm(form,'LT',3));assert.throws(()=>kboPublicForm('', 'LT'));
});
test('KBO includes nonqualified pitchers on later pages and does not call another team',async()=>{
 const calls=[];const collect=createKboSeasonPages({now:()=>Date.parse('2026-09-23T05:00:00Z'),fetcher:async(url,init)=>{calls.push(init.body||'GET');return new Response(calls.length<3?form:'last-page');},parse:(html,date,at,url)=>[{team:'樂天巨人',name:html===form?'박세웅':'new-pitcher',source:{observedAt:at,url},stats:{era:'4.92',whip:'1.54'}}]});
 const r=await collect('2026-09-23',['樂天巨人']);assert.deepEqual(r.rows.map(r=>r.name),['박세웅','new-pitcher']);assert.equal(calls.length,3);assert.equal(r.errors.length,0);await collect('2026-09-23',['樂天巨人']);assert.equal(calls.length,3);
});
test('KBO denied source stops without alternate-access retries',async()=>{let calls=0;const collect=createKboSeasonPages({fetcher:async()=>{calls++;return new Response('denied',{status:403});},parse:()=>[]});const r=await collect('2026-09-23',['樂天巨人']);assert.equal(calls,1);assert.equal(r.rows.length,0);assert.match(r.errors[0],/403/);});
test('KIA alias and verified Chiba pitcher forms share identity, other teams stay distinct',()=>{
 assert.equal(internationalTeam('起亞老虎','KBO'),'起亞虎');assert.equal(internationalTeam('起亞老虎','NPB'),'起亞老虎');
 for(const [a,b] of [['J・ルケーシー','ルケーシー'],['A・ジャクソン','ジャクソン']]){assert.equal(pitcherIdentity(a,'NPB','千葉羅德'),pitcherIdentity(b,'NPB','千葉羅德海洋'));assert.notEqual(pitcherIdentity(a,'NPB','阪神虎'),pitcherIdentity(b,'NPB','阪神虎'));}
});
test('newer matching ERA does not suppress missing WHIP or innings; conflicts still block',()=>{
 const now=Date.parse('2026-09-23T05:00:00Z'),oldTime='2026-09-23T04:40:00Z',freshTime='2026-09-23T04:55:00Z';
 const side={team:'千葉羅德海洋',starter:{name:'J・ルケーシー',season:{era:'4.20',whip:'',innings:'',wins:'1'},quality:'unavailable',warnings:[],statSources:{era:{observedAt:freshTime}}},bullpen:null};
 const data={league:'NPB',date:'2026-09-23',games:[{league:'NPB',date:'2026-09-23',start:'2026-09-23 16:00:00',away:side,home:{...side,starter:{...side.starter,name:'another'}}}]};
 const row={team:side.team,name:'ルケーシー',stats:{era:'4.20',whip:'1.27',innings:'15',wins:''},source:{name:'NPB',url:'https://npb.jp/',observedAt:oldTime}};
 const out=supplementSeasonPitching(data,{rows:[row]},now).games[0];assert.equal(out.away.starter.season.whip,'1.27');assert.equal(out.away.starter.season.innings,'15');assert.equal(out.away.starter.season.wins,'1');assert.equal(out.away.starter.statSources.era.observedAt,freshTime);assert.equal(out.away.starter.statSources.innings.observedAt,oldTime);assert.equal(out.home.starter.season.whip,'');assert.equal(out.away.bullpen,null);
 const bad=structuredClone(data);bad.games[0].away.starter.season.era='9.00';assert.equal(supplementSeasonPitching(bad,{rows:[row]},now).games[0].away.starter.season.whip,'');
});
