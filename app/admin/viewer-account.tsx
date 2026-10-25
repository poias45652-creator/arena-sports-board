'use client';
import {useCallback,useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
type Account={username:string;enabled:number;updatedAt:number;lastLogin:number|null;signedIn:number};
export default function ViewerAccount(){
 const [account,setAccount]=useState<Account|null>(null),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const load=useCallback(async()=>{try{const response=await fetch('/api/admin/viewer-account',{cache:'no-store'}),data=await response.json();if(!response.ok)throw Error(data.error||'讀取失敗');setAccount(data.account);setError('');}catch(e){setError(e instanceof Error?e.message:'讀取失敗');}},[]);
 useEffect(()=>{void load();},[load]);
 async function save(body:{password?:string;enabled?:boolean}){
  setBusy(true);setError('');setMessage('');
  try{const response=await fetch('/api/admin/viewer-account',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),data=await response.json();if(!response.ok)throw Error(data.error||'儲存失敗');setPassword('');setConfirm('');setMessage(data.message);await load();}
  catch(e){setError(e instanceof Error?e.message:'儲存失敗');}finally{setBusy(false);}
 }
 return <section className="rounded-xl border border-sky-400/40 bg-[#0c1928] p-4 space-y-4" aria-label="YJ 唯讀測試帳號">
  <div><h2 className="text-lg font-bold text-sky-200">YJ 唯讀測試帳號：aa3344</h2><p className="mt-1 text-sm text-slate-300">僅限登入 YJ、瀏覽賽事與資料。不能使用 AI 助手、SUPER、遊戲、調整權重或操作後台。</p></div>
  {account&&<div className="flex flex-wrap items-center gap-3"><span>{account.enabled===1?'已啟用':'已停用'} · {account.signedIn===1?'登入中':'未登入'}</span><Button variant="outline" disabled={busy} onClick={()=>void save({enabled:account.enabled!==1})}>{account.enabled===1?'停用測試帳號':'啟用測試帳號'}</Button></div>}
  <form className="space-y-3" onSubmit={e=>{e.preventDefault();if(password!==confirm){setError('兩次輸入的密碼不一致');return;}void save({password});}}>
   <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-2"><span>新密碼</span><Input aria-label="測試帳號新密碼" type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={8} maxLength={128} autoComplete="new-password" required disabled={busy||!account}/></label><label className="space-y-2"><span>再次輸入新密碼</span><Input aria-label="再次輸入測試帳號新密碼" type="password" value={confirm} onChange={e=>setConfirm(e.target.value)} minLength={8} maxLength={128} autoComplete="new-password" required disabled={busy||!account}/></label></div>
   <p className="text-sm text-slate-400">密碼 8 至 128 字元。儲存後舊登入立即失效，須使用新密碼重新登入。</p>
   <Button type="submit" disabled={busy||!account||password.length<8||confirm.length<8}>{busy?'儲存中…':'修改測試帳號密碼'}</Button>
  </form>
  {error&&<p role="alert" className="text-red-300">{error}</p>}{message&&<p role="status" className="text-emerald-300">{message}</p>}
 </section>;
}
