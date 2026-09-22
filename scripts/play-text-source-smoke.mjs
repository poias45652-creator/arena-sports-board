import assert from 'node:assert/strict';
import {fetchPublic} from '../server/baseball-live-providers.mjs';
import {enrichGamePlayText} from '../server/baseball-play-text.mjs';
const league=process.argv[2];
const g=league==='NPB'?{key:'NPB:2021039450',id:'2021039450',league,date:'2026-09-22',status:'final',away:{id:'1',name:'讀賣巨人'},home:{id:'6',name:'廣島東洋鯉魚'},source:{url:'https://baseball.yahoo.co.jp/npb/game/2021039450/top'}}:{key:'KBO:20260922OBWO02026',id:'20260922OBWO02026',league:'KBO',date:'2026-09-22',status:'final',away:{id:'OB',name:'斗山熊'},home:{id:'WO',name:'培證英雄'},inning:9,innings:{away:[],home:[]},source:{url:'https://api-gw.sports.naver.com/schedule/games/20260922OBWO02026/game-polling'}};
const out=await enrichGamePlayText(g,{store:new Map()});
console.log('TEXT_SMOKE',JSON.stringify({league,status:out.playText.status,count:out.playText.records.length,innings:[...new Set(out.playText.records.map(x=>x.inning+':'+x.half))],missing:out.playText.missingInnings,samples:out.playText.records.slice(-2),reason:out.playText.reason}));
if(!out.playText.records.length){const p=await fetchPublic(league==='NPB'?g.source.url.replace('/top','/text'):`https://api-gw.sports.naver.com/schedule/games/${g.id}/relay?inning=1`);console.log('SCHEMA',p.text.slice(0,3500));}
assert.ok(out.playText.records.length>25,'actual full-game events must be present');
assert.ok(out.playText.records.some(x=>x.inning===1));assert.ok(out.playText.records.some(x=>x.inning===(league==='NPB'?11:9)&&x.half==='bottom'));
