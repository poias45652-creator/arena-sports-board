'use client';
import {Button} from '@/components/ui/button';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {BOARD_MARKETS,boardMarketLabel} from '@/lib/board-markets';
import type {MarketKey} from '@/lib/pinnacle';
import {INTERNATIONAL_MARKET_SOURCE,internationalMarketOptions,type InternationalPick} from '@/lib/international-market-options';
import InternationalTeamLogo from './international-team-logo';
import {marketOutcomes,isModelLeague,type RunAnalysis} from '@/lib/baseball-run-analysis';

export default function InternationalMarketAnalysis({league,game,market,onMarketChange,picks,onPick,canPick,status,analysis=null,quotesFresh=false}:{
 league:string;game:any;market:MarketKey;onMarketChange:(key:MarketKey)=>void;
 picks:InternationalPick[];onPick:(pick:InternationalPick)=>void;canPick:boolean;status:string;
 analysis?:RunAnalysis|null;quotesFresh?:boolean;
}){
 const source=INTERNATIONAL_MARKET_SOURCE[market];
 const options=internationalMarketOptions(game,league,source.period,source.type);
 const total=source.type==='104',oddEven=source.type==='105';
 const outcomes=isModelLeague(league)?marketOutcomes(game,market,analysis,quotesFresh,league):[];
 const ranked=[...outcomes].sort((a,b)=>b.expectedProfit-a.expectedProfit);
 const best=ranked[0],tied=ranked.length>1&&Math.abs(best.expectedProfit-ranked[1].expectedProfit)<1e-8;
 const preferred=tied?undefined:best?.pick.side;
 const belowThreshold=!!best&&best.expectedProfit<=0;
 return <details className="match-market-details" open>
  <summary><span>查看分析</span><span className="text-sm font-normal">7 種玩法</span></summary>
  <div className="space-y-4 p-4">
   <Tabs value={market} onValueChange={value=>onMarketChange(value as MarketKey)}>
    <div className="market-tabs-scroll"><TabsList className="market-type-tabs" aria-label={`${game.away}對${game.home}選擇玩法`}>
     {BOARD_MARKETS.map(({key,label})=><TabsTrigger key={key} value={key}>{label}</TabsTrigger>)}
    </TabsList></div>
    <TabsContent value={market} className="pt-4">
     <section className="space-y-3" aria-label={boardMarketLabel(market)}>
      <h5 className="font-bold">{boardMarketLabel(market)}</h5>
      <p className="market-line">{options.length?(options[0].lineLabel||boardMarketLabel(market)):'盤口尚未取得'}</p>
      <div className="grid gap-3 md:grid-cols-2">{(['home','away'] as const).map((side,i)=>{
       const pick=options.find(p=>p.side===side),active=!!pick&&picks.some(p=>p.key===pick.key);
       const title=oddEven?(i?'雙':'單'):total?(i?'小':'大'):game[side];
       const result=outcomes.find(o=>o.pick.side===side)?.result;
       return <Button key={side} variant={active?'default':'outline'} disabled={!canPick||!pick} aria-pressed={active}
        className="market-option-card international-market-option h-auto w-full items-start whitespace-normal p-3 text-left"
        onClick={()=>pick&&onPick(pick)}>
        <span className="block w-full">
         <span className="market-pick-title flex w-full flex-wrap items-start justify-between gap-x-3 gap-y-1 font-bold">
          <span className="inline-flex min-w-0 flex-wrap items-center gap-2">{!total&&!oddEven&&<InternationalTeamLogo league={league} name={game[side]} size={24}/>}<span>{title}</span>{preferred===side&&<span className="text-sm text-emerald-400">{belowThreshold?(analysis?.mode==='simulation'?'模擬偏向':'相對推薦'):(analysis?.mode==='simulation'?'模擬推薦':'推薦')}</span>}{active&&<span aria-label="已選取">✓</span>}</span>
          <span className="ml-auto whitespace-nowrap text-right tabular-nums">{pick?`${pick.lineLabel}${pick.lineLabel?' ':''}@${pick.price.toFixed(3)}`:'—'}</span>
         </span>
         <span className="mt-3 block text-sm"><span className="market-outcomes">{(['win','partialWin','partialLoss','loss'] as const).map((key,index)=>{const label=['全贏','中洞贏','中洞輸','全輸'][index];return <span className="market-outcome" data-tone={index<2?'win':'loss'} key={key}><span>{label}</span><strong aria-label={result?`${label}估算機率 ${(result[key]*100).toFixed(1)}%`:`${label}機率尚未取得`}>{result?`${(result[key]*100).toFixed(1)}%`:'—'}</strong></span>;})}</span></span>
         {result&&result.push>1e-8&&<span className="mt-2 block text-sm text-slate-300">走盤／退回 {(result.push*100).toFixed(1)}%</span>}
        </span>
       </Button>;
      })}</div>
      {tied&&<p className="text-sm text-amber-200">兩側預期收益接近，暫無明顯推薦方向。</p>}
      {!tied&&belowThreshold&&<p className="text-sm text-amber-200">兩側預期收益均未大於 0，僅標示相對較有利的一側。串關另按獲利機率排序，不代表正預期收益。</p>}
      {!outcomes.length&&!status&&<p className="text-sm text-amber-200">{analysis?.reason||'分析或報價資料尚未齊全，暫無推薦。'}</p>}
      {status&&<p role="status" className="text-sm text-amber-200">{status}</p>}
      {!isModelLeague(league)&&<p className="text-sm text-slate-400">分析資料待齊，機率尚未產生。</p>}
     </section>
    </TabsContent>
   </Tabs>
  </div>
 </details>;
}
