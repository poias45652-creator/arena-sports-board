"use client";
import {useEffect} from 'react';
import type {Match} from '@/lib/baseball';
import type {AnalysisReport} from '@/lib/pregame-analysis';
export type AnalysisState={report?:AnalysisReport;error?:string;loading?:boolean};
export default function GameContext({games,onChange,onResults}:{games:Match[];onChange:(id:number,data:AnalysisState)=>void;onResults:(value:any)=>void}){
 const key=games.filter(g=>g.state==='Preview').map(g=>[g.id,g.date,g.away.pitcherId,g.home.pitcherId].join(':')).sort().join(',');
 const teams=[...new Set(games.flatMap(g=>[g.away.id,g.home.id]))].sort((a,b)=>a-b).join(',');
 useEffect(()=>{
  const controller=new AbortController();let running=false;
  async function update(){if(running||controller.signal.aborted)return;running=true;const ids=key?key.split(',').map(s=>Number(s.split(':')[0])):[];let cursor=0;
   try{await Promise.all([0,1].map(async()=>{while(cursor<ids.length&&!controller.signal.aborted){const id=ids[cursor++];onChange(id,{loading:true});try{
    const r=await fetch('/api/analysis',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gameId:id}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(65000)])});if(!r.ok)throw new Error();const report=await r.json();if(!controller.signal.aborted)onChange(id,{report});
   }catch{if(!controller.signal.aborted)onChange(id,{error:'進階資料整合未完成，稍後重試'});}}}));}finally{running=false;}
  }
  void update();const timer=setInterval(update,120000);return()=>{controller.abort();clearInterval(timer);};
 },[key,onChange]);
 useEffect(()=>{
  const controller=new AbortController();let running=false;
  async function update(){if(running||controller.signal.aborted)return;running=true;const ids=teams?teams.split(','):[];let cursor=0;try{await Promise.all([0,1].map(async()=>{while(cursor<ids.length&&!controller.signal.aborted){const id=ids[cursor++];try{await fetch(`/api/baseball?kind=covers-history&teamId=${id}`,{signal:AbortSignal.any([controller.signal,AbortSignal.timeout(35000)])});}catch{}}}));}finally{running=false;}}
  void update();const timer=setInterval(update,6*3600000);return()=>{controller.abort();clearInterval(timer);};
 },[teams]);
 useEffect(()=>{const c=new AbortController();let running=false;async function update(){if(running)return;running=true;try{const r=await fetch('/api/analysis/results',{method:'POST',signal:AbortSignal.any([c.signal,AbortSignal.timeout(45000)])});if(!r.ok)throw new Error();const value=await r.json();if(!c.signal.aborted)onResults(value);}catch{if(!c.signal.aborted)onResults({error:'驗證紀錄暫時無法取得'});}finally{running=false;}}void update();const t=setInterval(update,600000);return()=>{c.abort();clearInterval(t);};},[onResults]);
 return null;
}
