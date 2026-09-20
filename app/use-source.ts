'use client';
import {useState,useRef,useCallback,useEffect} from 'react';
import {readMemberOdds,scopeMemberOdds} from '@/lib/member-odds-client';
export function useSource<T>(kind:string,interval:number){
 const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const busy=useRef(false),controller=useRef<AbortController|null>(null),generation=useRef(0);
 const refresh=useCallback(async(force=false)=>{
  if(busy.current&&!force)return;
  if(force)controller.current?.abort();
  const version=++generation.current;busy.current=true;setLoading(true);const c=new AbortController();controller.current=c;
  const timer=setTimeout(()=>c.abort(),35000);
  try{
   let j;
   if(kind.startsWith('member-odds'))j=scopeMemberOdds(await readMemberOdds(),new URLSearchParams(kind.split('&').slice(1).join('&')).get('league'));
   else{const r=await fetch(`/api/baseball?kind=${kind}`,{signal:c.signal,cache:'no-store'});j=await r.json();if(!r.ok)throw new Error(j.error||'來源暫時無法連線');}
   if(c.signal.aborted)throw new DOMException('Aborted','AbortError');
   if(version===generation.current){setData(j);setError('');}
  }catch(e){if(version===generation.current){if(kind.startsWith('member-odds'))setData(null);setError(e instanceof Error&&e.name!=='AbortError'?e.message:'更新逾時，稍後自動重試。');}}
  finally{clearTimeout(timer);if(version===generation.current){busy.current=false;setLoading(false);}}
 },[kind]);
 useEffect(()=>{
  void refresh();const timer=setInterval(()=>void refresh(),interval);
  const changed=()=>{if(kind.startsWith('member-odds'))setData(null);setError('');void refresh(true);};
  window.addEventListener('arena-refresh-all',changed);
  if(kind.startsWith('member-odds'))window.addEventListener('arena-odds-change',changed);
  return()=>{clearInterval(timer);generation.current++;busy.current=false;controller.current?.abort();window.removeEventListener('arena-odds-change',changed);window.removeEventListener('arena-refresh-all',changed);};
 },[refresh,interval,kind]);
 const publicRefresh=useCallback(()=>refresh(),[refresh]);
 return {data,error,loading,refresh:publicRefresh};
}
