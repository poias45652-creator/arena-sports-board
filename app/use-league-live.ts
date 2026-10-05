'use client';
import {useEffect,useState} from 'react';
import {taipeiDay} from '@/lib/baseball';
import {liveRequest} from './live-request';
type League='CPBL'|'NPB'|'KBO';
const leagues:League[]=['CPBL','NPB','KBO'];
/** Defaults to all international leagues; front-end callers can request only leagues they display. */
export function useLeagueLive(selected:readonly League[]=leagues){
 const [until,setUntil]=useState<Partial<Record<League,number>>>({});
 const [now,setNow]=useState(Date.now());
 const scope=[...new Set(selected)].filter((league):league is League=>leagues.includes(league)).sort().join(',');
 useEffect(()=>{
  const active=(scope?scope.split(','):[]) as League[];
  if(!active.length)return;
  const controller=new AbortController();let busy=false;
  async function refresh(){
   if(busy||document.hidden)return;busy=true;const date=taipeiDay(Date.now());
   await Promise.allSettled(active.map(async league=>{
    let expiry=0;
    try{
     const data=await liveRequest(`/api/international-live?league=${league}&date=${date}`,controller.signal);
     if(data.league===league&&data.date===date&&!data.noGames&&!data.stale&&!data.error&&Array.isArray(data.games)&&data.games.length>0){
      for(const game of data.games){
       const fetched=Date.parse(game.source?.fetchedAt);
       const start=Date.parse(game.startTime);
       const current=Date.now();
       if(game.league===league&&game.date===date&&game.status==='live'&&!game.sourceStale&&Number.isFinite(start)&&start<=current&&current-start<18*60*60*1000&&Number.isFinite(fetched)&&fetched<=current&&current-fetched<120000)expiry=Math.max(expiry,fetched+120000);
      }
     }
    }catch{}
    if(!controller.signal.aborted)setUntil(old=>({...old,[league]:expiry}));
   }));busy=false;
  }
  const resume=()=>{if(!document.hidden){setNow(Date.now());void refresh();}};
  void refresh();const poll=setInterval(()=>void refresh(),60000),clock=setInterval(()=>setNow(Date.now()),15000);
  document.addEventListener('visibilitychange',resume);window.addEventListener('arena-refresh-all',resume);
  return()=>{controller.abort();clearInterval(poll);clearInterval(clock);document.removeEventListener('visibilitychange',resume);window.removeEventListener('arena-refresh-all',resume);};
 },[scope]);
 return {now,CPBL:(until.CPBL??0)>now,NPB:(until.NPB??0)>now,KBO:(until.KBO??0)>now};
}
