'use client';
import {useEffect,useState} from 'react';
import {ShieldCheck} from 'lucide-react';
export default function AdminEntry(){
 const [allowed,setAllowed]=useState(false);
 useEffect(()=>{let active=true;let controller:AbortController|null=null;
  async function check(){controller?.abort();const c=new AbortController();controller=c;setAllowed(false);try{const r=await fetch('/api/admin-access',{cache:'no-store',signal:AbortSignal.any([c.signal,AbortSignal.timeout(10000)])});const data=r.ok?await r.json():null;if(active&&!c.signal.aborted)setAllowed(data?.isAdmin===true)}catch{}}
  void check();window.addEventListener('focus',check);return()=>{active=false;controller?.abort();window.removeEventListener('focus',check)};
 },[]);
 return allowed?<a href="/admin" className="header-action" aria-label="管理後台"><ShieldCheck className="size-4"/><span>管理後台</span></a>:null;
}
