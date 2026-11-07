'use client';
import {useEffect,useState} from 'react';
import fallback from '@/data/football/five-league-score-fallback.json';
import audit from '@/data/football/five-league-verification.json';
import type {DomesticLeague} from '@/lib/football-five-league';
type RecordCounts={all:number;hits:number;featured:number;featuredHits:number};
function record(hits:number,n:number){return n?`${hits}／${n}（${(100*hits/n).toFixed(1)}%）`:'尚無已結算場次';}
export default function DomesticResults({league}:{league:DomesticLeague}){
 const [open,setOpen]=useState(false),[live,setLive]=useState<RecordCounts|null>(null),[failed,setFailed]=useState(false);
 useEffect(()=>{
  if(!open)return;
  const controller=new AbortController();setFailed(false);
  fetch('/api/football?kind=featured-record&league='+league,{signal:controller.signal}).then(async r=>{
   if(!r.ok)throw Error();const d=await r.json();if(!controller.signal.aborted)setLive(d);
  }).catch(()=>{if(!controller.signal.aborted)setFailed(true);});
  return ()=>controller.abort();
 },[open,league]);
 const {combined:c,from}=audit[league],{early,recent}=fallback[league];
 return <details className="football-method" onToggle={e=>setOpen(e.currentTarget.open)}><summary>首選與精選命中紀錄</summary>
  {open&&<div className="p-3 text-sm"><p>歷史回測（{from} 年至 2026/09/27）</p>
   <p>全場首選 {record(c.all.hits,c.all.n)}　精選 {record(c.featured.hits,c.featured.n)}</p>
   <p>比分備援回測（2023 年起）：全場 {record(early.hits+recent.hits,early.n+recent.n)}　精選 {record(early.featuredHits+recent.featuredHits,early.featured+recent.featured)}</p>
   <p>精選採用主勝、和局、客勝中最高機率達 60% 的場次。</p>
   <p>實際賽前紀錄（本版最近 500 場以內）</p>
   <p>{failed?'賽前紀錄暫時無法讀取':live?`全場首選 ${record(live.hits,live.all)}　精選 ${record(live.featuredHits,live.featured)}`:'讀取中…'}</p>
  </div>}
 </details>;
}
