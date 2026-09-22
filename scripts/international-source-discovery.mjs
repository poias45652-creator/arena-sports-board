// Narrow public profile verification, using player IDs observed in today's exact Naver fixtures.
import {plain,tableData,dayInTaipei} from '../server/baseball-live-providers.mjs';
const people=[['65516','배제성','KT'],['56801','아빌라','SSG'],['52043','벤자민','두산'],['54362','전준표','키움'],['56939','클레빈저','NC'],['56459','페덱','삼성']];
const get=async url=>{const r=await fetch(url,{redirect:'manual',headers:{'User-Agent':'YJBaseballSourceCheck/1.0',Accept:'text/html'},signal:AbortSignal.timeout(10000)});if(!r.ok){await r.body?.cancel();throw Error('HTTP '+r.status)}const b=new Uint8Array(await r.arrayBuffer());if(b.length>4_000_000)throw Error('oversize');return new TextDecoder().decode(b);};
console.log('ENV',JSON.stringify({environment:'GitHub Actions, not Render',date:dayInTaipei(),observedAt:new Date().toISOString()}));
for(let i=0;i<people.length;i+=3)await Promise.all(people.slice(i,i+3).map(async([id,name,team])=>{
 const url=`https://www.koreabaseball.com/Record/Player/PitcherDetail/Basic.aspx?playerId=${id}`;
 try{const html=await get(url),text=plain(html),tables=tableData(html).filter(t=>t.rows[0]?.includes('ERA')||t.rows[0]?.includes('IP'));
 console.log('KBO_PROFILE',JSON.stringify({url,requested:{id,name,team},namePresent:text.includes(name),teamPresent:text.includes(team),title:plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||''),tables:tables.map(t=>({headers:t.rows[0],count:t.rows.length-1,rows:t.rows.filter((r,j)=>j>0&&(r.includes('2026')||tables.length<=2)).slice(0,8)})),profileLinks:[...html.matchAll(/<a\b[^>]*href=(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)].map(m=>({text:plain(m[3]),href:m[2]})).filter(x=>/경기별|상황별/.test(x.text)).slice(0,8)}));}
 catch(e){console.log('KBO_PROFILE',JSON.stringify({url,name,error:e.message}));}
}));
const url='https://npb.jp/games/2026/schedule_09_detail.html';try{const html=await get(url),table=tableData(html)[0];let day='';const rows=[];for(const row of table.rows){if(/^9\/\d+/.test(row[0]||''))day=row[0];if(day.startsWith('9/22'))rows.push(row);}console.log('NPB_SCHEDULE',JSON.stringify({url,date:'2026-09-22',rows}));}catch(e){console.log('NPB_SCHEDULE',JSON.stringify({url,error:e.message}));}
