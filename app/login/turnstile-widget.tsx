'use client';
import {useEffect,useRef,useState} from 'react';
import {TURNSTILE_SITE_KEY} from '@/lib/turnstile';
import {loadTurnstile,type TurnstileApi} from '@/lib/turnstile-browser';
export default function TurnstileWidget({onToken,attempt}:{onToken:(token:string)=>void;attempt:number}){
 const [error,setError]=useState('');const container=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  setError('');let disposed=false,id:string|undefined,api:TurnstileApi|undefined;
  const fail=(message:string)=>{if(!disposed){onToken('');setError(message);}};
  void loadTurnstile().then(loaded=>{
   if(disposed||!container.current)return;api=loaded;
   id=api.render(container.current,{sitekey:TURNSTILE_SITE_KEY,action:'login',theme:'dark',size:'flexible',
    callback:(token:string)=>{if(!disposed){setError('');onToken(token);}},
    'expired-callback':()=>{if(!disposed)onToken('');},
    'error-callback':(code:string)=>{fail(`安全驗證失敗（代碼：${String(code).replace(/[^a-zA-Z0-9_-]/g,'').slice(0,32)||'未知'}），請提供此代碼給管理員。`);return true;}
   });
  }).catch(()=>fail('安全驗證程式未能載入，請重新整理後再試。'));
  return()=>{disposed=true;try{if(id!==undefined)api?.remove(id);}catch{}};
 },[onToken,attempt]);
 return <div><div ref={container}/>{error&&<p role="alert" className="text-amber-300">{error}</p>}<p className="text-sm text-slate-400">請完成安全驗證。若驗證未載入，請重新整理頁面。</p></div>;
}
