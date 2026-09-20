'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import type {SourceTable} from '@/lib/international';
import {scheduledKboGames} from '@/lib/international-fixtures';
import {taipeiDay} from '@/lib/baseball';
import InternationalTeamLogo from './international-team-logo';

export default function KboSchedule({data,loading}:{data?:{tables?:SourceTable[];error?:string;fetchedAt?:string;status?:string};loading:boolean}){
 const [date,setDate]=useState(()=>taipeiDay());
 const all=scheduledKboGames(data?.tables),games=all.filter(g=>!date||g.start.startsWith(date));
 return <details className="panel kbo-schedule-archive"><summary>官方本月賽程與比分<span>{all.length?`${all.length} 場 · 展開查看`:'展開查看'}</span></summary><div className="kbo-schedule-content"><div className="flex flex-wrap items-center gap-3"><label htmlFor="kbo-schedule-date">台灣日期</label><Input id="kbo-schedule-date" className="w-44" type="date" value={date} onChange={e=>setDate(e.target.value)}/><Button variant="outline" onClick={()=>setDate('')}>整月賽程</Button></div>
  {(data?.error||data?.status==='stale')&&<p role="status" className="text-sm text-amber-200">{data.error||'來源更新失敗，顯示上次取得的賽程。'}</p>}
  <div className="kbo-schedule-grid">{games.map(g=>{const scores=g.score.match(/^(\d+)\s*[:：]\s*(\d+)$/);return <article className="kbo-schedule-game" key={g.id}><div className="kbo-schedule-meta"><time>{g.start.slice(0,16)}</time><span>{g.note||g.type}</span></div>{(['away','home'] as const).map((side,i)=><div className="kbo-schedule-team" key={side}><InternationalTeamLogo league="KBO" name={g[side]} size={32}/><b>{g[side]}</b><small>{side==='away'?'客':'主'}</small><strong>{scores?.[i+1]??'—'}</strong></div>)}<p>{g.venue||'球場尚未提供'}</p></article>})}</div>
  {!games.length&&<p role="status" className="py-5 text-sm text-slate-400">{loading?'正在取得官方賽程…':all.length?'此日期沒有已列出的賽程，可切換日期或查看整月賽程。':'官方賽程暫時無法取得。'}</p>}
  <p className="text-xs text-slate-400">KBO 官方月賽程 · 台灣時間 · 非逐球即時比分{data?.fetchedAt?` · 擷取 ${new Date(data.fetchedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}`:''}</p>
 </div></details>;
}
