'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
export default function SessionAccount(){const [name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');useEffect(()=>{const check=()=>fetch('/api/session',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error();return r.json()}).then(d=>{if(d.signedIn)setName(d.username);else window.location.replace('/login');}).catch(()=>{});void check();const timer=setInterval(check,30000);return()=>clearInterval(timer);},[]);
 async function logout(){setBusy(true);try{const r=await fetch('/api/session',{method:'DELETE'});if(!r.ok)throw new Error();window.location.assign('/login');}catch{setError('登出失敗，請重試');setBusy(false);}}
 return <div className="flex items-center gap-2 text-sm"><span>{name}</span><Button variant="outline" disabled={busy} onClick={logout}>{busy?'登出中…':'登出'}</Button>{error&&<span role="alert">{error}</span>}</div>;
}
