'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Switch} from '@/components/ui/switch';
import {accountExpiryInput,parseAccountExpiry} from '@/lib/account-expiry';
import {AlertDialog,AlertDialogTrigger,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
type Account={memberId:string;username:string;enabled:number;expiresAt:number|null;lastLogin:number|null;signedIn:number;accessState:'pending'|'disabled'|'expired'|'active';isAdmin:number};
const date=accountExpiryInput;
const timeOptions=(count:number)=>Array.from({length:count},(_,i)=>String(i).padStart(2,'0'));
function AccountRow({account,onSaved,statusAvailable}:{account:Account;onSaved:()=>void;statusAvailable:boolean}){
 const initial=date(account.expiresAt);
 const [enabled,setEnabled]=useState(account.enabled===1),[expiryDate,setExpiryDate]=useState(initial.slice(0,10)),[hour,setHour]=useState(initial.slice(11,13)||'00'),[minute,setMinute]=useState(initial.slice(14,16)||'00'),[second,setSecond]=useState(initial.slice(17,19)||'00'),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const until=expiryDate?`${expiryDate}T${hour}:${minute}:${second}`:'';
 function clearExpiry(){setExpiryDate('');setHour('00');setMinute('00');setSecond('00');}
 const [confirmDelete,setConfirmDelete]=useState(false);
 const expiryField=useRef<HTMLInputElement>(null);
 const pending=account.accessState==='pending',admin=account.isAdmin===1;
 const changed=enabled!==(account.enabled===1)||until!==date(account.expiresAt);
 async function save(allowed=enabled){if(expiryField.current&&!expiryField.current.reportValidity())return;setBusy(true);setMessage('');try{
  const expiresAt=until===date(account.expiresAt)?account.expiresAt:parseAccountExpiry(until);
  const r=await fetch('/api/admin/accounts',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({memberId:account.memberId,enabled:allowed,expiresAt})});const d=await r.json();if(!r.ok)throw new Error(d.error||'儲存失敗');setMessage('已儲存');onSaved();
 }catch(e){setMessage(e instanceof Error?e.message:'儲存失敗');}finally{setBusy(false);}}
 async function remove(){setBusy(true);setMessage('');try{
  const r=await fetch('/api/admin/accounts',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({memberId:account.memberId,confirmUsername:account.username})});const d=await r.json();if(!r.ok)throw new Error(d.error||'刪除失敗');setConfirmDelete(false);onSaved();
 }catch(e){setMessage(e instanceof Error?e.message:'刪除失敗');}finally{setBusy(false);}}
 const status=pending?'待授權':account.enabled!==1?'已停用':account.expiresAt&&account.expiresAt<=Date.now()?'已到期':'已授權';
 return <div className="rounded-xl border border-slate-700 bg-[#0c1928] p-4 space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-lg break-all">{account.username}{admin&&<span className="ml-2 text-sm text-slate-400">主管理員</span>}</h3><span className={status==='已授權'?'text-emerald-300':'text-amber-300'}>{status}</span></div>
  <div className="space-y-2 text-sm"><p className="text-slate-400">最後登入時間：{account.lastLogin===null?'尚無紀錄（下次成功登入後顯示）':`${new Date(account.lastLogin).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})}（台灣）`}</p><p className="flex flex-wrap items-center gap-2"><span className="text-slate-400">目前登入狀態：</span><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${!statusAvailable?'bg-amber-400/10 text-amber-300':account.signedIn===1?'bg-emerald-400/10 text-emerald-300':'bg-slate-400/10 text-slate-300'}`}><span aria-hidden="true" className="size-2 rounded-full bg-current"/>{!statusAvailable?'暫時無法確認':account.signedIn===1?'登入中':'未登入'}</span></p></div>
  <div className="flex flex-wrap items-center gap-4">
   {!pending&&<label className="flex items-center gap-2"><Switch checked={enabled} onCheckedChange={setEnabled} disabled={busy||admin}/>允許使用</label>}
   <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
    <span>使用至</span>
    <Input ref={expiryField} aria-label={`${account.username} 到期日期（台灣）`} type="date" min="1970-01-01" max="2099-12-31" className="w-[10rem] min-w-0" value={expiryDate} onChange={e=>setExpiryDate(e.target.value)} disabled={busy||admin}/>
    {([{label:'時',value:hour,set:setHour,count:24},{label:'分',value:minute,set:setMinute,count:60},{label:'秒',value:second,set:setSecond,count:60}]).map(field=><label key={field.label} className="flex items-center gap-1"><select aria-label={`${account.username} 到期${field.label}（台灣）`} className="h-9 rounded-md border border-slate-600 bg-[#0c1928] px-2 text-slate-100" value={field.value} onChange={e=>{if(!expiryDate)setExpiryDate(date(Date.now()).slice(0,10));field.set(e.target.value)}} disabled={busy||admin}>{timeOptions(field.count).map(value=><option key={value} value={value}>{value}</option>)}</select>{field.label}</label>)}
   </div>
   <Button variant="outline" disabled={busy||admin||!until} onClick={clearExpiry}>不限期限</Button>
   {pending?<><Button disabled={busy} onClick={()=>void save(true)}>{busy?'處理中…':'授權使用'}</Button>{!admin&&<Button variant="outline" disabled={busy} onClick={()=>void save(false)}>不予授權</Button>}</>:<Button disabled={busy||admin||!changed} onClick={()=>void save()}>{busy?'儲存中…':'儲存授權'}</Button>}
   {!admin&&<AlertDialog open={confirmDelete} onOpenChange={open=>{if(!busy)setConfirmDelete(open)}}><AlertDialogTrigger asChild><Button variant="destructive" className="bg-red-600 text-white hover:bg-red-700" disabled={busy} onClick={()=>setMessage('')}>刪除帳號</Button></AlertDialogTrigger><AlertDialogContent className="border-slate-700 bg-[#0e1a28] text-slate-100"><AlertDialogHeader><AlertDialogTitle>刪除帳號「{account.username}」？</AlertDialogTitle><AlertDialogDescription className="text-slate-300">將刪除這個帳號的網站授權、登入狀態與來源連線紀錄，不會刪除原平台帳號。之後重新驗證帳號時，須再次由管理員授權。</AlertDialogDescription></AlertDialogHeader>{message&&<p role="alert" className="text-red-300">{message}</p>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>取消</AlertDialogCancel><AlertDialogAction variant="destructive" className="bg-red-600 text-white hover:bg-red-700" disabled={busy} onClick={e=>{e.preventDefault();void remove()}}>{busy?'刪除中…':'確認刪除'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
  </div>
  <p className="text-sm text-slate-400">{admin?'主管理員保留永久使用權。':until?`有效至 ${until.replace('T',' ')}（台灣時間，精確至秒）`:'授權後不限期限。'}</p>
  {message&&<p role="status" className="text-sm text-yellow-200">{message}</p>}
 </div>;
}
export default function Accounts(){
 const [accounts,setAccounts]=useState<Account[]>([]),[search,setSearch]=useState(''),[tab,setTab]=useState<'pending'|'active'|'inactive'>('pending'),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const requestRef=useRef<AbortController|null>(null);
 const load=useCallback(async()=>{requestRef.current?.abort();const controller=new AbortController();requestRef.current=controller;try{const r=await fetch('/api/admin/accounts',{cache:'no-store',signal:controller.signal});const d=await r.json();if(!r.ok)throw new Error(d.error||'讀取失敗');if(controller.signal.aborted)return;setAccounts(d.accounts);setError('');}catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'讀取失敗');}finally{if(!controller.signal.aborted)setLoading(false);}},[]);
 useEffect(()=>{void load();const refresh=()=>{if(document.visibilityState==='visible')void load()};const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);requestRef.current?.abort();}},[load]);
 const pendingCount=accounts.filter(a=>a.accessState==='pending').length;
 const activeCount=accounts.filter(a=>a.accessState==='active').length;
 const inactiveCount=accounts.length-pendingCount-activeCount;
 const shown=accounts.filter(a=>(tab==='inactive'?a.accessState==='disabled'||a.accessState==='expired':a.accessState===tab)&&a.username.toLowerCase().includes(search.trim().toLowerCase()));
 return <section className="panel p-5 space-y-4">
  <div className="flex flex-wrap justify-between items-center gap-3"><h1 className="text-2xl font-bold">帳號授權管理</h1><Button variant="outline" onClick={()=>{setLoading(true);void load()}} disabled={loading}>重新載入</Button></div>
  <p className="text-slate-300">使用者先以自己的平台帳號驗證，驗證成功後會列入待授權。管理員授權後才能登入網站；停用或到期會立即停止存取。</p>
  <p className="text-sm text-slate-400">登入狀態每 15 秒自動更新。「登入中」表示登入仍有效，不代表正在操作頁面。</p>
  <div className="flex flex-wrap gap-2" role="group" aria-label="授權狀態"><Button aria-pressed={tab==='pending'} variant={tab==='pending'?'default':'outline'} onClick={()=>setTab('pending')}>待授權（{pendingCount}）</Button><Button aria-pressed={tab==='active'} variant={tab==='active'?'default':'outline'} onClick={()=>setTab('active')}>已授權（{activeCount}）</Button><Button aria-pressed={tab==='inactive'} variant={tab==='inactive'?'default':'outline'} onClick={()=>setTab('inactive')}>已停用／到期（{inactiveCount}）</Button></div>
  <Input aria-label="搜尋帳號" placeholder="搜尋帳號" value={search} onChange={e=>setSearch(e.target.value)}/>
  {error&&<p role="alert" className="text-red-300">{error}</p>}
  {loading?<p>正在讀取帳號…</p>:<><p className="text-sm text-slate-400">共 {shown.length} 個帳號</p><div className="grid gap-4 xl:grid-cols-2">{shown.map(a=><AccountRow key={`${a.memberId}:${a.accessState}:${a.enabled}:${a.expiresAt}`} account={a} statusAvailable={!error} onSaved={()=>void load()}/>)}</div>{!shown.length&&<p>{search.trim()?'沒有符合搜尋條件的帳號。':tab==='pending'?'目前沒有待授權帳號。':tab==='active'?'目前沒有已授權帳號。':'目前沒有已停用或到期帳號。'}</p>}</>}
 </section>;
}
