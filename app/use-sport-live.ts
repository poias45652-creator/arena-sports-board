'use client';
import {useEffect,useState} from 'react';
import {taipeiDay} from '@/lib/baseball';
import {scheduleLiveUntil} from '@/lib/sport-live';
import {nbaRequest} from './nba-request';
const basketball=[['NBA','/api/nba'],['WNBA','/api/wnba']] as const;
const football=['eng.1','esp.1','ita.1','ger.1','fra.1','uefa.champions','uefa.nations'].map(code=>[code,`/api/football?league=${code}`] as const);
const allSources=[...basketball,...football] as const;
type Active='NBA'|'WNBA'|'FOOTBALL'|'ALL'|'NONE';
export function useSportLive(active:Active='ALL'){
 const [until,setUntil]=useState<Record<string,number>>({}),[now,setNow]=useState(Date.now);
 useEffect(()=>{
  const sources=active==='ALL'?allSources:active==='FOOTBALL'?football:active==='NBA'?[basketball[0]]:active==='WNBA'?[basketball[1]]:[];
  if(!sources.length){setUntil({});return;}
  const controller=new AbortController();let busy=false;
  async function refresh(){
   if(busy||document.hidden||controller.signal.aborted)return;busy=true;
   const day=taipeiDay(Date.now());
   await Promise.allSettled(sources.map(async([code,url])=>{
    let expiry=0;
    try{
     const target=`${url}${url.includes('?')?'&':'?'}date=${day}`;
     let data;
     if(code==='NBA'||code==='WNBA')data=await nbaRequest(target,controller.signal);
     else{const r=await fetch(target,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(45000)])});if(!r.ok)throw Error();data=await r.json();}
     expiry=scheduleLiveUntil(data,code,day,Date.now());
    }catch{}
    if(!controller.signal.aborted)setUntil(old=>({...old,[code]:expiry}));
   }));busy=false;
  }
  const resume=()=>{if(!document.hidden){setNow(Date.now());void refresh();}};
  void refresh();const poll=setInterval(()=>void refresh(),30000),clock=setInterval(()=>setNow(Date.now()),15000);
  document.addEventListener('visibilitychange',resume);window.addEventListener('arena-refresh-all',resume);
  return()=>{controller.abort();clearInterval(poll);clearInterval(clock);document.removeEventListener('visibilitychange',resume);window.removeEventListener('arena-refresh-all',resume);};
 },[active]);
 return {NBA:(until.NBA||0)>now,WNBA:(until.WNBA||0)>now,FOOTBALL:football.some(([code])=>(until[code]||0)>now)};
}
