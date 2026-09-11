"use client";
import {useEffect,useState} from 'react';
import validation from '@/data/model-validation.json';
export default function OperationsPanel({evaluation}:{evaluation:any}){
 const [status,setStatus]=useState<any>(null);
 useEffect(()=>{const c=new AbortController();let busy=false;async function update(){if(busy)return;busy=true;try{const r=await fetch('/api/operations',{cache:'no-store',signal:c.signal});if(r.ok)setStatus(await r.json());}catch{}finally{busy=false;}}void update();const t=setInterval(update,60000);return()=>{c.abort();clearInterval(t);};},[]);
 const c=status?.collector;
 return <details className="panel p-5"><summary className="cursor-pointer font-bold">更新狀態・推薦成績・模型驗證</summary>
 <div className="mt-4 space-y-4 text-sm">
 <p className="text-amber-200">{status?.backgroundStatus||'正在查詢背景更新狀態…'}</p>
 {c&&<p>獨立抓盤服務：{c.reachable?`成功 ${c.success} 次／失敗 ${c.failed} 次；觀測 ${Number(c.observedHours||0).toFixed(1)} 小時；最大間隔 ${c.maxGapSeconds??'—'} 秒`:'目前無法讀取狀態'}。這些次數可能包含手動測試。</p>}
 <p>授權失效或來源拒絕存取時，盤口區會顯示原因並停用舊盤推薦。重新連接需由管理者更新來源授權，目前尚未提供網站內的安全更新表單。</p>
 <p>已支援：全場讓分／大小的整分、半分、拆分與比例主盤。局數盤、滾球及特殊裁定尚未接入推薦，不能套用全場模型。</p>
 <p>歷史研究：2023 訓練、2024 校準、2025 測試，共 {validation.split['2025'].games} 場測試。研究候選模型 Brier {validation.test.calibratedLogistic.brier.toFixed(4)}，尚未替換目前推薦模型，也沒有可驗證的歷史 Super007 投注報酬率。</p>
 <p>進階資料已收集投手、打線、傷兵、牛棚、球場與天氣；各場缺項可在「查看分析缺項與保存狀態」查看。收集完成不等於已證實能提高預測準確度。</p>
 <p>保存快照：{evaluation?.snapshots??'—'} 筆／{evaluation?.games??'—'} 場；已對上賽果的基礎勝負估算：{evaluation?.evaluatedGames??'—'} 場。</p>
 <p className="text-slate-400">{evaluation?.ledgerScope||'Super007 成績將由新版賽前快照開始累積，不回填或冒充過去的推薦。'}</p>
 {evaluation?.error&&<p className="text-amber-200">{evaluation.error}</p>}
 <div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>玩法</th><th>全贏</th><th>中洞贏</th><th>中洞輸</th><th>全輸</th><th>淨損益（單位）</th></tr></thead><tbody>{(['spread','total'] as const).map(k=>{const m=evaluation?.markets?.[k];return <tr key={k}><td>{k==='spread'?'讓分':'大小'}</td>{['win','partialWin','partialLoss','loss'].map(f=><td key={f}>{m?.[f]??0}</td>)}<td>{Number(m?.profitUnits??0).toFixed(2)}</td></tr>;})}</tbody></table></div>
 <div className="space-y-2">{(evaluation?.ledger??[]).slice(0,20).map((r:any,i:number)=><div className="rounded border border-white/10 p-3" key={i}>{r.away} vs {r.home} · {r.score.away}：{r.score.home}<br/>{r.market==='spread'?'讓分':'大小'} · {r.side} · {r.line} @ {r.netOdds} · {r.fraction>0?'贏':r.fraction<0?'輸':'退回'} {Math.abs(r.fraction*100).toFixed(0)}% · 淨損益 {r.profitUnits.toFixed(3)}<br/><span className="text-slate-400">保存時間：{new Date(r.capturedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}</span></div>)}</div>
 </div></details>;
}
