'use client';
import {useEffect,useState} from 'react';
import {readTeamWeightBook,teamWeightStorageKey,type TeamWeightBook} from '@/lib/team-model-settings';
export function useTeamWeightBook(league:string){
 const [state,setState]=useState<{league:string;book:TeamWeightBook}|null>(null);
 useEffect(()=>{
  const refresh=()=>{try{setState({league,book:readTeamWeightBook(localStorage.getItem(teamWeightStorageKey(league)),league)});}catch{setState({league,book:{}});}};
  refresh();window.addEventListener('storage',refresh);window.addEventListener('team-weights-change',refresh);
  return()=>{window.removeEventListener('storage',refresh);window.removeEventListener('team-weights-change',refresh);};
 },[league]);
 const book=state?.league===league?state.book:{};
 function clear(){try{localStorage.removeItem(teamWeightStorageKey(league));window.dispatchEvent(new Event('team-weights-change'));}catch{setState({league,book:{}});}}
 return {book,ready:state?.league===league,signature:JSON.stringify(book),count:Object.keys(book).length,clear};
}
export function TeamWeightNotice({count,onClear}:{count:number;onClear:()=>void}){
 return count?<div className="panel my-3 flex flex-wrap items-center gap-3 p-3 text-sm text-slate-300"><span>已套用 {count} 隊專屬權重；未開賽對戰綜合雙方配置計算。設定保留 7 天。</span><button className="header-action ml-auto" type="button" onClick={onClear}>還原球隊權重</button></div>:null;
}
