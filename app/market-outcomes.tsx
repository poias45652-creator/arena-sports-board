import type {Settlement} from '@/lib/markets';
const pct=(p:number)=>(p*100).toFixed(1)+'%';
export default function MarketOutcomes({outcome}:{outcome:Settlement}){
 return <span className="block"><span className="market-outcomes">{[
  ['全贏',outcome.win,'win'],['中洞贏',outcome.partialWin,'win'],['中洞輸',outcome.partialLoss,'loss'],['全輸',outcome.loss,'loss'],
 ].map(([title,value,tone])=><span className="market-outcome" data-tone={tone} key={String(title)}><span>{title}</span><strong>{pct(value as number)}</strong></span>)}</span>{outcome.push>0.00005&&<span className="mt-2 block text-center text-sm text-slate-400">平手退回 {pct(outcome.push)}</span>}</span>;
}
