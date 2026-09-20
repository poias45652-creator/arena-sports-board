'use client';
import {useEffect,useState} from 'react';
const sections=[['research','歷史研究'],['quarantine','待核對'],['archive','賽前歷史觀測']];
function Fields({value}:{value:any}){
 if(value===null||value===undefined)return <span className="text-slate-400">未提供</span>;
 if(typeof value!=='object')return <span className="break-words">{String(value)}</span>;
 return <dl className="space-y-2 border-l border-slate-600 pl-3">{Object.entries(value).map(([k,v])=><div key={k} className="min-w-0"><dt className="font-semibold text-slate-300 break-words">{k}</dt><dd className="pl-2"><Fields value={v}/></dd></div>)}</dl>;
}
export default function ResearchPanel(){
 const [section,setSection]=useState('research'),[league,setLeague]=useState('');
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[receipt,setReceipt]=useState<any>(null);
 const [refresh,setRefresh]=useState(0);
 useEffect(()=>{const controller=new AbortController();setData(null);setError('');fetch(`/api/admin/baseball-research?section=${section}&league=${league}`,{signal:controller.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);return d;}).then(setData).catch(e=>{if(e.name!=='AbortError')setError(e.message)});return()=>controller.abort();},[section,league,refresh]);
 async function importData(){setBusy(true);setError('');setReceipt(null);try{const r=await fetch('/api/admin/baseball-research',{method:'POST'});const d=await r.json();if(!r.ok){setReceipt(d.receipt);throw Error(d.error);}setReceipt(d);setRefresh(x=>x+1);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 return <section className="rounded-xl border border-slate-700 bg-[#0e1b2b] p-5 space-y-5">
  <h2 className="text-xl font-bold">管理員研究資料</h2>
  <p className="text-slate-300">歷史研究與待核對資料僅供管理員使用，不會自動加入會員分析或今日比分。賽前觀測保留原日期與擷取時間。</p>
  <button className="rounded bg-[#ffd538] px-4 py-2 font-semibold text-slate-950 disabled:opacity-50" disabled={busy} onClick={importData}>{busy?'補入並讀回核對中…':'補入 2026/09/15 既有資料'}</button>
  <p className="text-sm text-slate-400">217 筆研究、29 筆日期衝突、13 場歷史觀測。同一來源與紀錄已存在時保留原站版本。</p>
  {receipt&&<div role="status" className="rounded border border-slate-600 p-3 space-y-1"><p>本次新增 {receipt.inserted} · 更新 {receipt.updated} · 略過 {receipt.skipped} · 新增待核對 {receipt.quarantined}（包含在新增內）· 寫入失敗 {receipt.failed}</p><p>資料庫讀回核對 {receipt.verified}/259；保留不同既有版本 {receipt.preservedDifferent}。</p><p>{receipt.readBackAt?`讀回完成：${receipt.readBackAt}`:'讀回尚未完成，不能視為補入完成。'}</p></div>}
  {error&&<p role="alert" className="text-amber-300">{error}</p>}
  <div className="flex flex-wrap gap-2">{sections.map(([id,label])=><button key={id} onClick={()=>setSection(id)} aria-pressed={section===id} className={`rounded border px-3 py-2 ${section===id?'border-yellow-400 text-yellow-300':'border-slate-600'}`}>{label} {data?data.counts.filter((x:any)=>x.section===id).reduce((n:number,x:any)=>n+x.count,0):''}</button>)}<label className="flex items-center gap-2">聯盟<select value={league} onChange={e=>setLeague(e.target.value)} className="rounded border border-slate-600 bg-[#0e1b2b] p-2"><option value="">全部</option>{['CPBL','NPB','KBO'].map(x=><option key={x}>{x}</option>)}</select></label></div>
  {section==='archive'&&<p className="text-amber-300">以下皆為 2026/09/15 上午擷取的過期賽前觀測；不是目前即時比分。</p>}
  {!data&&!error&&<p role="status">讀取資料中…</p>}
  {data?.rows.length===0&&<p>此區尚無已儲存資料。</p>}
  <div className="space-y-3">{data?.rows.map((r:any)=><details key={r.key} className="rounded border border-slate-700 p-3"><summary className="cursor-pointer font-semibold">{r.league} · {r.entity}<span className="block text-sm font-normal text-slate-400">原觀測時間：{r.observed_at} · 來源資料截止：{r.source_as_of||'未提供'}</span></summary><div className="mt-4 space-y-3"><a href={r.source_url} target="_blank" rel="noreferrer" className="text-yellow-300 underline">查看原始來源</a>{r.payload.qualityFlags?.length>0&&<p className="text-amber-300">待核對原因：{r.payload.qualityFlags.join('、')}</p>}<Fields value={r.payload.projection??r.payload}/>{r.payload.projection&&<details><summary>原始紀錄與品質註記</summary><Fields value={r.payload.original}/></details>}</div></details>)}</div>
 </section>;
}
