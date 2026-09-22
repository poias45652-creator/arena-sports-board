// One-shot read-only diagnostics. No account data, cookies, tokens or database access.
import {collectLeague,dayInTaipei} from '../server/baseball-current.mjs';
import {tableData,plain} from '../server/baseball-live-providers.mjs';
const date=dayInTaipei();
console.log('PROBE_ENV',JSON.stringify({environment:'GitHub Actions, not Render',date,observedAt:new Date().toISOString()}));
await Promise.all(['NPB','KBO','CPBL'].map(async league=>{
 try{const r=await collectLeague(league,{date});console.log('FEED',JSON.stringify({league,date,status:r.status,errors:r.errors,games:r.games.map(g=>({id:g.id,away:g.away.name,home:g.home.name,startTime:g.startTime,status:g.status,rawStatus:g.rawStatus,starters:g.starters,source:g.source.url}))}));}
 catch(e){console.log('FEED_ERROR',JSON.stringify({league,error:e.message}));}
}));
const urls=[
 `https://npb.jp/bis/${date.slice(0,4)}/stats/idp1_m.html`,
 'https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx',
 `https://www.playsport.cc/livescore/2?gamedate=${date.replaceAll('-','')}&mode=2`
];
for(const url of urls){
 try{const r=await fetch(url,{redirect:'manual',headers:{'User-Agent':'YJBaseballSourceCheck/1.0',Accept:'text/html'},signal:AbortSignal.timeout(10000)});const html=await r.text();console.log('PUBLIC_PAGE',JSON.stringify({url,status:r.status,title:plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||''),tables:r.ok?tableData(html).map(t=>({attrs:t.attrs,headers:t.rows[0],rows:t.rows.length-1,sample:t.rows.slice(1,3)})).slice(0,8):[]}));}
 catch(e){console.log('PUBLIC_PAGE_ERROR',JSON.stringify({url,error:e.message}));}
}
