"use client";
import { useEffect, useState } from 'react';
import OperationsPanel from '../operations-panel';
import SettlementCalculator from '../settlement-calculator';
import MatchComparison from './match-comparison';

export default function AdminTools() {
  const [evaluation, setEvaluation] = useState<any>(null);
  const [accountMessage,setAccountMessage]=useState(''),[accountBusy,setAccountBusy]=useState(false);
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
  async function createAccount(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(accountBusy)return;setAccountBusy(true);setAccountMessage('');const form=event.currentTarget;
    try{const values=Object.fromEntries(new FormData(form)),response=await fetch('/api/meta',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)}),data=await response.json();if(!response.ok)throw new Error(data.error||'新增失敗');setAccountMessage(`已新增會員帳號：${data.username}`);form.reset();}
    catch(e){setAccountMessage(e instanceof Error?e.message:'新增帳號失敗');}finally{setAccountBusy(false);}
  }
  return <div className="space-y-4"><section className="panel p-5"><h2 className="mb-1 text-lg font-bold">新增會員帳號</h2><p className="mb-4 text-sm text-slate-400">前台已關閉自行註冊，只有管理員可在此建立帳號。</p><form onSubmit={createAccount} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><input name="username" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_.\-]{3,32}" autoComplete="off" placeholder="會員帳號" className="rounded-md border border-white/15 bg-black/20 px-3 py-2"/><input name="password" type="password" required minLength={10} maxLength={1024} autoComplete="new-password" placeholder="密碼（至少 10 碼）" className="rounded-md border border-white/15 bg-black/20 px-3 py-2"/><button disabled={accountBusy} className="rounded-md bg-[#ffd538] px-4 py-2 font-bold text-[#06101b] disabled:opacity-50">{accountBusy?'新增中…':'新增帳號'}</button></form>{accountMessage&&<p role="status" className="mt-3 text-sm text-amber-200">{accountMessage}</p>}</section><MatchComparison/><OperationsPanel evaluation={evaluation}/><SettlementCalculator/></div>;
}
