import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {moduleUrl} from './profile-loader.mjs';
import {npbGameStart,recoverNpbPregameState} from '../server/baseball-npb-start.mjs';
import {pitchingOuts,parseNpbSeasonPitching,parseKboSeasonPitching,createSeasonPitchingCollector} from '../server/baseball-season-pitching.mjs';
const {internationalTeam}=await import(moduleUrl('lib/international-teams.ts'));
const {internationalTeamLogoPath}=await import(moduleUrl('lib/international-team-logo-path.ts'));
const {selectInternationalBoardFixtures}=await import(moduleUrl('lib/international-board-fixtures.ts'));
const {internationalFixtureTime}=await import(moduleUrl('lib/international-fixture-time.ts'));
const {supplementSeasonPitching}=await import(moduleUrl('lib/international-season-pitching.ts'));
const aliases=[['KBO','鬥山熊','斗山熊'],['KBO','英雄','培證英雄'],['KBO','恐龍','NC 恐龍'],['KBO','巫師','KT 巫師'],['KBO','登陸者','SSG 登陸者'],['NPB','東北樂天鷹','東北樂天金鷲']];
for(const [league,alias,canonical] of aliases)test(`${league} ${alias} uses the existing canonical local logo`,()=>{assert.equal(internationalTeam(alias,league),canonical);const logo=internationalTeamLogoPath(league,alias);assert.ok(logo);assert.ok(existsSync('public'+logo));assert.equal(logo,internationalTeamLogoPath(league,canonical));});
test('CPBL six teams have real bundled logos',()=>{for(const t of ['味全龍','統一獅','中信兄弟','富邦悍將','台鋼雄鷹','樂天桃猿'])assert.ok(existsSync('public'+internationalTeamLogoPath('CPBL',t)));});
test('different source IDs and aliases merge before display, retaining pitcher and quotes',()=>{
 const g={id:'schedule',start:'2026-09-22 17:30:00',away:'NC 恐龍',home:'三星獅',live:false,displayMarkets:[],starters:{away:'pitcher'},pregame:{marker:'retained'}};
 const odds={...g,id:'odds',start:'2026/09/22 17:30',away:'恐龍',pregame:undefined,starters:undefined,oddsSource:true,displayMarkets:[{type:103}]};
 const r=selectInternationalBoardFixtures([g,{...g,id:'duplicate'}],[odds,{...odds,id:'duplicate-odds'}],'KBO',Date.parse('2026-09-22T07:00:00Z'),'auto',[],g=>!!g.displayMarkets.length);
 assert.equal(r.games.length,1);assert.equal(r.games[0].id,'odds');assert.equal(r.games[0].starters.away,'pitcher');assert.equal(r.games[0].pregame.marker,'retained');assert.equal(r.games[0].displayMarkets.length,1);
 const separate=selectInternationalBoardFixtures([g,{...g,id:'dh',start:'2026-09-22 13:00:00'}],[],'KBO',Date.parse('2026-09-22T07:00:00Z'));
 assert.equal(separate.games.length,2);
});
test('fixture timestamps respect explicit zones and reject invalid calendar dates',()=>{assert.equal(internationalFixtureTime('2026-09-22 17:30'),internationalFixtureTime('2026-09-22T09:30:00Z'));assert.ok(Number.isNaN(internationalFixtureTime('2026-02-30 17:00')));});
const html=time=>`<title>2026年9月22日 対戦</title><meta property="og:url" content="https://baseball.yahoo.co.jp/npb/game/123456/top"><p class="bb-gameCard__time">${time}</p>`;
test('NPB confirmed local card clock becomes Taipei 17:00 without sidebar guessing',()=>{assert.equal(npbGameStart(html('18:00'),'123456','2026-09-22'),'2026-09-22T09:00:00.000Z');assert.throws(()=>npbGameStart(html('18:00'),'654321','2026-09-22'));assert.throws(()=>npbGameStart(html('25:00'),'123456','2026-09-22'));});
test('NPB lineup label remains pregame only before the verified start',()=>{
 const g={status:'unknown',rawStatus:'日本ハム 18:00 スタメン 楽天',startTime:'2026-09-22T09:00:00Z',source:{fetchedAt:'2026-09-22T08:20:00Z'},away:{score:null},home:{score:null}};
 assert.equal(recoverNpbPregameState(structuredClone(g)).status,'pregame');assert.equal(recoverNpbPregameState({...structuredClone(g),status:'live'}).status,'live');assert.equal(recoverNpbPregameState({...structuredClone(g),source:{fetchedAt:'2026-09-22T09:00:00Z'}}).status,'unknown');
});
const table=(headers,rows)=>'<table><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr>'+rows.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')+'</table>';
const at='2026-09-22T08:00:00Z',now=Date.parse(at),date='2026-09-22';
const npbHtml='<title>2026年度 千葉ロッテマリーンズ 個人投手成績</title><p>2026年9月21日 現在</p>'+table(['選手','防御率','投球回','安打','四球','自責点','勝利','敗北','三振'],[['ジャクソン','3.00','60','45','15','20','4','3','70']]);
test('NPB actual outs rebuild WHIP and wrong season/team/date are rejected',()=>{
 assert.equal(pitchingOuts('15 .1'),46);assert.equal(pitchingOuts('138 2/3'),416);assert.equal(pitchingOuts('1/3'),1);assert.equal(pitchingOuts('4.7'),null);
 const [r]=parseNpbSeasonPitching(npbHtml,'m',date,at,'https://npb.jp/bis/2026/stats/idp1_m.html');assert.equal(r.stats.whip,'1.00');assert.equal(r.stats.era,'3.00');assert.equal(r.source.throughDate,'2026-09-21');
 assert.throws(()=>parseNpbSeasonPitching(npbHtml,'f',date,at,''));assert.throws(()=>parseNpbSeasonPitching(npbHtml.replace('9月21日','9月22日'),'m',date,at,''));assert.equal(parseNpbSeasonPitching(npbHtml.replace('<td>20</td>','<td>0</td>'),'m',date,at,'').length,0);
});
const kboHtml='<select name="ctl$ddlSeason"><option selected="selected">2026</option></select><select name="ctl$ddlSeries"><option selected="selected">KBO 정규시즌</option></select>'+table(['선수명','팀명','ERA','IP','H','BB','ER','WHIP','W','L','SO'],[['류현진','한화','3.00','60','45','15','20','1.00','5','4','70']]);
test('KBO checks regular season and actual numerator consistency, not rank alone',()=>{assert.equal(parseKboSeasonPitching(kboHtml,date,at,'')[0].team,'韓華鷹');assert.throws(()=>parseKboSeasonPitching(kboHtml.replace('정규시즌','포스트시즌'),date,at,''));assert.equal(parseKboSeasonPitching(kboHtml.replace('<td>1.00</td>','<td>2.00</td>'),date,at,'').length,0);});
test('public fallback stops at denied requests and caches failures',async()=>{let calls=0;const collect=createSeasonPitchingCollector({now:()=>now,fetcher:async()=>{calls++;return new Response('Denied',{status:403});}});const r=await collect('NPB',date,['千葉羅德海洋']);assert.equal(r.rows.length,0);assert.match(r.errors[0],/403/);await collect('NPB',date,['千葉羅德海洋']);assert.equal(calls,1);await collect('NPB','2026-09-21',['千葉羅德海洋']);await collect('CPBL',date,['味全龍']);assert.equal(calls,1);});
test('fallback never reassigns another pitcher, alters bullpen or backfills started games',()=>{
 const [row]=parseNpbSeasonPitching(npbHtml,'m',date,at,''),side={team:'千葉羅德海洋',starter:{name:'ジャクソン',season:{era:'',whip:''},quality:'unavailable',warnings:[]},bullpen:null};
 const data={league:'NPB',date,games:[{league:'NPB',date,start:'2026-09-22 17:00:00',away:side,home:{...side,starter:{...side.starter,name:'different'}}}]};
 const result=supplementSeasonPitching(data,{rows:[row]},now);assert.equal(result.games[0].away.starter.season.whip,'1.00');assert.equal(result.games[0].home.starter.season.whip,'');assert.equal(result.games[0].away.bullpen,null);assert.equal(data.games[0].away.starter.season.whip,'');assert.equal(supplementSeasonPitching(data,{rows:[row]},Date.parse('2026-09-22T09:00:00Z')).games[0],data.games[0]);
});
