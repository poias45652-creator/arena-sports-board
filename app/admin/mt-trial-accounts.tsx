'use client';
import {useState} from 'react';
const endpoint='/api/admin/mt-trials';
type Account={username:string;enabled:boolean};
export default function MtTrialAccounts(){
  const [accounts,setAccounts]=useState<Account[]>([]),[issued,setIssued]=useState<{username:string;password:string}|null>(null);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function update(method='GET',username=''){
    setBusy(true);setError('');
    try{
      if(method!=='GET'){
        const res=await fetch(endpoint+(username?'?username='+encodeURIComponent(username):''),{method,cache:'no-store'});
        if(!res.ok)throw Error();
        if(method==='POST')setIssued(await res.json());else if(issued?.username===username)setIssued(null);
      }
      const res=await fetch(endpoint,{cache:'no-store'});if(!res.ok)throw Error();setAccounts((await res.json()).accounts);
    }catch{setError('操作未確認，請重新載入帳號清單後再試。');}finally{setBusy(false);}
  }
  return <details className="member-viewer" onToggle={e=>{if(e.currentTarget.open)void update();else setIssued(null);}}>
    <summary>MT 試玩帳號</summary><p>每人發一組。連線成功後可玩 10 分鐘，結束 24 小時後可再玩。</p>
    <button type="button" disabled={busy} onClick={()=>void update('POST')}>建立試玩帳號</button>
    {issued&&<div role="status"><p>請私下交給試玩者，密碼只顯示這一次。</p><p>帳號 <code>{issued.username}</code></p><p>密碼 <code>{issued.password}</code></p><a href="/mt-trial" target="_blank" rel="noopener">開啟試玩入口</a></div>}
    {error&&<p role="alert">{error}</p>}
    <ul>{accounts.map(a=><li key={a.username}>{a.username}　{a.enabled?<button type="button" disabled={busy} onClick={()=>void update('DELETE',a.username)}>停用</button>:'已停用'}</li>)}</ul>
  </details>;
}
