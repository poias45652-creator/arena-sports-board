import test from 'node:test';
import assert from 'node:assert/strict';
import {moduleUrl} from './profile-loader.mjs';
const {uniqueInternationalFixtures}=await import(moduleUrl('lib/international-fixtures.ts'));
const {internationalTeam}=await import(moduleUrl('lib/international-teams.ts'));

test('NPB provider names resolve to the existing team identity',()=>{
 for(const [alias,canonical] of [['橫濱DeNA灣星','橫濱 DeNA 海灣之星'],['橫濱 DeNA 灣星','橫濱 DeNA 海灣之星'],['千葉羅德','千葉羅德海洋'],['廣島鯉魚','廣島東洋鯉魚']])assert.equal(internationalTeam(alias,'NPB'),canonical);
});

test('duplicate schedule and odds cards collapse while retaining the ranked enriched card',()=>{
 const enriched={id:'odds',start:'2026/09/20 17:00:00',away:'橫濱 DeNA 海灣之星',home:'阪神虎',displayMarkets:[{type:103}],starters:{away:'先發甲'}};
 const duplicate={id:'schedule',start:'2026-09-20 17:00',away:'橫濱DeNA灣星（客）',home:'阪神虎（主）'};
 assert.deepEqual(uniqueInternationalFixtures([enriched,duplicate],'NPB'),[enriched]);
 const carp={id:'carp',start:'2026-09-20 17:00:00',away:'廣島東洋鯉魚',home:'中日龍'};
 assert.deepEqual(uniqueInternationalFixtures([carp,{...carp,id:'carp-alias',away:'廣島鯉魚'}],'NPB'),[carp]);
});

test('doubleheaders, different dates, and reversed home/away fixtures remain separate',()=>{
 const game={id:'first',start:'2026-09-20 13:00:00',away:'埼玉西武獅',home:'千葉羅德海洋'};
 const games=[game,{...game,id:'second',start:'2026-09-20 17:00:00'},{...game,id:'tomorrow',start:'2026-09-21 13:00:00'},{...game,id:'reversed',away:game.home,home:game.away}];
 assert.deepEqual(uniqueInternationalFixtures(games,'NPB'),games);
});
