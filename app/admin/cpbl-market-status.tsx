'use client';
import {useMemo,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {useSource} from '../use-source';
import InternationalTeamLogo from '../international-team-logo';

const plays=['全場讓球','全場大小','全場獨贏','全場一輸','上半讓球','上半大小','上半單雙'];
const clean=(value:string='')=>value.replace(/\s*[（(](?:主|客)[）)]\s*/g,'').trim();
const pct=(value:unknown)=>typeof value==='number'&&Number.isFinite(value)?`${value.toFixed(1)}%`:'—';

export default function CpblMarketStatus(){
 const {data,error,loading,refresh}=useSource<any>('member-odds&league=CPBL',60000);
 const [play,setPlay]=useState(plays[0]);
 const games=useMemo(()=>Array.isArray(data?.games)?data.games:[],[data]);
 const stamp=data?.fetchedAt?new Date(data.fetchedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'尚未取得';
 return <section className="panel admin-section">
  <details className="international-source-details">
   <summary className="cursor-pointer px-4 py-4 text-slate-300">資料狀態・CPBL {games.length} 場賽前盤口</summary>
   <div className="space-y-4 border-t border-white/10 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-black">CPBL 賽前分析明細</h2><p className="mt-1 text-sm text-slate-400">抓取：{stamp}（台灣）</p></div><Button variant="outline" disabled={loading} onClick={()=>void refresh()}><RefreshCw className={loading?'animate-spin':''}/>{loading?'读取中…':'更新资料'}</Button></div>
    {error&&<p role="alert" className="text-sm text-amber-200">{error}</p>}
    <div className="space-y-2 text-sm text-slate-400">
     <p>此區顯示賽前來源狀態；走地盤不會併入賽前分析。</p>
     {data?.sourceScope?.available===false&&<p className="text-amber-200">SUPER 目前未列出可讀取的賽前棒球分類。</p>}
     {!!data?.sourceLeagues?.length&&<><p>SUPER 回傳的棒球聯盟</p><ul className="space-y-2">{data.sourceLeagues.map((item:any,i:number)=><li key={i}>{item.name} · {item.games} 場{!item.league?' · 分類尚未對應':''}</li>)}</ul></>}
    </div>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7" aria-label="分析玩法">{plays.map(item=><Button key={item} variant={play===item?'default':'outline'} aria-pressed={play===item} onClick={()=>setPlay(item)}>{item}</Button>)}</div>
    {games.map((game:any)=><article key={game.id} className="panel international-match-card overflow-hidden">
     <div className="flex flex-wrap justify-between gap-2 px-5 pt-4 text-sm text-slate-400"><span>{game.start||'开赛时间待更新'}（台灣）</span><span>九局得分期望：客 {game.expectedAway??'—'}／主 {game.expectedHome??'—'}，合计 {game.expectedTotal??'—'} 分</span></div>
     <div className="international-match-teams">{(['away','home'] as const).map(side=><div key={side} className="international-match-team"><div className="international-match-name"><InternationalTeamLogo league="CPBL" name={clean(game[side])} size={34}/><h2>{clean(game[side])||'球队待更新'}<small>（{side==='home'?'主':'客'}）</small></h2><span><small>胜率</small>{pct(game.analysis?.[side]?.winRate)}</span></div><p>{game.analysis?.[side]?.record||'战绩资料更新中'}</p><p>预计先发：<strong>{game.starters?.[side]||'尚未公布'}</strong>　本季防御率 <strong>{game.analysis?.[side]?.era??'—'}</strong>　本季 WHIP <strong>{game.analysis?.[side]?.whip??'—'}</strong></p></div>)}</div>
     <details className="match-market-details"><summary><span>查看分析</span><span className="text-sm font-normal">7 种玩法</span></summary><div className="space-y-4 p-4"><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">{plays.map(item=><Button key={item} variant={play===item?'default':'outline'} onClick={()=>setPlay(item)}>{item}</Button>)}</div><div className="rounded-lg border border-slate-600 bg-[#0a1421] p-4"><p className="font-bold">{play}</p><p className="mt-3 text-sm text-slate-400">{game.analysis?.summary||'盘口已保留在后台；先发、战绩与模型资料齐全后才会产生胜率，不填入假数字。'}</p></div></div></details>
    </article>)}
    {!games.length&&<div className="rounded-lg border border-slate-700 bg-[#0a1421] p-5 text-slate-400">{loading?'正在读取 CPBL 赛前盘口…':'目前来源没有 CPBL 赛前盘口。连接或更新来源后，完整赛事分析卡会显示在这里。'}</div>}
   </div>
  </details>
 </section>;
}
