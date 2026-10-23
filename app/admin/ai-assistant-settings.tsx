'use client';
import {useEffect,useState} from 'react';
import {Bot} from 'lucide-react';
export default function AiAssistantSettings(){
 const [enabled,setEnabled]=useState<boolean|null>(null),[key,setKey]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 useEffect(()=>{const c=new AbortController();fetch('/api/admin/ai-assistant',{cache:'no-store',signal:c.signal}).then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error);setEnabled(d.enabled&&d.configured);}).catch(e=>{if(!c.signal.aborted)setNotice(e.message||'設定讀取失敗');});return()=>c.abort();},[]);
 async function save(disable=false){
  if(busy)return;setBusy(true);setNotice('');
  try{const r=await fetch('/api/admin/ai-assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(disable?{enabled:false}:{key}),signal:AbortSignal.timeout(30000)});const d=await r.json();if(!r.ok)throw Error(d.error);setEnabled(d.enabled&&d.configured);setKey('');setNotice(disable?'AI 自由提問已停用；快捷分析仍可使用。':'AI 連線測試通過，會員自由提問已啟用。');}catch(e){setNotice(e instanceof Error?e.message:'設定儲存失敗');}finally{setBusy(false);}
 }
 return <section className="panel p-5 space-y-4"><div className="flex flex-wrap items-center gap-3"><Bot className="text-[#ffd538]"/><h2 className="text-lg font-bold">ai星準助手</h2><span className="text-sm text-slate-400">{enabled===null?'讀取中':enabled?'AI 自由提問已啟用':'AI 自由提問尚未啟用'}</span><a className="header-action ml-auto" href="/ai-assistant">開啟助手</a></div>
 <p className="text-sm text-slate-300">會員可詢問星準場次的分析與權重。快捷分析可直接使用；設定 OpenAI API 金鑰後開啟自由提問，API 用量由該金鑰所屬帳戶計費。</p>
 <form className="flex flex-wrap items-end gap-3" onSubmit={e=>{e.preventDefault();void save();}}><label className="flex-1 min-w-48 text-sm">OpenAI API 金鑰<input type="password" name="ai-api-key" autoComplete="new-password" value={key} onChange={e=>setKey(e.target.value)} maxLength={1003} placeholder={enabled?'輸入新金鑰以更換':'sk-…'} className="mt-2 block w-full rounded-lg border border-white/20 bg-[#081522] p-3" disabled={busy}/></label><button type="submit" className="header-action bg-[#ffd538] text-slate-950 font-bold" disabled={busy||!key.trim()}>{busy?'測試與儲存中…':'測試並啟用'}</button>{enabled&&<button type="button" className="header-action" disabled={busy} onClick={()=>void save(true)}>停用自由提問</button>}</form>
 <p className="text-xs text-slate-400">金鑰加密保存，不會顯示給會員。每位會員每日最多提問 100 次。資料不足時固定回覆「因分析資料不足無法分析」。</p>{notice&&<p role="status" className="text-sm text-amber-200">{notice}</p>}</section>;
}
