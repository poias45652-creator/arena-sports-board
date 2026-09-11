'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
export default function LoginForm(){
 const [mode,setMode]=useState('login'),[setup,setSetup]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{fetch('/api/meta',{cache:'no-store'}).then(r=>r.json()).then(d=>setSetup(d.setupRequired===true)).catch(()=>setError('暫時無法讀取帳號服務，請重新整理。'));},[]);
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;setBusy(true);setError('');
  const values=Object.fromEntries(new FormData(event.currentTarget));
  try{
   const response=await fetch('/api/auth/'+mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(values)}),data=await response.json();
   if(!response.ok){if(mode==='setup'&&response.status===409)setSetup(false);throw new Error(data.error||'操作失敗，請重試。');}
   const target=new URLSearchParams(window.location.search).get('return_to')||'/';
   let safe='/';try{const url=new URL(target,location.origin);if(url.origin===location.origin&&!['/login','/signin-with-chatgpt','/signout-with-chatgpt','/logout'].includes(url.pathname))safe=url.pathname+url.search+url.hash;}catch{}
   location.assign(safe);
  }catch(e){setError(e instanceof Error?e.message:'連線中斷，請重試。');}finally{setBusy(false);}
 }
 const title=mode==='login'?'登入 Arena':mode==='register'?'建立 Arena 帳號':'建立第一位管理員';
 return <><h1 className="mb-2 text-2xl font-bold">{title}</h1><p className="mb-6 text-sm text-slate-400">登入後，使用自己的 tz 帳號連接 SUPER 盤口。</p>
 <form onSubmit={submit} className="space-y-5">
 <label className="block space-y-2"><span>Arena 帳號</span><Input name="username" autoComplete="username" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_.\-]{3,32}" disabled={busy}/></label>
 <label className="block space-y-2"><span>Arena 密碼</span><Input name="password" type="password" autoComplete={mode==='login'?'current-password':'new-password'} required minLength={10} maxLength={1024} disabled={busy}/></label>
 {mode==='setup'&&<label className="block space-y-2"><span>管理員設定碼</span><Input name="setupToken" type="password" autoComplete="off" required disabled={busy}/><span className="text-sm text-slate-400">使用 Render 中的 ARENA_SETUP_TOKEN。</span></label>}
 {error&&<p role="alert" className="text-sm text-amber-200">{error}</p>}
 <Button className="w-full" disabled={busy}>{busy?'處理中…':title}</Button></form>
 <div className="mt-6 flex flex-wrap gap-4 text-sm">{['login','register',...(setup?['setup']:[])].filter(m=>m!==mode).map(m=><button key={m} disabled={busy} className="text-slate-300 underline" onClick={()=>{setMode(m);setError('');}}>{m==='login'?'返回登入':m==='register'?'建立帳號':'首次管理員設定'}</button>)}</div></>;
}
