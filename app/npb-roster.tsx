'use client';
import type {SourceTable} from '@/lib/international';
import InternationalTeamLogo from './international-team-logo';

export default function NpbRoster({data,loading}:{data?:{tables?:SourceTable[];fetchedAt?:string;error?:string;status?:string};loading:boolean}){
 const changes=(data?.tables||[]).flatMap(t=>t.rows.map(row=>{
  const value=(h:string)=>row[t.headers.indexOf(h)]||'—';
  return {date:value('公告日期'),team:value('球隊'),name:value('球員'),position:value('守位'),number:value('背號'),action:value('異動')};
 }));
 return <section className="panel npb-roster-panel" aria-label="NPB 登錄異動"><div className="standings-heading"><h2>登錄異動</h2><span className="text-sm text-slate-400">NPB 官方公告 · {changes.length} 筆</span></div>
  {data?.error&&<p role="status" className="px-5 pb-3 text-sm text-amber-200">{data.error}</p>}
  {changes.length?<div className="npb-roster-grid">{changes.map((r,i)=><article key={`${r.team}-${r.name}-${i}`} className="npb-roster-item"><InternationalTeamLogo league="NPB" name={r.team} size={40}/><div><p className="npb-roster-team">{r.team}</p><h3>{r.name}<small>#{r.number} · {r.position}</small></h3><time>{r.date}</time></div><span className={`npb-roster-badge ${r.action==='登錄'?'registered':'removed'}`}>{r.action}</span></article>)}</div>:<p role="status" className="p-5 text-slate-400">{loading?'正在取得官方登錄異動…':'目前未取得登錄異動。'}</p>}
  <div className="standings-meta"><span>取消登錄不等於受傷，也不代表當日先發打線。</span><span>{data?.fetchedAt?`擷取 ${new Date(data.fetchedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}`:'等待同步'}</span></div>
 </section>;
}
