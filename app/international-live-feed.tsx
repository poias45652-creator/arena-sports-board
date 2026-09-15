"use client";
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
type Person={name?:string;confirmation?:string};
type Team={name:string;score:number|null;hits:number|null;errors:number|null};
type Game={key:string;league:string;date:string;status:string;startTime:string|null;sourceStale?:boolean;away:Team;home:Team;inning:number|null;half:string|null;balls:number|null;strikes:number|null;outs:number|null;bases:(boolean|null)[]|null;starters:{away:Person|null;home:Person|null};innings:{away:{inning:number;runs:number|null}[];home:{inning:number;runs:number|null}[]};lineups:{away:(Person&{order:number|null;position:string|null})[];home:(Person&{order:number|null;position:string|null})[]};pitching:{away:(Person&{pitchCount:number|null})[];home:(Person&{pitchCount:number|null})[]};source:{url:string;provider:string;fetchedAt:string}};
type Feed={league:string;date:string;games:Game[];status:string;stale:boolean;error?:string;pollAfterMs?:number;persistence?:{error?:string}};
const labels:Record<string,string>={pregame:'未開賽',live:'進行中',final:'已完賽',postponed:'延賽',cancelled:'取消',suspended:'暫停',unknown:'狀態待確認'};
const stamp=(v:string|null)=>v&&Number.isFinite(Date.parse(v))?new Date(v).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}):'未提供';
function old(g:Game,now:number){const t=Date.parse(g.source.fetchedAt);return !!g.sourceStale||!Number.isFinite(t)||now-t>(g.status==='live'?120000:600000);}
export default function InternationalLiveFeed({league,revision}:{league:'NPB'|'KBO'|'CPBL';revision:number}){
 const [feed,setFeed]=useState<Feed>(),[loading,setLoading]=useState(false),[error,setError]=useState(''),[retry,setRetry]=useState(0),[clock,setClock]=useState(Date.now());
 useEffect(()=>{const t=setInterval(()=>setClock(Date.now()),15000);return()=>clearInterval(t)},[]);
 useEffect(()=>{
  let stopped=false,busy=false,timer:ReturnType<typeof setTimeout>|undefined,current:AbortController|undefined;
  setFeed(undefined);setError('');
  async function load(){
   if(stopped||busy||document.hidden)return;
   if(timer)clearTimeout(timer);busy=true;setLoading(true);current=new AbortController();
   const timeout=setTimeout(()=>current?.abort(),45000);let delay=60000;
   try{
    const r=await fetch('/api/international-live?league='+league,{signal:current.signal,cache:'no-store'});
    const body=await r.json();
    if(stopped)return;
    if(body.league!==league||!Array.isArray(body.games))throw new Error(r.status===401?'請重新登入網站。':r.status===429?'請稍後再更新。':'資料暫時無法取得。');
    setFeed(body);setError('');delay=Math.min(300000,Math.max(60000,Number(body.pollAfterMs)||60000));
   }catch(e){if(!stopped)setError(e instanceof Error&&e.name==='AbortError'?'來源回應較慢，將自動重試。':e instanceof Error?e.message:'資料暫時無法取得。');}
   finally{clearTimeout(timeout);busy=false;if(!stopped){setLoading(false);timer=setTimeout(()=>void load(),delay);}}
  }
  const resume=()=>{if(!document.hidden)void load();};
  document.addEventListener('visibilitychange',resume);void load();
  return()=>{stopped=true;if(timer)clearTimeout(timer);current?.abort();document.removeEventListener('visibilitychange',resume)};
 },[league,revision,retry]);
 const data=feed?.league===league?feed:undefined;
 const rank=(g:Game)=>old(g,clock)||data?.stale?4:g.status==='live'?0:g.status==='final'?1:g.status==='pregame'?2:3;
 const games=[...(data?.games||[])].sort((a,b)=>rank(a)-rank(b)||(a.startTime||'').localeCompare(b.startTime||''));
 return <section className="space-y-4" aria-label={`${league} 當日比分`}>
  <div className="panel flex flex-wrap items-center justify-between gap-3 p-5"><div><h3 className="text-lg font-bold">今日賽況{data?.date?' · '+data.date:''}</h3><p className="mt-1 text-sm text-slate-300">台灣時間 · 開啟此頁時自動更新</p></div><Button variant="outline" disabled={loading} onClick={()=>setRetry(v=>v+1)}>{loading?'讀取來源中…':'更新今日賽況'}</Button></div>
  {(error||data?.error)&&<p role="status" className="text-sm text-amber-200">{error||data?.error}</p>}
  {data?.persistence?.error&&<p className="text-sm text-amber-200">{data.persistence.error}</p>}
  {!games.length&&<div className="panel p-5 text-slate-300">{loading?'正在取得今日比賽…':'尚未取得已核對的今日賽事；不代表今天沒有比賽。'}</div>}
  <div className="grid min-w-0 gap-4 xl:grid-cols-2">{games.map(g=>{
   const stale=!!data?.stale||old(g,clock),numbers=[...new Set([...g.innings.away,...g.innings.home].map(x=>x.inning))].sort((a,b)=>a-b);
   return <article key={g.key} className="panel min-w-0 space-y-4 border-2 p-5">
    <div className="flex flex-wrap justify-between gap-2 text-sm"><strong className={stale?'text-amber-200':g.status==='live'?'text-green-300':'text-yellow-300'}>{stale?'資料已過期':labels[g.status]||'狀態待確認'}{!stale&&g.status==='live'&&g.inning!==null?` · ${g.inning}局${g.half==='top'?'上':g.half==='bottom'?'下':''}`:''}</strong><span>{stamp(g.startTime)}</span></div>
    {(['away','home'] as const).map(side=><div key={side} className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-lg font-bold break-words">{g[side].name}<span className="ml-2 text-xs text-slate-300">{side==='home'?'主':'客'}</span></p><p className="mt-1 text-sm text-slate-300">預告先發：{g.starters[side]?.name||'未提供'}</p></div><strong className="shrink-0 text-3xl tabular-nums">{g.status==='pregame'?'—':g[side].score??'—'}</strong></div>)}
    {!!numbers.length&&<div className="max-w-full overflow-x-auto"><table className="w-full text-center text-sm"><caption className="sr-only">逐局比分</caption><thead><tr><th className="whitespace-nowrap p-2">球隊</th>{numbers.map(n=><th key={n} className="p-2">{n}</th>)}<th>得分</th><th>安打</th><th>失誤</th></tr></thead><tbody>{(['away','home'] as const).map(side=><tr key={side}><th className="whitespace-nowrap p-2 text-left">{g[side].name}</th>{numbers.map(n=><td key={n}>{g.innings[side].find(x=>x.inning===n)?.runs??'—'}</td>)}<td>{g[side].score??'—'}</td><td>{g[side].hits??'—'}</td><td>{g[side].errors??'—'}</td></tr>)}</tbody></table></div>}
    {!stale&&g.status==='live'&&<div className="flex flex-wrap gap-x-4 gap-y-2 text-sm"><span>壞球 {g.balls??'—'}</span><span>好球 {g.strikes??'—'}</span><span>出局 {g.outs??'—'}</span><span>壘包：{g.bases?g.bases.map((v,i)=>`${i+1}壘${v===null?'未知':v?'有人':'無人'}`).join('／'):'未提供'}</span></div>}
    {(g.lineups.away.length+g.lineups.home.length>0||g.pitching.away.length+g.pitching.home.length>0)&&<details className="text-sm"><summary className="cursor-pointer font-bold text-yellow-300">打序與投手用球</summary><p className="mt-2 text-slate-300">來源列出名單；不代表已獲官方確認。</p><div className="mt-3 grid min-w-0 gap-4 sm:grid-cols-2">{(['away','home'] as const).map(side=><div key={side} className="min-w-0"><h4 className="font-bold">{g[side].name}</h4>{g.lineups[side].map((p,i)=><p key={i} className="mt-1 break-words">{p.order??'—'}　{p.name||'未提供'}　{p.position||''}</p>)}{g.pitching[side].map((p,i)=><p key={'p'+i} className="mt-2 break-words">{p.name||'投手'}：用球 {p.pitchCount??'未提供'}</p>)}</div>)}</div></details>}
    <p className="break-words text-xs text-slate-300">來源：{g.source.provider} · 擷取 {stamp(g.source.fetchedAt)}{stale?'（非最新場況）':''}</p>
   </article>;
  })}</div>
  <p className="text-xs text-slate-400">場中約每 60 秒、賽前約每 5 分鐘檢查來源。來源發布時間與逐球延遲尚未驗證。</p>
 </section>;
}
