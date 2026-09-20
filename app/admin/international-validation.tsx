'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
const names:Record<string,string>={CPBL:'中職',NPB:'日職',KBO:'韓職'};
const outcome:Record<string,string>={away:'客勝',home:'主勝',draw:'和局'};
const score=(n:number|null|undefined)=>typeof n==='number'?n.toFixed(4):'—';
export default function InternationalValidation(){
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function load(){setBusy(true);setError('');try{const r=await fetch('/api/admin/international-validation',{cache:'no-store'});if(!r.ok)throw Error();setData(await r.json());}catch{setError('回測報告暫時讀取失敗，請稍後更新。');}finally{setBusy(false);}}
 useEffect(()=>{void load();},[]);
 const historical=data?.historical,prospective=data?.prospective;
 return <section className="panel admin-section p-5 space-y-4" aria-label="三聯盟回測與機率校準">
  <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">三聯盟回測與機率校準</h2><Button variant="outline" disabled={busy} onClick={()=>void load()}>{busy?'讀取中…':'更新驗證紀錄'}</Button></div>
  <p className="text-amber-200">完整上線模型尚未通過回測校準。以下是團隊戰績研究模型，與前台使用先發、牛棚的模型不同，研究參數沒有套用到前台。</p>
  {error&&<p role="alert">{error}</p>}
  {historical&&<>
   <p className="text-sm text-slate-300">已核對 {historical.leagues.reduce((n:number,l:any)=>n+l.sourceGames,0)} 場歷史賽果，測試保留 {historical.leagues.reduce((n:number,l:any)=>n+l.split.test.games,0)} 場。訓練截至 6/30；校準 7/1–8/15；最後測試 8/16–9/19。每場只用更早日期的資料，兩隊各需至少 20 場，和局保留。</p>
   <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="pb-2 text-left text-slate-300">Brier 誤差越低越好（勝／和／負三類合計，範圍 0–2）；不是命中率。</caption><thead><tr>{['聯盟','訓練／校準／測試','校準前','校準後','簡單基準','上線狀態'].map(h=><th key={h} className="whitespace-nowrap border-b border-slate-600 p-3">{h}</th>)}</tr></thead><tbody>{historical.leagues.map((l:any)=><tr key={l.league}>{[names[l.league],`${l.split.training.games}／${l.split.calibration.games}／${l.split.test.games}`,score(l.uncalibrated.brier),score(l.calibrated.brier),score(l.baseline.brier),'未套用'].map((x,i)=><td className="border-b border-slate-700 p-3" key={i}>{x}</td>)}</tr>)}</tbody></table></div>
   <p className="text-sm text-slate-300">簡單基準只用訓練期的主勝、客勝、和局比例。三個研究模型校準後仍未勝過此基準。歷史賽前先發、牛棚與報價快照不齊，因此不能宣稱七種玩法或投注報酬率已驗證。</p>
   {historical.leagues.map((l:any)=><details key={l.league} className="rounded border border-slate-600"><summary className="cursor-pointer p-3 font-bold">{names[l.league]} · 測試 {l.split.test.games} 場 · 未通過上線驗證</summary><div className="space-y-3 px-3 pb-3 text-sm">
    <p>測試期間 {l.split.test.start}–{l.split.test.end}；主勝 {l.split.test.results.home}、客勝 {l.split.test.results.away}、和局 {l.split.test.results.draw} 場。</p>
    <p>樣本門檻：{l.gate.samplePassed?'通過':'未通過（包含每段至少 3 場和局）'}；改善門檻：{l.gate.improvementPassed?'通過':'未通過'}；與前台完整模型一致：否。</p>
    <p>校準前／後 Log loss：{score(l.uncalibrated.logLoss)}／{score(l.calibrated.logLoss)}；平均分箱校準誤差：{score(l.uncalibrated.macroECE)}／{score(l.calibrated.macroECE)}。</p>
    <p>Brier 校準後減校準前的 95% 區間：[{l.brierDifference95CI.map(score).join(', ')}]；相對簡單基準：[{l.brierVsBaseline95CI.map(score).join(', ')}]。按比賽日期整組重抽 2,000 次，負值代表誤差較低。</p>
    <details><summary className="cursor-pointer">機率分箱核對</summary><div className="overflow-x-auto"><table className="mt-2 w-full text-left"><thead><tr>{['結果','預估機率區間','場數','平均預測','實際比例'].map(h=><th className="border-b border-slate-600 p-2" key={h}>{h}</th>)}</tr></thead><tbody>{l.calibrated.reliability.flatMap((c:any)=>c.bins.map((b:any,i:number)=><tr key={c.outcome+i}>{[outcome[c.outcome],`${Math.round(b.fromProbability*100)}–${Math.round(b.toProbability*100)}%`,b.games,b.meanPrediction===null?'—':`${(b.meanPrediction*100).toFixed(1)}%`,b.observedRate===null?'—':`${(b.observedRate*100).toFixed(1)}%`].map((v,j)=><td key={j} className="border-b border-slate-700 p-2">{v}</td>)}</tr>))}</tbody></table></div></details>
    <p>來源版本擷取：{l.source.observedAt}。使用事後賽果重建，原始當時版本未留存。{l.source.urls.map((url:string,i:number)=><a key={url} href={url} target="_blank" rel="noreferrer" className="ml-2 underline">來源 {i+1}</a>)}</p>
   </div></details>)}
  </>}
  <div className="space-y-3 rounded border border-slate-600 p-4"><h3 className="font-bold">完整模型 · 真實賽前留存</h3><p className="text-sm text-slate-300">從本次更新起，在網站取得可用賽前分析時，由伺服器保存當時預測、模型版本及輸入。每 15 分鐘保留一筆，資料不覆寫；賽後以明確配對的完賽比分核對。關閉所有網頁後的全天背景排程仍未啟用。</p>
   {data?.error&&<p className="text-amber-200">{data.error}</p>}
   {prospective&&<><p>已留存 {prospective.snapshots} 筆；核對範圍最近 {prospective.windowDays} 日。{prospective.selection}</p>{prospective.groups.length===0?<p className="text-amber-200">尚無可核對的真實賽前預測；不倒填已開賽或已完賽場次。</p>:<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{['聯盟／版本','已保存場次','已核對','待賽果','配對衝突','Brier','Log loss','終場得分誤差'].map(h=><th key={h} className="whitespace-nowrap border-b border-slate-600 p-2">{h}</th>)}</tr></thead><tbody>{prospective.groups.map((g:any)=><tr key={g.league+g.version}>{[`${names[g.league]}／${g.version}`,g.captured,g.evaluated,g.pending,g.ambiguous,score(g.brier),score(g.logLoss),score(g.finalScoreMAE)].map((x,i)=><td className="border-b border-slate-700 p-2" key={i}>{x}</td>)}</tr>)}</tbody></table></div>}
   {(prospective.truncated||prospective.unreadable>0||prospective.rejected>0)&&<p className="text-amber-200">部分紀錄未納入：讀取失敗 {prospective.unreadable}、驗證未通過 {prospective.rejected}。{prospective.truncated?'超過本次讀取上限，結果不是全部紀錄。':''}</p>}</>}
  </div>
 </section>;
}
