'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
export default function AccountMenu(){
 const [user,setUser]=useState<{username:string;role:string}|null>(null);
 useEffect(()=>{fetch('/api/auth/me',{cache:'no-store'}).then(r=>r.json()).then(d=>setUser(d.user??null)).catch(()=>{});},[]);
 async function logout(){const r=await fetch('/api/auth/logout',{method:'POST'});if(r.ok)location.assign('/login');}
 return <div className="flex items-center gap-2 text-sm"><span className="text-slate-400">{user?.username}</span>{user?.role==='admin'&&<Button asChild variant="ghost"><a href="/admin">管理後台</a></Button>}<Button variant="ghost" onClick={()=>void logout()}>登出</Button></div>;
}
