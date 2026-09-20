'use client';
import {Button} from '@/components/ui/button';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
import type {SourceTable} from '@/lib/international';
import {kboRecord} from '@/lib/kbo-teams';
import InternationalTeamLogo from './international-team-logo';

type Data={tables?:SourceTable[];error?:string;fetchedAt?:string;status?:string};
export default function KboStandings({data,year,loading,onRefresh,onTeamSelect}:{data?:Data;year:number;loading:boolean;onRefresh:()=>void;onTeamSelect:(name:string)=>void}){
 const tables=data?.tables||[],count=tables.reduce((n,t)=>n+t.rows.length,0);
 return <section className="panel standings-panel kbo-standings-panel" aria-label="KBO 球隊戰績排名">
  <div className="standings-heading"><h2>戰績排名</h2><div className="flex flex-wrap items-center gap-2"><span className="cpbl-standings-scope">全部 {count||10} 隊</span><Button variant="ghost" onClick={onRefresh} disabled={loading}>{loading?'更新中…':'更新戰績'}</Button></div></div>
  <div className="standings-meta"><span>{year} 例行賽 · 勝差與第一名比較</span><span>近 10 場：勝／和／敗合計</span></div>
  {(data?.error||data?.status==='stale')&&<p role="status" className="px-5 py-2 text-sm text-amber-200">{data.error||'來源更新失敗'}{count?'，目前顯示上次取得的戰績。':''}</p>}
  {!count&&<p role="status" className="p-5 text-slate-400">{loading?'正在取得 KBO 戰績…':'戰績暫時無法取得'}</p>}
  {tables.map(t=><div key={t.title}><Table className="standings-table"><TableHeader><TableRow><TableHead>排名</TableHead><TableHead>球隊</TableHead><TableHead>勝－敗－和</TableHead><TableHead className="text-right">勝率</TableHead><TableHead className="text-right">勝差</TableHead><TableHead>連勝／敗</TableHead><TableHead>近 10 場</TableHead></TableRow></TableHeader><TableBody>{t.rows.map(row=>{
   const value=(h:string)=>row[t.headers.indexOf(h)]||'—';
   const name=value('球隊'),rank=value('排名'),rate=Number(value('勝率')),streak=kboRecord(value('連勝敗')),recent=kboRecord(value('近十場')).match(/^(\d+)勝(\d+)和(\d+)敗$/);
   return <TableRow key={name}><TableCell><span className={`rank-chip ${rank==='1'?'rank-first':''}`}>{rank}</span></TableCell><TableCell><button type="button" className="cpbl-standings-team" onClick={()=>onTeamSelect(name)}><InternationalTeamLogo league="KBO" name={name} size={36}/><span>{name}</span></button></TableCell><TableCell><div className="record-line"><span className="text-emerald-300">{value('勝')}</span>－<span className="text-rose-300">{value('敗')}</span>－<span className="text-slate-300">{value('和')}</span></div><div className="win-track" aria-hidden="true"><span style={{width:`${Number.isFinite(rate)?Math.min(1,Math.max(0,rate))*100:0}%`}}/></div></TableCell><TableCell className="text-right font-bold tabular-nums">{value('勝率')}</TableCell><TableCell className="text-right tabular-nums">{value('勝差')}</TableCell><TableCell><span className={streak.includes('勝')?'text-emerald-300':streak.includes('敗')?'text-rose-300':'text-slate-300'}>{streak.replace(/^(\d+)(勝|敗)$/,'$1 連$2')}</span></TableCell><TableCell>{recent?<div className="recent-results kbo-recent-results" aria-label={`近十場 ${recent[1]} 勝 ${recent[2]} 和 ${recent[3]} 敗`}><span className="result-win">{recent[1]} 勝</span><span>{recent[2]} 和</span><span className="result-loss">{recent[3]} 敗</span></div>:kboRecord(value('近十場'))}</TableCell></TableRow>;
  })}</TableBody></Table><details className="npb-season-details"><summary>完整球季數據 · 出賽、主客場戰績</summary><Table className="standings-table"><TableHeader><TableRow>{t.headers.map(h=><TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{t.rows.map((row,i)=><TableRow key={i}>{row.map((v,j)=><TableCell key={j} className="whitespace-nowrap">{kboRecord(v)||'—'}</TableCell>)}</TableRow>)}</TableBody></Table></details></div>)}
  <div className="standings-meta"><span>{data?.fetchedAt?`更新：${new Date(data.fetchedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}（台灣）`:'等待同步'}</span><span>KBO 官方戰績</span></div>
 </section>;
}
