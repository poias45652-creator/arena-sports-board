'use client';
import {useState,useRef,useCallback,useEffect} from 'react';
import {readMemberOdds,scopeMemberOdds,memberOddsRequestError} from '@/lib/member-odds-client';
export function useSource<T>(kind:string,interval:number){
 const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[errorCode,setErrorCode]=useState(''),[loading,setLoading]=useState(true);
 const busy=useRef(false),controller=useRef<AbortController|null>(null),generation=useRef(0);
 const startedAt=useRef(0),queued=useRef(false);
 const retryTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined),failures=useRef(0);
 const refresh=useCallback(async(force=false)=>{
  const memberOdds=kind.startsWith('member-odds'),timeout=memberOdds?75000:35000;
  if(busy.current&&Date.now()-startedAt.current>=0&&Date.now()-startedAt.current<timeout){
   if(force)queued.current=true;
   return;
  }
  clearTimeout(retryTimer.current);
  controller.current?.abort();queued.current=false;startedAt.current=Date.now();
  const version=++generation.current;busy.current=true;setLoading(true);setError('');setErrorCode('');const c=new AbortController();controller.current=c;
  const timer=setTimeout(()=>c.abort(),timeout);
  let stopWaiting:(()=>void)|undefined;
  try{
   let j;
   if(memberOdds){
    const aborted=new Promise<never>((_,reject)=>{const abort=()=>reject(new DOMException('Aborted','AbortError'));c.signal.addEventListener('abort',abort,{once:true});stopWaiting=()=>c.signal.removeEventListener('abort',abort);});
    j=scopeMemberOdds(await Promise.race([readMemberOdds(),aborted]),new URLSearchParams(kind.split('&').slice(1).join('&')).get('league'));
   }
   else{const r=await fetch(`/api/baseball?kind=${kind}`,{signal:c.signal,cache:'no-store'});j=await r.json();if(!r.ok)throw new Error(j.error||'來源暫時無法連線');}
   if(c.signal.aborted)throw new DOMException('Aborted','AbortError');
   if(version===generation.current&&!queued.current){
    setData(j);setError('');failures.current=0;
    if(memberOdds){
     // A cached snapshot can already be nearly a minute old when received.
     // Leave a minute for the next read before the unchanged 150-second limit.
     const age=Date.now()-Date.parse(j?.fetchedAt||'');
     const delay=Number.isFinite(age)&&age>=-60000?Math.max(15000,90000-age):15000;
     if(delay<interval)retryTimer.current=setTimeout(()=>{if(document.visibilityState!=='hidden')void refresh();},delay);
    }
   }
  }catch(e){if(version===generation.current&&!queued.current){
   if(kind.startsWith('member-odds')){
    const failure=memberOddsRequestError(e);setData(null);setError(failure.message);setErrorCode(failure.code);
    if(failure.retryable)retryTimer.current=setTimeout(()=>{if(document.visibilityState!=='hidden')void refresh();},Math.min(60000,15000*2**Math.min(failures.current++,2)));
   }else setError(e instanceof Error&&e.name!=='AbortError'?e.message:'更新逾時，稍後自動重試。');
  }}
  finally{clearTimeout(timer);stopWaiting?.();if(version===generation.current){busy.current=false;if(queued.current)void refresh();else setLoading(false);}}
 },[kind,interval]);
 useEffect(()=>{
  void refresh();const timer=setInterval(()=>{if(document.visibilityState!=='hidden')void refresh();},interval);
  const changed=()=>{if(kind.startsWith('member-odds'))setData(null);setError('');void refresh(true);};
  const resume=()=>{if(document.visibilityState!=='hidden')void refresh();};
  window.addEventListener('arena-refresh-all',changed);
  if(kind.startsWith('member-odds'))window.addEventListener('arena-odds-change',changed);
  document.addEventListener('visibilitychange',resume);window.addEventListener('online',resume);window.addEventListener('pageshow',resume);
  return()=>{clearInterval(timer);clearTimeout(retryTimer.current);generation.current++;busy.current=false;controller.current?.abort();window.removeEventListener('arena-odds-change',changed);window.removeEventListener('arena-refresh-all',changed);document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',resume);window.removeEventListener('pageshow',resume);};
 },[refresh,interval,kind]);
 const publicRefresh=useCallback(()=>refresh(),[refresh]);
 return {data,error,errorCode,loading,refresh:publicRefresh};
}
