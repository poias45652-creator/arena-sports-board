'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Table,TableHeader,TableBody,TableRow,TableHead,TableCell} from '@/components/ui/table';
import {Select,SelectTrigger,SelectValue,SelectContent,SelectItem} from '@/components/ui/select';
import type {SourceTable} from '@/lib/international';
import InternationalTeamLogo from './international-team-logo';

type Data={tables?:SourceTable[];error?:string;fetchedAt?:string;status?:string};
export default function NpbStandings({data,year,loading,onRefresh,onTeamSelect}:{data?:Data;year:number;loading:boolean;onRefresh:()=>void;onTeamSelect:(name:string)=>void}){
 const [scope,setScope]=useState('all');
 const tables=(data?.tables||[]).filter(t=>scope==='all'||t.title===scope);
 return <section className="panel standings-panel npb-standings-panel" aria-label="NPB 球隊戰績排名">
  <div className="standings-heading"><h2>戰績排名</h2><div className="flex flex-wrap items-center gap-2"><Select value={scope} onValueChange={setScope}><SelectTrigger aria-label="日職戰績排名範圍"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">全部 12 隊</SelectItem><SelectItem value="中央聯盟">中央聯盟</SelectItem><SelectItem value="太平洋聯盟">太平洋聯盟</SelectItem></SelectContent></Select><Button variant="ghost" onClick={onRefresh} disabled={loading}>{loading?'更新中…':'更新戰績'}</Button></div></div>
  <div className="standings-meta"><span>{year} 例行賽 · 各聯盟排名</span><span>勝差依來源，與前一名比較</span></div>
  {(data?.error||data?.status==='stale')&&<p role="status" className="px-5 py-2 text-sm text-amber-200">{data.error||'來源更新失敗'}{tables.length?'，目前顯示上次取得的戰績。':''}</p>}
  {!tables.length&&<p role="status" className="p-5 text-slate-400">{loading?'正在取得 NPB 戰績…':'戰績暫時無法取得'}</p>}
  {tables.map(t=><section key={t.title} aria-label={t.title}>
   <h3 className="npb-division-title">{t.title}<span>{t.rows.length} 隊</span></h3>
   <Table className="standings-table"><TableHeader><TableRow><TableHead>排名</TableHead><TableHead>球隊</TableHead><TableHead>勝－敗－和</TableHead><TableHead className="text-right">勝率</TableHead><TableHead className="text-right">與前一名勝差 / M</TableHead><TableHead>連勝／敗</TableHead><TableHead>近 5 場</TableHead></TableRow></TableHeader><TableBody>{t.rows.map((row,i)=>{
    const value=(h:string)=>row[t.headers.indexOf(h)]||'—';
    const name=value('球隊'),rate=Number(value('勝率')),rank=value('排名');
    return <TableRow key={name}><TableCell><span className={`rank-chip ${i===0?'rank-first':''}`} title={rank==='優勝'?'聯盟冠軍':undefined}>{rank==='優勝'?'冠':rank}</span></TableCell><TableCell><button type="button" className="cpbl-standings-team" onClick={()=>onTeamSelect(name)}><InternationalTeamLogo league="NPB" name={name} size={32}/><span>{name}</span></button></TableCell><TableCell><div className="record-line"><span className="text-emerald-300">{value('勝')}</span>－<span className="text-rose-300">{value('敗')}</span>－<span className="text-slate-300">{value('和')}</span></div><div className="win-track" aria-hidden="true"><span style={{width:`${Number.isFinite(rate)?Math.min(1,Math.max(0,rate))*100:0}%`}}/></div></TableCell><TableCell className="text-right font-bold tabular-nums">{value('勝率')}</TableCell><TableCell className="text-right tabular-nums">{value('與前一名勝差／魔術數字')}</TableCell><TableCell><span className="text-slate-400" aria-label="連勝敗尚未提供">—</span></TableCell><TableCell><span className="text-slate-400" aria-label="近五場尚未提供">—</span></TableCell></TableRow>;
   })}</TableBody></Table>
   <details className="npb-season-details"><summary>完整球季數據</summary><Table className="standings-table"><TableHeader><TableRow>{t.headers.map(h=><TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}</TableRow></TableHeader><TableBody>{t.rows.map((row,i)=><TableRow key={i}>{row.map((cell,j)=><TableCell key={j} className="whitespace-nowrap">{cell||'—'}</TableCell>)}</TableRow>)}</TableBody></Table></details>
  </section>)}
  <div className="standings-meta"><span>{data?.fetchedAt?`更新：${new Date(data.fetchedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}（台灣）`:'等待同步'}</span><span>M 為魔術數字 · 連勝／敗與近 5 場尚未提供</span></div>
 </section>;
}
