'use client';
import {useCallback,useEffect,useRef,useState,type Ref} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Switch} from '@/components/ui/switch';
import {Textarea} from '@/components/ui/textarea';
import {accountExpiryInput,parseAccountExpiry} from '@/lib/account-expiry';
import {AlertDialog,AlertDialogTrigger,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
type Account={memberId:string|null;username:string;note:string;enabled:number;expiresAt:number|null;lastLogin:number|null;signedIn:number;accessState:'pending'|'disabled'|'expired'|'active';isAdmin:number};
const date=accountExpiryInput;
const timeOptions=(count:number)=>Array.from({length:count},(_,i)=>String(i).padStart(2,'0'));
const accountTarget=(account:Account)=>account.memberId?{memberId:account.memberId}:{pendingUsername:account.username};
function ExpiryFields({label,value,onChange,disabled,dateRef}:{label:string;value:string;onChange:(value:string)=>void;disabled:boolean;dateRef?:Ref<HTMLInputElement>}){
 const day=value.slice(0,10),parts=[value.slice(11,13)||'00',value.slice(14,16)||'00',value.slice(17,19)||'00'];
 return <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2"><span>使用至</span>
  <Input ref={dateRef} aria-label={`${label} 到期日期（台灣）`} type="date" min="1970-01-01" max="2099-12-31" className="w-[10rem] min-w-0" value={day} onChange={e=>onChange(e.target.value?`${e.target.value}T${parts.join(':')}`:'')} disabled={disabled}/>
  {['時','分','秒'].map((unit,i)=><label key={unit} className="flex items-center gap-1"><select aria-label={`${label} 到期${unit}（台灣）`} className="h-9 rounded-md border border-slate-600 bg-[#0c1928] px-2 text-slate-100" value={parts[i]} onChange={e=>{const next=[...parts];next[i]=e.target.value;onChange(`${day||date(Date.now()).slice(0,10)}T${next.join(':')}`)}} disabled={disabled}>{timeOptions(i===0?24:60).map(option=><option key={option} value={option}>{option}</option>)}</select>{unit}</label>)}
  <Button type="button" variant="outline" disabled={disabled||!value} onClick={()=>onChange('')}>不限期限</Button>
 </div>;
}
function DirectApproval({onSaved}:{onSaved:(username:string)=>void}){
 const [username,setUsername]=useState(''),[until,setUntil]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[failed,setFailed]=useState(false);
 async function openAccount(){setBusy(true);setMessage('');setFailed(false);try{
  const expiresAt=parseAccountExpiry(until);
  if(expiresAt!==null&&expiresAt<=Date.now())throw Error('開通的到期時間必須晚於現在');
  const response=await fetch('/api/admin/accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:username.trim(),expiresAt,note})}),result=await response.json();
  if(!response.ok)throw Error(result.error||'開通失敗');
  setMessage(`${result.username}：${result.message}`);setUsername('');setNote('');setUntil('');onSaved(result.username);
 }catch(error){setFailed(true);setMessage(error instanceof Error?error.message:'開通失敗');}finally{setBusy(false);}}
 return <form className="rounded-xl border border-yellow-400/30 bg-[#0c1928] p-4 space-y-4" onSubmit={event=>{event.preventDefault();void openAccount()}}>
  <div><h2 className="text-lg font-bold text-yellow-200">直接開通帳號</h2><p className="mt-1 text-sm text-slate-300">輸入完整帳號即可開通，會員使用原帳號密碼登入。尚未登入過的帳號也可先開通。</p></div>
  <label className="block space-y-2"><span>帳號</span><Input aria-label="直接開通帳號" placeholder="輸入完整帳號" value={username} onChange={e=>setUsername(e.target.value)} required maxLength={128} autoComplete="off" disabled={busy}/></label>
  <ExpiryFields label="直接開通" value={until} onChange={setUntil} disabled={busy}/>
  <p className="text-sm text-slate-400">{until?`有效至 ${until.replace('T',' ')}（台灣時間）`:'未設定到期時間，開通後不限期限。'}</p>
  <label className="block space-y-2"><span>備註（選填，僅後台可見）</span><Textarea aria-label="開通帳號備註" value={note} onChange={e=>setNote(e.target.value)} maxLength={1000} rows={2} placeholder="例如：客戶稱呼、聯絡方式、開通原因" disabled={busy}/></label>
  <Button type="submit" disabled={busy||!username.trim()}>{busy?'開通中…':'直接開通'}</Button>
  {message&&<p role={failed?'alert':'status'} className={failed?'text-red-300':'text-emerald-300'}>{message}</p>}
 </form>;
}
function AccountRow({account,onSaved,statusAvailable}:{account:Account;onSaved:()=>void;statusAvailable:boolean}){
 const [enabled,setEnabled]=useState(account.enabled===1),[until,setUntil]=useState(date(account.expiresAt)),[note,setNote]=useState(account.note||''),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 useEffect(()=>setNote(account.note||''),[account.note]);
 const [confirmDelete,setConfirmDelete]=useState(false);
 const expiryField=useRef<HTMLInputElement>(null);
 const pending=account.accessState==='pending',admin=account.isAdmin===1;
 const changed=enabled!==(account.enabled===1)||until!==date(account.expiresAt);
 async function save(allowed=enabled){if(expiryField.current&&!expiryField.current.reportValidity())return;setBusy(true);setMessage('');try{
  const expiresAt=until===date(account.expiresAt)?account.expiresAt:parseAccountExpiry(until);
  const r=await fetch('/api/admin/accounts',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...accountTarget(account),enabled:allowed,expiresAt,note})});const d=await r.json();if(!r.ok)throw new Error(d.error||'儲存失敗');setMessage('已儲存');onSaved();
 }catch(e){setMessage(e instanceof Error?e.message:'儲存失敗');}finally{setBusy(false);}}
 async function saveNote(){setBusy(true);setMessage('');try{
  const r=await fetch('/api/admin/accounts',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({...accountTarget(account),note})}),d=await r.json();if(!r.ok)throw Error(d.error||'備註儲存失敗');setMessage('備註已儲存');onSaved();
 }catch(e){setMessage(e instanceof Error?e.message:'備註儲存失敗');}finally{setBusy(false);}}
 async function remove(){setBusy(true);setMessage('');try{
  const r=await fetch('/api/admin/accounts',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({...accountTarget(account),confirmUsername:account.username})});const d=await r.json();if(!r.ok)throw new Error(d.error||'刪除失敗');setConfirmDelete(false);onSaved();
 }catch(e){setMessage(e instanceof Error?e.message:'刪除失敗');}finally{setBusy(false);}}
 const status=pending?'待授權':account.enabled!==1?'已停用':account.expiresAt&&account.expiresAt<=Date.now()?'已到期':'已授權';
 return <div className="rounded-xl border border-slate-700 bg-[#0c1928] p-4 space-y-3">
  <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-lg break-all">{account.username}{admin&&<span className="ml-2 text-sm text-slate-400">主管理員</span>}</h3><span className={status==='已授權'?'text-emerald-300':'text-amber-300'}>{status}</span></div>
  {!account.memberId&&<p className="text-sm text-sky-300">已建立開通紀錄，等待會員首次驗證帳密。</p>}
  <div className="space-y-2 text-sm"><p className="text-slate-400">最後登入時間：{account.lastLogin===null?'尚無紀錄（下次成功登入後顯示）':`${new Date(account.lastLogin).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false})}（台灣）`}</p><p className="flex flex-wrap items-center gap-2"><span className="text-slate-400">目前登入狀態：</span><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${!statusAvailable?'bg-amber-400/10 text-amber-300':account.signedIn===1?'bg-emerald-400/10 text-emerald-300':'bg-slate-400/10 text-slate-300'}`}><span aria-hidden="true" className="size-2 rounded-full bg-current"/>{!statusAvailable?'暫時無法確認':account.signedIn===1?'登入中':'未登入'}</span></p></div>
  <div className="flex flex-wrap items-center gap-4">
   {!pending&&<label className="flex items-center gap-2"><Switch checked={enabled} onCheckedChange={setEnabled} disabled={busy||admin}/>允許使用</label>}
   <ExpiryFields label={account.username} value={until} onChange={setUntil} disabled={busy||admin} dateRef={expiryField}/>
   {pending?<><Button disabled={busy} onClick={()=>void save(true)}>{busy?'處理中…':'授權使用'}</Button>{!admin&&<Button variant="outline" disabled={busy} onClick={()=>void save(false)}>不予授權</Button>}</>:<Button disabled={busy||admin||!changed} onClick={()=>void save()}>{busy?'儲存中…':'儲存授權'}</Button>}
   {!admin&&<AlertDialog open={confirmDelete} onOpenChange={open=>{if(!busy)setConfirmDelete(open)}}><AlertDialogTrigger asChild><Button variant="destructive" className="bg-red-600 text-white hover:bg-red-700" disabled={busy} onClick={()=>setMessage('')}>刪除帳號</Button></AlertDialogTrigger><AlertDialogContent className="border-slate-700 bg-[#0e1a28] text-slate-100"><AlertDialogHeader><AlertDialogTitle>刪除帳號「{account.username}」？</AlertDialogTitle><AlertDialogDescription className="text-slate-300">將刪除這個帳號的網站授權、登入狀態與來源連線紀錄，不會刪除原平台帳號。之後重新驗證帳號時，須再次由管理員授權。</AlertDialogDescription></AlertDialogHeader>{message&&<p role="alert" className="text-red-300">{message}</p>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>取消</AlertDialogCancel><AlertDialogAction variant="destructive" className="bg-red-600 text-white hover:bg-red-700" disabled={busy} onClick={e=>{e.preventDefault();void remove()}}>{busy?'刪除中…':'確認刪除'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
  </div>
  <p className="text-sm text-slate-400">{admin?'主管理員保留永久使用權。':until?`有效至 ${until.replace('T',' ')}（台灣時間，精確至秒）`:'授權後不限期限。'}</p>
  <label className="block space-y-2"><span className="text-sm text-slate-300">備註（僅後台可見）</span><Textarea aria-label={`${account.username} 備註`} value={note} onChange={e=>setNote(e.target.value)} rows={2} maxLength={1000} placeholder="新增帳號備註" disabled={busy}/></label>
  <div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-400">{note.length}/1000</span><Button variant="outline" disabled={busy||note===(account.note||'')} onClick={()=>void saveNote()}>{busy?'處理中…':'儲存備註'}</Button></div>
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
 const shown=accounts.filter(a=>(tab==='inactive'?a.accessState==='disabled'||a.accessState==='expired':a.accessState===tab)&&`${a.username}\n${a.note||''}`.toLowerCase().includes(search.trim().toLowerCase()));
 return <section className="panel p-5 space-y-4">
  <div className="flex flex-wrap justify-between items-center gap-3"><h1 className="text-2xl font-bold">帳號授權管理</h1><Button variant="outline" onClick={()=>{setLoading(true);void load()}} disabled={loading}>重新載入</Button></div>
  <p className="text-slate-300">可直接輸入帳號開通，或從待授權名單操作。停用或到期會立即停止存取。</p>
  <DirectApproval onSaved={username=>{setTab('active');setSearch(username);void load()}}/>
  <p className="text-sm text-slate-400">登入狀態每 15 秒自動更新。「登入中」表示登入仍有效，不代表正在操作頁面。</p>
  <div className="flex flex-wrap gap-2" role="group" aria-label="授權狀態"><Button aria-pressed={tab==='pending'} variant={tab==='pending'?'default':'outline'} onClick={()=>setTab('pending')}>待授權（{pendingCount}）</Button><Button aria-pressed={tab==='active'} variant={tab==='active'?'default':'outline'} onClick={()=>setTab('active')}>已授權（{activeCount}）</Button><Button aria-pressed={tab==='inactive'} variant={tab==='inactive'?'default':'outline'} onClick={()=>setTab('inactive')}>已停用／到期（{inactiveCount}）</Button></div>
  <Input aria-label="搜尋帳號或備註" placeholder="搜尋帳號或備註" value={search} onChange={e=>setSearch(e.target.value)}/>
  {error&&<p role="alert" className="text-red-300">{error}</p>}
  {loading?<p>正在讀取帳號…</p>:<><p className="text-sm text-slate-400">共 {shown.length} 個帳號</p><div className="grid gap-4 xl:grid-cols-2">{shown.map(a=><AccountRow key={`${a.memberId||'preapproved:'+a.username}:${a.accessState}:${a.enabled}:${a.expiresAt}`} account={a} statusAvailable={!error} onSaved={()=>void load()}/>)}</div>{!shown.length&&<p>{search.trim()?'沒有符合搜尋條件的帳號。':tab==='pending'?'目前沒有待授權帳號。':tab==='active'?'目前沒有已授權帳號。':'目前沒有已停用或到期帳號。'}</p>}</>}
 </section>;
}
