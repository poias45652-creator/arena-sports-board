"use client";
import { useEffect, useState } from 'react';
import OperationsPanel from '../operations-panel';
import SettlementCalculator from '../settlement-calculator';
import MatchComparison from './match-comparison';
import { Database, Gauge, KeyRound, RefreshCw, Users } from 'lucide-react';

export default function AdminTools() {
  const [evaluation, setEvaluation] = useState<any>(null);
  useEffect(() => {
    const controller = new AbortController();
    let running = false;
    async function update() {
      if (running || controller.signal.aborted) return;
      running = true;
      try {
        const response = await fetch('/api/analysis/results', { method: 'POST', cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45000)]) });
        if (!response.ok) throw new Error();
        const value = await response.json();
        if (!controller.signal.aborted) setEvaluation(value);
      } catch {
        if (!controller.signal.aborted) setEvaluation({ error: '驗證紀錄暫時無法取得，稍後重試。' });
      } finally { running = false; }
    }
    void update();
    const timer = setInterval(update, 600000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  return <div className="space-y-4"><ProviderStatus/><MatchComparison/><OperationsPanel evaluation={evaluation}/><SettlementCalculator/></div>;
}

function ProviderStatus(){
 const [rows,setRows]=useState<any[]>([]),[busy,setBusy]=useState(false);
 async function check(){setBusy(true);try{const kinds=['npb-bat','kbo-bat','npb-schedule'];const values=await Promise.all(kinds.map(async kind=>{try{const r=await fetch('/api/international?kind='+kind);if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();}catch{return {kind,status:'unavailable',error:'網站連線失敗'};}}));setRows(values);}finally{setBusy(false);}}
 return <section className="panel admin-section"><div className="preview-section-title"><div><Database/><div><h2>棒球外部資料來源</h2><p>實際檢查日韓職球員表與日職賽事；資料源設有快取</p></div></div><button className="admin-refresh" type="button" disabled={busy} onClick={check}><RefreshCw/>{busy?'檢查中…':'檢查連線'}</button></div><div className="space-y-3 p-4">{rows.map(r=><p key={r.kind} className="text-sm">{r.kind}：{r.status==='ready'?'已取得 '+(r.tables?.reduce((n:number,t:any)=>n+t.rows.length,0)||r.games?.length||0)+' 筆':r.error} {r.fetchedAt?' · '+new Date(r.fetchedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):''}</p>)}<p className="text-sm text-amber-300">中職：尚無可用的 2026 來源。Goalserve、BetsAPI、LSports 尚缺憑證；免費 API-Sports 無法讀取指定 2026 球季。</p><p className="text-sm text-slate-400">未接通球員逐場歷史、牛棚負荷、完整傷兵與追蹤數據。此處不顯示虛構請求額度。</p></div></section>;
}
