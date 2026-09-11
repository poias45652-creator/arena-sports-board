'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
export default function Logout(){const [busy,setBusy]=useState(false);return <main className="mx-auto max-w-md space-y-5 p-8"><h1 className="text-xl font-bold">登出 Arena</h1><Button disabled={busy} onClick={async()=>{setBusy(true);try{const r=await fetch('/api/auth/logout',{method:'POST'});if(r.ok)location.assign('/login');}finally{setBusy(false);}}}>登出並切換帳號</Button><p><a href="/">返回 Arena</a></p></main>;}
