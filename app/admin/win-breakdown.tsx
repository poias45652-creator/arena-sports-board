"use client";
import {useEffect,useState} from 'react';
import {fresh,isPregame,type Match} from '@/lib/baseball';
import {multifactorWin} from '@/lib/multifactor-win';
import type {AnalysisReport} from '@/lib/pregame-analysis';
import {Button} from '@/components/ui/button';
export default function WinBreakdown({game,scheduleFresh}:{game:Match;scheduleFresh:boolean}){
 const [report,setReport]=useState<AnalysisReport>();
 const [loading,setLoading]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0),[now,setNow]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),10000);return()=>clearInterval(timer)},[]);
 useEffect(()=>{
  const controller=new AbortController();let busy=false;
  async function update(){if(busy||controller.signal.aborted)return;busy=true;setLoading(true);setError('');
   try{const r=await fetch('/api/analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gameId:game.id}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(65000)])});if(!r.ok)throw new Error('本場分析暫時無法取得');const value=await r.json();if(!controller.signal.aborted){setReport(value);setNow(Date.now())}}
   catch{if(!controller.signal.aborted)setError('分項資料更新失敗，請重試。')}
   finally{busy=false;if(!controller.signal.aborted)setLoading(false)}
  }
  if(isPregame(game,Date.now()))void update();
  const timer=setInterval(()=>{if(isPregame(game,Date.now()))void update()},120000);
  return()=>{controller.abort();clearInterval(timer)};
 },[game.id,game.date,game.season,game.home.pitcherId,game.away.pitcherId,revision]);
 const result=multifactorWin(game,report,now);
 if(!isPregame(game,now))return <p className="text-sm text-slate-400">此場已開賽或不符合賽前分析條件，不以賽後數值回填。</p>;
 return <section aria-label="勝率計算明細"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold">勝率計算明細</h3><Button variant="outline" disabled={loading} onClick={()=>setRevision(x=>x+1)}>{loading?'分析中…':'更新分項分析'}</Button></div>
 <p className="mt-3 text-sm">{scheduleFresh&&result.homeWin!==null?`客隊試算 ${((1-result.homeWin)*100).toFixed(1)}% ／ 主隊試算 ${(result.homeWin*100).toFixed(1)}%`:'賽程過期或資料不足，暫不顯示勝率'}</p>
 {error&&<p role="status" className="text-sm text-amber-200">{error}</p>}
 <details className="mt-4 rounded-lg border border-white/10 p-3 text-sm"><summary className="cursor-pointer font-bold text-amber-200">勝率怎麼算・已採用 {result.coverage}% 權重（試算）</summary><p className="my-3 text-slate-300">這是未回測校準的多因素試算。從 50% 起算，加上以下主隊影響；客隊為 100% 減主隊。缺項不補值、不重新分配權重。{result.reason}</p><div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left"><thead><tr><th>因素</th><th>設定權重</th><th>客隊原值</th><th>主隊原值</th><th>主隊影響</th></tr></thead><tbody>{result.factors.map(f=><tr key={f.name} className="border-t border-white/10"><td className="py-2" title={f.rule}>{f.name}<small className="block max-w-60 text-slate-400">{f.rule}</small></td><td>{f.weight}%</td><td>{f.away?.toFixed(2)??'—'}</td><td>{f.home?.toFixed(2)??'—'}</td><td>{f.score===null?'未採用':`${f.contribution>=0?'+':''}${f.contribution.toFixed(2)} 百分點`}</td></tr>)}</tbody></table></div><p className="mt-3 text-slate-400">各項差值依列示尺度換算，限制在 −1 至 +1；影響＝權重 × 分數 ÷ 2。這些尺度與權重是初始設定，並非統計驗證的因素重要性。賠率不加入球隊勝率；獨贏依較高試算勝率排序，不代表報酬較佳。讓分／大小分仍使用另列的球季得失分模型。</p></details></section>;
}
