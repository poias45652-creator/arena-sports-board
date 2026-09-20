'use client';
import {RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {BOARD_MARKETS} from '@/lib/board-markets';
import {INTERNATIONAL_MARKET_SOURCE,internationalMarketOptions} from '@/lib/international-market-options';
import {useSource} from '../use-source';

type League='NPB'|'KBO';
type Source={data:any;error:string;loading:boolean;refresh:()=>Promise<void>};
const clean=(name:string)=>name.replace(/\s*[（(](?:主|客)[）)]\s*/g,'').trim();

export function InternationalMarketStatusDetails({league,source}:{league:League;source:Source}){
 const {data,error,loading,refresh}=source;
 const games=Array.isArray(data?.games)?data.games:[];
 const age=Date.now()-Date.parse(data?.fetchedAt||'');
 const fresh=Number.isFinite(age)&&age>=-60000&&age<=150000&&!error;
 const stamp=data?.fetchedAt?new Date(data.fetchedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'尚未取得';
 const plays=(game:any)=>BOARD_MARKETS.filter(({key})=>{const s=INTERNATIONAL_MARKET_SOURCE[key];return internationalMarketOptions(game,league,s.period,s.type).length>0;}).map(m=>m.label);
 return <section className="panel admin-section" aria-label={`${league} 資料狀態`}>
  <details className="international-source-details">
   <summary className="cursor-pointer px-4 py-4 text-slate-300">資料狀態 · {league} {games.length} 場賽前盤口</summary>
   <div className="space-y-4 border-t border-white/10 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-400">抓取：{stamp}（台灣）</p><Button variant="outline" disabled={loading} onClick={()=>void refresh()}><RefreshCw className={loading?'animate-spin':''}/>{loading?'讀取中…':'更新資料'}</Button></div>
    {error&&<p role="alert" className="text-sm text-amber-200">{error}</p>}
    <p role="status" className={`text-sm ${fresh?'text-emerald-300':'text-slate-300'}`}>{loading?'正在讀取 SUPER 賽前盤口…':error?'SUPER 盤口連線失敗':fresh?`SUPER 賽前盤已連線 · 有可用報價 ${games.filter((g:any)=>plays(g).length>0).length} 場`:'盤口資料等待更新。'}</p>
    <p className="text-sm text-slate-400">此區顯示目前管理員所連接的 SUPER 賽前來源；走地盤不會併入賽前分析。</p>
    {data?.sourceScope?.available===false&&<p className="text-sm text-amber-200">SUPER 目前未列出可讀取的賽前棒球分類。</p>}
    {!!data?.sourceLeagues?.length&&<div className="space-y-2 text-sm text-slate-400"><p>SUPER 回傳的棒球聯盟</p><ul className="space-y-2">{data.sourceLeagues.map((item:any,i:number)=><li key={i}>{item.name} · {item.games} 場{!item.league?' · 分類尚未對應':''}</li>)}</ul></div>}
    <div className="space-y-3">{games.map((game:any)=><article key={game.id} className="rounded-lg border border-slate-700 p-4"><p className="font-bold">{clean(game.away)}（客）vs {clean(game.home)}（主）</p><p className="mt-1 text-sm text-slate-400">{game.start}（台灣）</p><p className="mt-2 text-sm">可讀取玩法：{plays(game).join('、')||'本次未取得開放報價'}</p></article>)}</div>
    {!loading&&!error&&!games.length&&<p className="text-sm text-slate-400">本次來源未回傳 {league} 賽前盤口。</p>}
   </div>
  </details>
 </section>;
}

export default function InternationalMarketStatus({league}:{league:League}){
 const source=useSource<any>(`member-odds&league=${league}`,60000);
 return <InternationalMarketStatusDetails league={league} source={source}/>;
}
