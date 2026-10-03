'use client';
import {useEffect,useRef,useState} from 'react';
import {nbaDay,validNbaDay,type NbaGame} from '@/lib/nba';
import type {NbaReport} from '@/lib/nba-analysis';
import {nbaRequest} from '../nba-request';
import BasketballPlayerDetails from './basketball-player-details';

export default function BasketballDiagnostics(){
 const [league,setLeague]=useState<'NBA'|'WNBA'>('NBA'),[day,setDay]=useState(nbaDay);
 const [games,setGames]=useState<NbaGame[]>([]),[id,setId]=useState(''),[report,setReport]=useState<NbaReport|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[loaded,setLoaded]=useState(false);
 const controller=useRef<AbortController|null>(null);
 function reset(){controller.current?.abort();setGames([]);setId('');setReport(null);setError('');setBusy(false);setLoaded(false);}
 useEffect(()=>()=>controller.current?.abort(),[]);
 async function inspect(kind:'schedule'|'analysis'){
  controller.current?.abort();const current=new AbortController();controller.current=current;setBusy(true);setError('');setReport(null);
  if(kind==='schedule'){setGames([]);setId('');setLoaded(false);}
  try{
   const q=new URLSearchParams({league,date:day,kind});if(kind==='analysis')q.set('game',id);
   const data=await nbaRequest(`/api/admin/basketball?${q}`,current.signal);if(current.signal.aborted)return;
   if(kind==='schedule'){
    const rows=(data.games as NbaGame[]).filter(g=>g.state==='scheduled'&&g.timeConfirmed&&Date.parse(g.start)>Date.now());
    setGames(rows);setId(rows[0]?.id||'');setLoaded(true);
   }else setReport(data);
  }catch(e){if(!current.signal.aborted)setError(e instanceof Error?e.message:'籃球資料讀取失敗');}
  finally{if(!current.signal.aborted)setBusy(false);}
 }
 const a=report?.analysis;
 return <section className="panel p-5" id="basketball-player-analysis">
  <h2 className="text-lg font-bold">籃球輪替與球員數據</h2>
  <div className="mt-4 flex flex-wrap items-end gap-3">
   <label className="grid gap-1 text-sm">聯盟<select className="rounded border border-white/20 bg-slate-900 px-2 py-2" value={league} onChange={e=>{reset();setLeague(e.target.value as 'NBA'|'WNBA');}}><option value="NBA">NBA</option><option value="WNBA">WNBA</option></select></label>
   <label className="grid gap-1 text-sm">比賽日期<input type="date" className="rounded border border-white/20 bg-slate-900 px-2 py-2" value={day} onChange={e=>{if(validNbaDay(e.target.value)){reset();setDay(e.target.value);}}}/></label>
   <button type="button" className="header-action" disabled={busy} onClick={()=>void inspect('schedule')}>查詢賽事</button>
  </div>
  {!!games.length&&<div className="mt-3 flex flex-wrap items-end gap-3">
   <label className="grid min-w-0 max-w-full gap-1 text-sm">賽事<select className="max-w-full rounded border border-white/20 bg-slate-900 px-2 py-2" value={id} onChange={e=>{controller.current?.abort();setBusy(false);setError('');setReport(null);setId(e.target.value);}}>{games.map(g=><option key={g.id} value={g.id}>{g.away.name} vs {g.home.name}</option>)}</select></label>
   <button type="button" className="header-action" disabled={busy||!id} onClick={()=>void inspect('analysis')}>查看輪替與球員</button>
  </div>}
  {busy&&<p className="mt-3 text-sm" role="status">讀取中…</p>}
  {error&&<p className="mt-3 text-sm text-red-300" role="alert">{error}</p>}
  {loaded&&!games.length&&!busy&&<p className="mt-3 text-sm text-slate-400">當日沒有可查詢的賽前賽事。</p>}
  {a&&report?.game&&<div className="mt-4"><h3 className="font-bold">{report.game.away.name} vs {report.game.home.name}</h3><BasketballPlayerDetails game={report.game} analysis={a}/></div>}
 </section>;
}
