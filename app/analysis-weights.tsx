'use client';

import {useState} from 'react';
import {RotateCcw, SlidersHorizontal} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger} from '@/components/ui/dialog';
import {ANALYSIS_STORAGE_KEY, DEFAULT_ANALYSIS_WEIGHTS, WEIGHT_FACTORS, analyzeTeams, normalizeAnalysisWeights, readStoredAnalysisWeights, type AnalysisStandings, type AnalysisWeights, type WeightFactor} from '@/lib/analysis-weights';
import type {RunSnapshot} from '@/lib/markets';
import TeamName from './team-name';
import {useSource} from './use-source';

const LABELS: Record<WeightFactor, {title: string; description: string}> = {
  scoring: {title: '本季得分', description: '平均每場得分，越高表現越好'},
  defense: {title: '本季失分', description: '平均每場失分，越低表現越好'},
  record: {title: '本季戰績', description: '例行賽勝率，越高表現越好'},
};
const toDraft = (weights: AnalysisWeights) => ({scoring: String(weights.scoring), defense: String(weights.defense), record: String(weights.record)});

export default function AnalysisWeightsSettings() {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState({...DEFAULT_ANALYSIS_WEIGHTS});
  const [draft, setDraft] = useState(toDraft(DEFAULT_ANALYSIS_WEIGHTS));
  const [message, setMessage] = useState('');
  const weights = Object.fromEntries(WEIGHT_FACTORS.map(key => [key, draft[key].trim() === '' ? NaN : Number(draft[key])])) as AnalysisWeights;
  const normalized = normalizeAnalysisWeights(weights);
  function changeOpen(next: boolean) {
    if (next) {
      let current = saved;
      setMessage('');
      try {
        current = readStoredAnalysisWeights(window.localStorage.getItem(ANALYSIS_STORAGE_KEY)) ?? saved;
        setSaved(current);
      } catch { setMessage('瀏覽器暫時無法讀取設定，目前使用本次設定。'); }
      setDraft(toDraft(current));
    }
    setOpen(next);
  }
  function changeWeight(key: WeightFactor, value: string) {
    setDraft(current => ({...current, [key]: value}));
    setMessage('');
  }
  function save() {
    if (!normalized) return;
    setSaved({...weights});
    try {
      window.localStorage.setItem(ANALYSIS_STORAGE_KEY, JSON.stringify({version: 1, weights}));
      setMessage('設定已保存，下次使用此瀏覽器時會自動套用。');
    } catch { setMessage('已套用本次設定；瀏覽器無法保存，重新整理後可能需要重新設定。'); }
  }
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button variant="outline" className="analysis-weights-trigger"><SlidersHorizontal className="size-4"/>分析權重</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto border-slate-700 bg-[#0e1a29] text-slate-100 sm:max-w-2xl">
      <DialogHeader><DialogTitle>分析權重</DialogTitle><DialogDescription className="text-slate-400">自行調整球隊本季表現的資料比重，並查看即時比較結果。</DialogDescription></DialogHeader>
      <form onSubmit={event => {event.preventDefault(); save();}} className="space-y-5">
        <div className="space-y-4">{WEIGHT_FACTORS.map(key => <div key={key} className="rounded-lg border border-slate-700/70 p-3">
          <div className="flex items-center justify-between gap-3"><label htmlFor={`weight-${key}`} className="font-bold">{LABELS[key].title}</label><div className="flex items-center gap-2"><Input id={`weight-${key}`} type="number" min={0} max={100} step={1} required value={draft[key]} onChange={event => changeWeight(key, event.target.value)} className="w-20 text-right"/><span className="text-sm text-slate-400">權重</span></div></div>
          <input type="range" min={0} max={100} step={1} value={Number.isFinite(weights[key]) ? Math.max(0, Math.min(100, weights[key])) : 0} onChange={event => changeWeight(key, event.target.value)} aria-label={`${LABELS[key].title}權重滑桿`} className="my-3 block w-full accent-[#ffd538]"/>
          <div className="flex flex-wrap justify-between gap-1 text-xs text-slate-400"><span>{LABELS[key].description}</span><span className="text-[#ffd538]">實際占比 {normalized ? `${normalized[key].toFixed(1)}%` : '—'}</span></div>
        </div>)}</div>
        <p className="text-xs leading-relaxed text-slate-400">各項可設為 0～100，系統會依比例換算成 100%。設為 0 表示不採用該項；調整時，下方比較結果會立即更新。</p>
        {!normalized && <p role="alert" className="text-sm text-amber-200">請填入 0～100 的權重，且至少一項大於 0。</p>}
        <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={() => {setDraft(toDraft(DEFAULT_ANALYSIS_WEIGHTS)); setMessage('已還原預設，按「保存設定」即可保存。');}}><RotateCcw className="size-4"/>還原預設</Button><Button type="submit" disabled={!normalized} className="bg-[#ffd538] font-bold text-[#06101b] hover:bg-[#ffe36f]">保存設定</Button></div>
        <p role="status" aria-live="polite" className="min-h-5 text-sm text-emerald-300">{message}</p>
      </form>
      {open && <TeamAnalysisPreview weights={normalized}/>}
    </DialogContent>
  </Dialog>;
}

function TeamAnalysisPreview({weights}: {weights: AnalysisWeights | null}) {
  const runs = useSource<RunSnapshot>('runs', 20 * 60000);
  const standings = useSource<AnalysisStandings>('standings', 5 * 60000);
  const rows = analyzeTeams(runs.data, standings.data, weights);
  const season = runs.data?.year ?? standings.data?.season;
  const mismatch = runs.data && standings.data && runs.data.year !== standings.data.season;
  return <section className="space-y-3 border-t border-slate-700 pt-4" aria-label="球隊本季表現比較">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold">{season ? `${season} ` : ''}球隊表現比較</h3><Button variant="ghost" size="sm" disabled={runs.loading || standings.loading} onClick={() => {void runs.refresh(); void standings.refresh();}}>{runs.loading || standings.loading ? '資料更新中…' : '更新資料'}</Button></div>
    <p className="text-xs leading-relaxed text-slate-400">綜合分數為各項聯盟相對排名的加權結果，範圍 0～100 分，用於比較球隊表現，不代表單場勝率。缺少採用項目的資料時顯示「—」。</p>
    {(runs.error || standings.error || mismatch) && <p role="status" className="text-xs text-amber-200">{mismatch ? '資料球季不一致，暫不採用戰績。' : `部分資料更新失敗${runs.data || standings.data ? '，目前顯示最後取得的資料' : '，請稍後重試'}。`}</p>}
    {!weights ? <p className="text-sm text-slate-400">請先設定有效權重。</p> : rows.length ? <div className="max-h-64 overflow-auto rounded-lg border border-slate-700"><table className="w-full whitespace-nowrap text-left text-sm">
      <caption className="sr-only">依目前分析權重計算的球隊比較</caption><thead className="sticky top-0 bg-[#152235] text-xs text-slate-300"><tr><th className="px-3 py-2">球隊</th><th className="px-3 py-2 text-right">場均得分</th><th className="px-3 py-2 text-right">場均失分</th><th className="px-3 py-2 text-right">勝－敗</th><th className="px-3 py-2 text-right">綜合分數</th></tr></thead>
      <tbody>{rows.map(row => <tr key={row.id} className="border-t border-slate-700/70"><th scope="row" className="px-3 py-2 font-medium"><TeamName team={row} size={20}/></th><td className="px-3 py-2 text-right tabular-nums">{row.scoring?.toFixed(2) ?? '—'}</td><td className="px-3 py-2 text-right tabular-nums">{row.defense?.toFixed(2) ?? '—'}</td><td className="px-3 py-2 text-right tabular-nums">{row.wins !== null && row.losses !== null ? `${row.wins}－${row.losses}` : '—'}</td><td className="px-3 py-2 text-right font-bold tabular-nums text-[#ffd538]">{row.score?.toFixed(1) ?? '—'}</td></tr>)}</tbody>
    </table></div> : <p role="status" className="text-sm text-slate-400">{runs.loading || standings.loading ? '正在取得球隊資料…' : '目前沒有可比較的球隊資料。'}</p>}
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">{[['得失分', runs.data?.fetchedAt], ['戰績', standings.data?.fetchedAt]].map(([label, stamp]) => stamp && <span key={label}>{label}更新：{new Date(stamp).toLocaleString('zh-TW', {timeZone: 'Asia/Taipei', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'})}（台灣）</span>)}</div>
  </section>;
}
