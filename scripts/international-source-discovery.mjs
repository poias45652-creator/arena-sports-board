// Bounded public-source diagnostics. Only public sports fields and sort controls are logged.
import {plain,tableData,dayInTaipei,collectLeague} from '../server/baseball-live-providers.mjs';
const date=dayInTaipei();
const get=async url=>{const r=await fetch(url,{redirect:'manual',headers:{'User-Agent':'YJBaseballSourceCheck/1.0',Accept:'text/html,application/json'},signal:AbortSignal.timeout(12000)});if(!r.ok){await r.body?.cancel();throw Error('HTTP '+r.status)}const b=new Uint8Array(await r.arrayBuffer());if(b.length>5_000_000)throw Error('oversize');return new TextDecoder().decode(b);};
const hrefs=html=>[...html.matchAll(/<a\b[^>]*href=(['"])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi)].map(m=>({text:plain(m[3]),href:m[2]}));
console.log('ENV',JSON.stringify({environment:'GitHub Actions, not Render',date,observedAt:new Date().toISOString()}));
for(const url of ['https://www.nownews.com/news/6877106','https://www.nownews.com/tag?q=%E4%B8%AD%E8%81%B7%E6%90%B6%E5%85%88%E5%A0%B1','https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx','https://nf3.sakura.ne.jp/Stats/team_etc.htm'])try{
 const html=await get(url),text=plain(html);
 if(url.includes('6877106'))console.log('CPBL_NEWS',JSON.stringify({url,publishedAt:html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1],sections:[...text.matchAll(/.{0,45}(?:羅戈|瑪帝斯|江承諺|邱駿威|江少慶|鋼龍).{0,220}/g)].slice(0,16).map(m=>m[0])}));
 else if(url.includes('nownews'))console.log('CPBL_DISCOVERY',JSON.stringify({url,links:hrefs(html).filter(x=>x.text.includes('中職搶先報')&&/\/news\/\d+/.test(x.href)).slice(0,8)}));
 else if(url.includes('koreabaseball'))console.log('KBO_SORT',JSON.stringify({url,links:hrefs(html).filter(x=>['G','IP','ERA'].includes(x.text)),sortFunction:html.match(/function\s+sort\s*\([^)]*\)\s*\{[\s\S]{0,1300}?\}/)?.[0]||null,publicJs:[...html.matchAll(/<script[^>]*src=(['"])(.*?)\1/gi)].map(m=>m[2]).filter(x=>/record|pitcher/i.test(x))}));
 else console.log('NPB_SPLITS_LINKS',JSON.stringify({url,links:hrefs(html).filter(x=>/阪神|日本ハム|救援|先発|投手/.test(x.text)).slice(0,18)}));
}catch(e){console.log('FAIL',JSON.stringify({url,error:e.message}));}
try{const r=await collectLeague('KBO',{date});console.log('KBO_CURRENT',JSON.stringify({games:r.games.map(g=>({id:g.id,source:g.source.url,status:g.status,home:g.home.name,away:g.away.name,lineups:[g.lineups.away.length,g.lineups.home.length],starters:g.starters,outs:g.outs,balls:g.balls,strikes:g.strikes,bases:g.bases,currentPitcher:!!g.currentPitcher,currentBatter:!!g.currentBatter})),errors:r.errors}));}catch(e){console.log('FAIL',JSON.stringify({league:'KBO',error:e.message}));}
