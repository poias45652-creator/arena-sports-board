"use client";
import { useEffect, useState } from 'react';
import OperationsPanel from '../operations-panel';
import SettlementCalculator from '../settlement-calculator';

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
  return <div className="space-y-4"><OperationsPanel evaluation={evaluation}/><SettlementCalculator/></div>;
}
