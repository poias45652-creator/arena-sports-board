// One-shot, bounded public-source lookup. No member sessions or database access.
import {plain,tableData,dayInTaipei} from '../server/baseball-live-providers.mjs';
const date=dayInTaipei(), year=date.slice(0,4), month=date.slice(5,7);
const urls=[
 'https://www.nownews.com/news/6877106',
 'https://nf3.sakura.ne.jp/Stats/team_etc.htm',
 'https://sportify.tw/zh-TW/cpbl',
 'https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx',
 `https://npb.jp/games/${year}/schedule_${month}_detail.html`,
 'https://baseball.yahoo.co.jp/npb/game/2021039451/top',
 'https://api-gw.sports.naver.com/schedule/games/20260922NCSS02026/game-polling'
];
console.log('ENV',JSON.stringify({environment:'GitHub Actions, not Render',date,observedAt:new Date().toISOString()}));
async function inspect(url){
 const started=Date.now();try{
  const response=await fetch(url,{redirect:'manual',headers:{'User-Agent':'YJBaseballSourceCheck/1.0',Accept:'text/html,application/json'},signal:AbortSignal.timeout(12000)});
  if(!response.ok){await response.body?.cancel();console.log('SOURCE',JSON.stringify({url,status:response.status,usable:false}));return;}
  const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length>8_000_000)throw Error('Response exceeds limit');
  const charset=response.headers.get('content-type')?.match(/charset=([^;]+)/i)?.[1]||(/shift[_-]jis/i.test(new TextDecoder().decode(bytes.slice(0,3000)))?'shift_jis':'utf-8');
  const html=new TextDecoder(charset).decode(bytes);if(/challenge-platform|<title>Just a moment/i.test(html))throw Error('Public source requires verification');
  const title=plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
  if(url.includes('api-gw.sports.naver.com')){
   const j=JSON.parse(html),g=j.result?.game,r=j.result?.textRelayData;
   console.log('SOURCE',JSON.stringify({url,status:response.status,id:g?.gameId,state:g?.statusCode,updatedAt:g?.updateDateTime,relayPresent:!!r,homeLineup:r?.homeLineup?.batter?.length??0,awayLineup:r?.awayLineup?.batter?.length??0,relayKeys:r?Object.keys(r):[],resultKeys:Object.keys(j.result||{})}));return;
  }
  const tables=tableData(html);
  const previews=tables.map(t=>({attrs:t.attrs.replace(/\s+/g,' ').slice(0,120),headers:t.rows[0],count:t.rows.length-1,rows:t.rows.slice(1,3)}));
  const links=[...html.matchAll(/<a\b([^>]*?)href=["']([^"']+)["']([^>]*)>([\s\S]*?)<\/a>/gi)].map(m=>({text:plain(m[4]),href:m[2]})).filter(x=>/^(G|IP|구원|선발|救援|先発)$/.test(x.text)||/6877106|statiz|sportsnavi|team_etc|relief/i.test(x.href)).slice(0,20);
  const specific=url.includes('nownews')?{pitcherTables:tables.filter(t=>t.rows.some(row=>row.some(v=>/先發投手|羅戈|瑪帝斯|江承諺|邱駿威|江少慶|鋼龍/.test(v)))).map(t=>t.rows),publication:html.match(/"datePublished"\s*:\s*"([^"]+)"/)?.[1]}:url.includes('nf3')?{reliefSections:[...plain(html).matchAll(/.{0,25}救援.{0,140}/g)].slice(0,12).map(m=>m[0])}:url.includes('sportify')?{excerpt:plain(html).slice(0,2200)}:{};
  console.log('SOURCE',JSON.stringify({url,status:response.status,title,bytes:bytes.length,elapsedMs:Date.now()-started,tableCount:tables.length,tables:previews.slice(0,14),links,...specific}));
 }catch(e){console.log('SOURCE',JSON.stringify({url,usable:false,error:e.message}));}
}
for(let i=0;i<urls.length;i+=3)await Promise.all(urls.slice(i,i+3).map(inspect));
