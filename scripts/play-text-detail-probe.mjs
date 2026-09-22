import {fetchPublic,plain} from '../server/baseball-live-providers.mjs';
const league=process.argv[2];
if(league==='KBO'){
 const p=await fetchPublic('https://api-gw.sports.naver.com/schedule/games/20260922OBWO02026/game-polling');const r=JSON.parse(p.text).result.textRelayData;
 console.log('RELAY_OVERVIEW',JSON.stringify({length:r.textRelays.length,innings:[...new Set(r.textRelays.map(x=>x.inn+':'+x.homeOrAway))],numbers:r.textRelays.map(x=>x.no)}));
 console.log('RELAY_SAMPLES',JSON.stringify(r.textRelays.slice(0,6).map(x=>({no:x.no,inn:x.inn,homeOrAway:x.homeOrAway,title:x.title,textOptions:x.textOptions.map(({seqno,text,type,pitchNum,pitchResult,speed,stuff,currentGameState})=>({seqno,text,type,pitchNum,pitchResult,speed,stuff,currentGameState}))}))));
}else if(league==='NPB'){
 const p=await fetchPublic('https://baseball.yahoo.co.jp/npb/game/2021039450/text');const sections=[...p.text.matchAll(/<section class="bb-liveText">([\s\S]*?)<\/section>/g)];
 console.log('TEXT_SECTIONS',sections.length);console.log('TEXT_LATEST',sections.slice(-2).map(m=>m[0]).join('\n').slice(0,30000));
}else{
 const url='https://sportify.tw/zh-TW/cpbl/schedule';try{const r=await fetch(url,{signal:AbortSignal.timeout(15000)});const html=await r.text();console.log('SPORTIFY_STATUS',r.status);console.log('SPORTIFY_TEXT',plain(html).slice(0,6500));console.log('SPORTIFY_LINKS',JSON.stringify([...new Set([...html.matchAll(/href="([^"]+)"/g)].map(m=>m[1]).filter(x=>/match|game|2026/.test(x)))].slice(0,30)));}catch(e){console.log(e.message)}
}
