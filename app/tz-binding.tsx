"use client";

import {useEffect,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Link2} from 'lucide-react';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';

type Binding={status:'unbound'|'bound'|'expired';username?:string;expiresAt?:string;verifiedAt?:string;configured?:boolean;gameUrl?:string|null;gameConnectionStatus?:'url_saved'|'not_configured'};
const date=(value?:string)=>value?new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'—';
export default function TzBinding({league='MLB'}:{league?:string}={}){
 const [tzUser,setTzUser]=useState('');
 useEffect(()=>{fetch('/api/session').then(r=>r.json()).then(d=>{if(d.signedIn)setTzUser(d.username);}).catch(()=>{});},[]);
 const [open,setOpen]=useState(false),[account,setAccount]=useState(''),[password,setPassword]=useState('');
 const [binding,setBinding]=useState<Binding|null>(null),[signin,setSignin]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [editAccount,setEditAccount]=useState(false),[gameUrl,setGameUrl]=useState('https://hr9988.net/#/Games');
 const [connection,setConnection]=useState<{status:string;gameCount?:number;fetchedAt?:string;message?:string}|null>(null);
 const requestVersion=useRef(0);
 async function refresh(){
  const version=++requestVersion.current;setLoading(true);setMessage('');
  try{
   const r=await fetch('/api/tz-binding',{cache:'no-store'}),d=await r.json();
   if(version!==requestVersion.current)return;
   setSignin(r.status===401);
   if(r.ok){setBinding(d);setConnection(null);if(d.gameUrl&&d.status==='bound'){const cr=await fetch('/api/hr9988?status=1',{cache:'no-store'});const cd=await cr.json();if(version!==requestVersion.current)return;setConnection(cr.ok?cd:{status:'error',message:cd.error});}setGameUrl(d.gameUrl||'https://hr9988.net/#/Games');setEditAccount(false);if(d.configured===false)setMessage('綁定服務尚未就緒，請稍後再試。');}
   else{setBinding(null);setMessage(d.message||'無法讀取綁定狀態，請重試。');}
  }catch{if(version===requestVersion.current){setBinding(null);setMessage('無法讀取綁定狀態，請檢查連線後重試。');}}
  finally{if(version===requestVersion.current)setLoading(false);}
 }
 useEffect(()=>{void refresh();return()=>{requestVersion.current++;};},[]);
 function changeOpen(next:boolean){
  if(busy)return;
  setAccount('');setPassword('');setEditAccount(false);setOpen(next);
  if(next)void refresh();
 }
 async function mutate(method:'POST'|'PATCH'|'DELETE'){
  if(busy)return;
  requestVersion.current++;setBusy(true);setMessage('');
  const body=method==='POST'?JSON.stringify({username:account.trim(),password}):method==='PATCH'?JSON.stringify({gameUrl}):undefined;
  setPassword('');
  try{
   const r=await fetch('/api/tz-binding',{method,headers:method!=='DELETE'?{'Content-Type':'application/json'}:undefined,body,cache:'no-store'}),d=await r.json();
   if(r.status===401){setSignin(true);setBinding(null);}
   if(r.ok){
    setBinding(d);setAccount('');setEditAccount(false);setGameUrl(d.gameUrl||'https://hr9988.net/#/Games');setConnection(null);
    if(method==='PATCH'){
     setMessage('正在連接 SUPER 並讀取資料…');
     const cr=await fetch('/api/hr9988',{method:'POST',cache:'no-store'}),cd=await cr.json();
     if(cr.ok){const count=league==='MLB'?cd.games?.length||0:(cd.internationalGames||[]).filter((g:any)=>g.league===league).length;setConnection({...cd.connection,gameCount:count});setMessage(`已連接 SUPER，取得 ${count} 場 ${league} 資料。`);}
     else{setConnection({status:'error',message:cd.error});setMessage(cd.error||'連接失敗，請稍後重試。');}
    }else setMessage(method==='DELETE'?'已解除 Arena 綁定。':'綁定成功，請接著連接 SUPER 資料。');
    window.dispatchEvent(new Event('arena-odds-change'));
   }
   else {if(d.error==='binding_required')setEditAccount(true);setMessage(d.message||'操作失敗，請稍後重試。');}
  }catch{setBinding(null);setConnection(null);setMessage('未收到操作結果，請重新讀取狀態後確認。');window.dispatchEvent(new Event('arena-odds-change'));}
  finally{setBusy(false);}
 }
 const expired=binding?.status==='expired'||!!binding?.expiresAt&&Date.parse(binding.expiresAt)<=Date.now();
 const bound=binding?.status==='bound'||binding?.status==='expired';
 const showGame=bound&&!expired&&!editAccount;
 const notice=message&&<p role="status" className="rounded-md border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-200">{message}</p>;
 if(tzUser)return <div className="space-y-2"><p className="text-sm">帳號：{tzUser}</p><div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={async()=>{setBusy(true);setMessage('正在連接 SUPER…');try{const r=await fetch('/api/hr9988',{method:'POST',signal:AbortSignal.timeout(55000)}),d=await r.json();if(r.status===401||['tz_auth_expired','binding_required'].includes(d.code)){window.location.assign('/login?reason=tz-expired');return;}setMessage(r.ok?'SUPER 已連接':d.error||'連接失敗');window.dispatchEvent(new Event('arena-odds-change'));}catch{setMessage('SUPER 連線失敗');}finally{setBusy(false);}}}>{busy?'連接中…':'重新連接 SUPER'}</Button><Button variant="outline" asChild><a href="/login?reason=renew">重新驗證帳密</a></Button></div>{message&&<p role="status" className="text-sm text-amber-300">{message}</p>}</div>;
 return <Dialog open={open} onOpenChange={changeOpen}>
  <DialogTrigger asChild><Button variant="outline" className="super-connect-trigger shrink-0 rounded-lg font-bold"><Link2 className="size-5" aria-hidden="true"/>{expired?'授權已到期':bound?'連接 SUPER 資料':'綁定帳號'}</Button></DialogTrigger>
  <DialogContent className="max-h-[90dvh] overflow-y-auto border-[#2c394a] bg-[#0e1a28] text-slate-100" showCloseButton={false}>
   <DialogHeader><DialogTitle>{showGame?'連接 SUPER 資料':bound?'管理會員綁定':'綁定會員帳號'}</DialogTitle><DialogDescription className="text-slate-400">{showGame?'第 2 步：貼上 SUPER 賽事網址，使用你的授權連接資料。':'第 1 步：使用自己的帳號驗證。密碼僅用於本次登入，不會保存。'}</DialogDescription></DialogHeader>
   {loading?<p role="status">正在讀取綁定狀態…</p>:signin?<div className="space-y-4"><p>請先登入 Arena，才能保存與管理自己的綁定。</p><Button asChild><a href="/signin-with-chatgpt?return_to=%2F" target="_top">登入 Arena</a></Button></div>:showGame?<form className="space-y-4" onSubmit={e=>{e.preventDefault();void mutate('PATCH');}}>
    <div className="rounded-md border border-slate-700 p-3 text-sm space-y-1"><p className="font-bold">已綁定：{binding?.username}</p><p className="text-slate-400">授權到期：{date(binding?.expiresAt)}（台灣時間）</p></div>
    <div className="space-y-2"><label htmlFor="hr9988-url" className="text-sm font-bold">SUPER 賽事網址</label><Input id="hr9988-url" type="url" value={gameUrl} onChange={e=>{setGameUrl(e.target.value);setMessage('');}} placeholder="https://hr9988.net/#/Games" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={512} required disabled={busy} aria-describedby="hr9988-status"/></div>
    {notice}
    <p id="hr9988-status" className="text-sm text-slate-400">{connection?.status==='connected'?`已連接・${league==='MLB'?`${connection.gameCount} 場 MLB・`:''}更新於 ${date(connection.fetchedAt)}`:connection?.message||`按下連接後，會驗證登入並讀取目前的 ${league} 資料。`}</p>
    <DialogFooter className="gap-2"><Button type="button" variant="outline" disabled={busy} onClick={()=>{setEditAccount(true);setMessage('');}}>管理帳號</Button><Button type="submit" disabled={busy||!gameUrl.trim()}>{busy?'連接中…':connection?.status==='connected'?'重新連接並更新':'連接並讀取資料'}</Button></DialogFooter>
   </form>:<form className="space-y-4" autoComplete="off" onSubmit={e=>{e.preventDefault();void mutate('POST');}}>
    {bound&&<div className="rounded-md border border-slate-700 p-3 text-sm space-y-1"><p className="font-bold">{expired?'授權已到期，請重新驗證':'已綁定'}：{binding?.username}</p><p>上次登入驗證：{date(binding?.verifiedAt)}</p><p>授權到期：{date(binding?.expiresAt)}（台灣時間）</p><p className="text-slate-400">密碼更改或提前撤銷授權時，也需要重新驗證。</p></div>}
    {notice}
    <p className="text-sm text-slate-400">綁定成功後，會進入 SUPER 資料連接。</p>
    <div className="space-y-2"><label htmlFor="tz-account" className="text-sm font-bold">帳號</label><Input id="tz-account" value={account} onChange={e=>setAccount(e.target.value)} placeholder="輸入會員帳號" autoComplete="off" autoCapitalize="none" spellCheck={false} maxLength={128} required disabled={busy}/></div>
    <div className="space-y-2"><label htmlFor="tz-password" className="text-sm font-bold">密碼</label><Input id="tz-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="輸入會員密碼" autoComplete="off" maxLength={256} required disabled={busy}/></div>
    <DialogFooter className="gap-2">
     {bound&&!expired&&<Button type="button" variant="outline" disabled={busy} onClick={()=>{setEditAccount(false);setAccount('');setPassword('');setMessage('');}}>返回網址設定</Button>}
     {bound&&<Button type="button" variant="outline" disabled={busy} onClick={()=>void mutate('DELETE')}>解除綁定</Button>}
     {!binding&&<Button type="button" variant="outline" disabled={busy} onClick={()=>void refresh()}>重讀狀態</Button>}
     <Button type="submit" disabled={busy||!binding||binding.configured===false||!account.trim()||!password}>{busy?'處理中…':bound?'重新驗證並綁定':'驗證並綁定'}</Button>
    </DialogFooter>
   </form>}
   <Button type="button" variant="outline" disabled={busy} onClick={()=>changeOpen(false)}>關閉</Button>
  </DialogContent>
 </Dialog>;
}
