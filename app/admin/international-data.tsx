'use client';
import {useEffect,useState} from 'react';
import {RefreshCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import type {SourceTable} from '@/lib/international';
import NpbRoster from '../npb-roster';
import KboSchedule from '../kbo-schedule';
import InternationalLiveStatus from './international-live-status';
import CpblDataSupplement from './cpbl-data-supplement';

type Data={tables?:SourceTable[];fetchedAt?:string;error?:string;status?:string};
type Records=Partial<Record<'npb-roster'|'kbo-schedule',Data>>;

export function InternationalDataPanels({data,loading,onRefresh}:{data:Records;loading:boolean;onRefresh:()=>void}){
 return <section className="space-y-4" aria-label="日韓職公告與賽程管理">
  <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">日韓職公告與賽程</h2><Button variant="outline" disabled={loading} onClick={onRefresh}><RefreshCw className={loading?'animate-spin':''}/>{loading?'讀取中…':'更新公告與賽程'}</Button></div>
  <NpbRoster data={data['npb-roster']} loading={loading}/>
  <details className="rounded-lg border border-slate-600 p-4"><summary className="cursor-pointer font-bold">韓職球隊紀錄來源</summary><a className="mt-2 inline-block text-sm underline" href="https://eng.koreabaseball.com/Schedule/DailySchedule.aspx" target="_blank" rel="noreferrer">KBO 官方逐月例行賽紀錄 ↗</a></details>
  <KboSchedule data={data['kbo-schedule']} loading={loading}/>
 </section>;
}

export default function InternationalData(){
 const [data,setData]=useState<Records>({}),[loading,setLoading]=useState(true),[revision,setRevision]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();let pending=false;
  async function load(){
   if(pending)return;pending=true;setLoading(true);
   await Promise.all((['npb-roster','kbo-schedule'] as const).map(async kind=>{
    try{
     const response=await fetch(`/api/international?kind=${kind}`,{cache:'no-store',signal:controller.signal});
     if(!response.ok)throw new Error();
     const value=await response.json();
     if(!controller.signal.aborted)setData(old=>({...old,[kind]:value}));
    }catch{
     if(!controller.signal.aborted)setData(old=>({...old,[kind]:{...old[kind],error:'來源暫時無法取得，請稍後更新。',status:old[kind]?.tables?.length?'stale':'unavailable'}}));
    }
   }));
   pending=false;if(!controller.signal.aborted)setLoading(false);
  }
  void load();const timer=setInterval(()=>void load(),300000);
  return()=>{controller.abort();clearInterval(timer);};
 },[revision]);
 return <><InternationalDataPanels data={data} loading={loading} onRefresh={()=>setRevision(v=>v+1)}/><InternationalLiveStatus/><CpblDataSupplement/></>;
}
