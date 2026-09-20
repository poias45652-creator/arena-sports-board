'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
import type {SourceTable} from '@/lib/international';
import {cpblLogos} from '@/lib/cpbl-logos';
import {profileTeams} from '@/lib/international-profile';

type Data={tables?:SourceTable[];error?:string;fetchedAt?:string;status?:string};
type Props={data?:Data;year:number;loading:boolean;onRefresh:()=>void;onTeamSelect:(name:string)=>void};

export default function CpblStandings({data,year,loading,onRefresh,onTeamSelect}:Props){
 const [formGames,setFormGames]=useState<any[]>([]),[formStatus,setFormStatus]=useState<'loading'|'ready'|'error'>('loading');
 useEffect(()=>{const c=new AbortController();setFormStatus('loading');fetch('/api/international-team?league=CPBL&team=ACN&action=games',{cache:'no-store',signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok||!Array.isArray(d.games))throw Error();setFormGames(d.games.filter((g:any)=>g.completed&&Number.isFinite(g.homeScore)&&Number.isFinite(g.awayScore)));setFormStatus('ready');}).catch(e=>{if(e.name!=='AbortError')setFormStatus('error')});return()=>c.abort()},[year]);
 const teamNames=Object.values(profileTeams.CPBL);
 const form=(name:string)=>{const id=teamNames.indexOf(name)+1;if(!id)return {streak:'—',recent:[] as string[]};const results=formGames.filter(g=>g.homeId===id||g.awayId===id).sort((a,b)=>a.start.localeCompare(b.start)||a.id-b.id).map(g=>{if(g.homeScore===g.awayScore)return '和';const won=g.homeId===id?g.homeScore>g.awayScore:g.awayScore>g.homeScore;return won?'勝':'敗'});const last=results.at(-1),count=last?results.slice().reverse().findIndex(x=>x!==last):-1;return {streak:last?`${count<0?results.length:count}${last}`:'—',recent:results.slice(-5)};};
 const table=data?.tables?.find(t=>['排名','球隊','勝','敗','和','勝率','勝差'].every(h=>t.headers.includes(h)));
 const rows=(table?.rows||[]).map(row=>{
  const value=(name:string)=>row[table!.headers.indexOf(name)];
  const rate=value('勝率'),pct=rate&&Number.isFinite(Number(rate))?Number(rate):null;
  return {rank:value('排名'),name:value('球隊'),wins:value('勝'),losses:value('敗'),ties:value('和'),games:value('出賽'),rate,pct,back:value('勝差')};
 });
 return <section className="panel standings-panel cpbl-standings-panel" aria-label="CPBL 球隊戰績排名">
  <div className="standings-heading"><h2>戰績排名</h2><div className="flex flex-wrap items-center gap-2"><span className="cpbl-standings-scope">全年 · 全部 6 隊</span><Button variant="ghost" onClick={onRefresh} disabled={loading}>{loading?'更新中…':'更新戰績'}</Button></div></div>
  <div className="standings-meta"><span>{year} 例行賽 · 全年戰績 · 勝差與第一名比較</span><span>近 5 場由左至右：舊 → 新</span></div>
  {data?.error&&<p role="status" className="px-5 py-2 text-sm text-amber-200">{data.error}{rows.length?'，目前顯示上次取得的戰績。':''}</p>}
  {!rows.length?<p role="status" className="p-5 text-slate-400">{loading?'正在取得 CPBL 戰績…':'戰績暫時無法取得'}</p>:<Table className="standings-table">
   <TableHeader><TableRow><TableHead>排名</TableHead><TableHead>球隊</TableHead><TableHead>勝－敗－和</TableHead><TableHead className="text-right">勝率</TableHead><TableHead className="text-right">勝差</TableHead><TableHead>連勝／敗</TableHead><TableHead>近 5 場</TableHead></TableRow></TableHeader>
   <TableBody>{rows.map(r=>{const current=form(r.name);return <TableRow key={r.name}>
    <TableCell><span className={`rank-chip ${r.rank==='1'?'rank-first':''}`}>{r.rank}</span></TableCell>
    <TableCell><button type="button" className="cpbl-standings-team" onClick={()=>onTeamSelect(r.name)}>{cpblLogos[r.name]&&<img src={`/team-logos/cpbl-${cpblLogos[r.name]}.png`} alt="" width={32} height={32} className="size-8 shrink-0 object-contain"/>}<span>{r.name}</span></button></TableCell>
    <TableCell><div className="record-line" aria-label={`${r.wins} 勝 ${r.losses} 敗 ${r.ties} 和，共 ${r.games} 場`}><span className="text-emerald-300">{r.wins}</span>－<span className="text-rose-300">{r.losses}</span>－<span className="text-slate-300">{r.ties}</span></div><div className="win-track" aria-hidden="true"><span style={{width:`${Math.max(0,Math.min(1,r.pct??0))*100}%`}}/></div></TableCell>
    <TableCell className="text-right font-bold tabular-nums">{r.rate||'—'}</TableCell>
    <TableCell className="text-right tabular-nums">{r.rank==='1'?'—':r.back||'—'}</TableCell>
    <TableCell><span className={current.streak.endsWith('勝')?'text-emerald-300':current.streak.endsWith('敗')?'text-rose-300':'text-slate-300'}>{current.streak}</span></TableCell>
    <TableCell><div className="flex gap-1" aria-label={`近五場 ${current.recent.join('、')||'尚未取得'}`}>{current.recent.length?current.recent.map((result,i)=><span key={i} className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-bold ${result==='勝'?'bg-emerald-500/20 text-emerald-300':result==='敗'?'bg-rose-500/20 text-rose-300':'bg-slate-500/20 text-slate-300'}`}>{result}</span>):<span className="text-slate-400">—</span>}</div></TableCell>
   </TableRow>})}</TableBody>
  </Table>}
  <div className="standings-meta"><span>{data?.fetchedAt?`更新：${new Date(data.fetchedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}（台灣）`:'等待同步'}</span><span>{formStatus==='loading'?'正在计算连续胜负与近 5 场…':formStatus==='error'?'连续胜负与近 5 场暂时无法取得':'连续胜负与近 5 场依已完赛赛果计算'}</span></div>
 </section>;
}
