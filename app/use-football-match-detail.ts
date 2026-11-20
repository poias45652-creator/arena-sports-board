'use client';
import {useEffect,useState} from 'react';
import type {FootballDetail} from '../lib/football-live';

export function useFootballMatchDetail(url:string,state:string,start:string,timeConfirmed:boolean,reload:number){
 const [detail,setDetail]=useState<FootballDetail|null>(null);
 const [error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{
   const controller=new AbortController();
   let timer:ReturnType<typeof setTimeout>,busy=false,currentState=state;
   async function refresh(){
     if(busy||controller.signal.aborted||document.visibilityState==='hidden')return;
     clearTimeout(timer);busy=true;
     const began=Date.now();
     try{
       const response=await fetch(url,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(25000)])});
       if(response.status===401){window.location.assign('/login');return;}
       if(!response.ok)throw Error('賽況暫時無法更新');
       const data:FootballDetail=await response.json();
       if(!controller.signal.aborted){currentState=data.game.state;setDetail(data);setError('');}
     }catch{if(!controller.signal.aborted)setError('賽況暫時無法更新');}
     finally{
       busy=false;
       if(!controller.signal.aborted){
         setLoading(false);
         const elapsed=Date.now()-Date.parse(start);
         const nearKickoff=timeConfirmed&&['scheduled','pending','unknown'].includes(currentState)&&elapsed>=-60000&&elapsed<3*3600000;
         const interval=currentState==='live'||nearKickoff?5000:60000;
         timer=setTimeout(refresh,Math.max(1000,interval-(Date.now()-began)));
       }
     }
   }
   void refresh();
   document.addEventListener('visibilitychange',refresh);window.addEventListener('online',refresh);
   return()=>{controller.abort();clearTimeout(timer);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('online',refresh);};
 },[url,state,start,timeConfirmed,reload]);
 return {detail,error,loading};
}
