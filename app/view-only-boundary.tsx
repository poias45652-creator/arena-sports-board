'use client';
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';
import {usePathname} from 'next/navigation';
const Context=createContext(false);
export const useViewOnly=()=>useContext(Context);
const navigation='.league-switcher,.baseball-league-switcher,.league-tabs,.nba-tabs,.football-page-tabs,.football-leagues,.score-filters,[data-viewer-allow]';
function allowed(element:Element){
 if(element.closest(navigation))return true;
 if(element.matches('summary'))return true;
 if(element.matches('a[href]')){const url=new URL((element as HTMLAnchorElement).href,location.href);return url.origin===location.origin&&(url.pathname==='/'||url.pathname==='/free-trial'||url.pathname==='/teams'||url.pathname.startsWith('/teams/')||url.pathname.startsWith('/players/'));}
 return false;
}
export default function ViewOnlyBoundary({children}:{children:ReactNode}){
 const path=usePathname();
 const protectedPage=path==='/'||path.startsWith('/teams')||path.startsWith('/players')||path==='/ai-assistant';
 const [session,setSession]=useState<{path:string;viewer:boolean}|null>(null),[error,setError]=useState('');
 const ready=!protectedPage||session?.path===path,viewer=protectedPage&&session?.path===path&&session.viewer;
 useEffect(()=>{
  if(!protectedPage)return;const controller=new AbortController();
  const check=async()=>{try{const response=await fetch('/api/session',{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error();const data=await response.json();if(!data.signedIn){location.replace('/login');return;}setSession({path,viewer:data.accessMode==='view_only'});setError('');}catch{if(!controller.signal.aborted){setSession(null);setError('無法確認登入權限，請重新整理後再試。');}}};
  void check();const timer=setInterval(check,30000);return()=>{controller.abort();clearInterval(timer);};
 },[path,protectedPage]);
 useEffect(()=>{
  if(!viewer)return;
  const selector='button,input,select,textarea,a[href],[role="button"],[role="slider"],[contenteditable="true"]';
  const decorate=()=>document.querySelectorAll(selector).forEach(element=>{if(!allowed(element)){element.setAttribute('data-viewer-blocked','');element.setAttribute('aria-disabled','true');}});
  const block=(event:Event)=>{if(event instanceof KeyboardEvent&&['Tab','Escape'].includes(event.key))return;const target=event.target instanceof Element?event.target.closest(selector):null;if(target&&!allowed(target)){event.preventDefault();event.stopImmediatePropagation();}};
  decorate();const observer=new MutationObserver(decorate);observer.observe(document.body,{subtree:true,childList:true});
  const events=['click','auxclick','dblclick','pointerdown','keydown','beforeinput','change','submit'];
  for(const name of events)window.addEventListener(name,block,true);
  return()=>{observer.disconnect();for(const name of events)window.removeEventListener(name,block,true);document.querySelectorAll('[data-viewer-blocked]').forEach(element=>{element.removeAttribute('data-viewer-blocked');element.removeAttribute('aria-disabled');});};
 },[viewer,path]);
 if(!ready)return <main className="p-8 text-slate-200" role="status">{error||'正在確認登入權限…'}</main>;
 return <Context.Provider value={!!viewer}>{viewer&&<div className="border-b border-sky-300/30 bg-sky-950 px-4 py-2 text-center text-sm text-sky-100" role="status">aa3344 · 唯讀測試模式：僅供觀看，功能操作已停用</div>}{children}{viewer&&<style>{'[data-viewer-blocked]{opacity:.45!important;cursor:not-allowed!important;}'}</style>}</Context.Provider>;
}
