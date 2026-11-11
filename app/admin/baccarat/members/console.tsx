'use client';
import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from 'react';
import {AccountRow,DirectApproval,ExpiryFields,type Account} from '../../accounts';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {accountExpiryInput,parseAccountExpiry} from '@/lib/account-expiry';
import {baccaratStatus,memberDirectory,matchesFilter,sportsLabels,type BaccaratGrant,type Filter,type PlatformMember} from './directory';

const platformApi='/api/admin/baccarat/platform-members';
async function json(url:string,options:RequestInit) {
  const response=await fetch(url,{...options,cache:'no-store'});
  const data=await response.json();
  if(!response.ok) throw Error(data.error||'無法完成操作，請重新登入或稍後再試。');
  return data;
}
async function sportsList(signal:AbortSignal):Promise<Account[]> {
  const data=await json('/api/admin/accounts',{signal});
  if(!Array.isArray(data.accounts)) throw Error('體育名單暫時無法讀取。');
  return data.accounts;
}
async function baccaratList(signal:AbortSignal):Promise<PlatformMember[]> {
  const data=await json(platformApi,{signal});
  if(!data.available?.baccarat||!Array.isArray(data.members)) throw Error('百家樂名單暫時無法讀取。');
  return data.members;
}

function useDirectorySource<T>(read:(signal:AbortSignal)=>Promise<T[]>,poll:boolean) {
  const [data,setData]=useState<T[]>([]);
  const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
  const request=useRef<AbortController|null>(null);
  const reload=useCallback(async()=>{
    request.current?.abort();
    const controller=new AbortController();
    request.current=controller;
    try {
      const next=await read(controller.signal);
      if(!controller.signal.aborted){setData(next);setStatus('ready');}
    } catch {
      if(!controller.signal.aborted) setStatus('error');
    }
  },[read]);
  useEffect(()=>{
    void reload();
    const refresh=()=>{if(document.visibilityState==='visible') void reload();};
    const timer=poll?window.setInterval(refresh,15000):undefined;
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',refresh);
    return ()=>{
      window.clearInterval(timer);
      window.removeEventListener('focus',refresh);
      document.removeEventListener('visibilitychange',refresh);
      request.current?.abort();
    };
  },[reload,poll]);
  return {data,status,reload};
}

function BaccaratEditor({name,grant,onSaved}:{name:string;grant?:BaccaratGrant;onSaved:(message:string)=>Promise<void>}) {
  const [until,setUntil]=useState(accountExpiryInput(grant?.expiresAt??null));
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const state=baccaratStatus(grant);
  async function save(enabled:boolean) {
    setBusy(true);setMessage('');
    try {
      const expiresAt=until===accountExpiryInput(grant?.expiresAt??null)?grant?.expiresAt??null:parseAccountExpiry(until);
      if(enabled&&expiresAt!==null&&expiresAt<=Date.now()) throw Error('開通的到期時間必須晚於現在');
      await json(platformApi+'/baccarat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:name,enabled,expiresAt})});
      await onSaved('已儲存百家樂授權。');
    } catch(error) {setMessage(error instanceof Error?error.message:'儲存失敗');}
    finally {setBusy(false);}
  }
  return <div className="member-fields space-y-4">
    <p>{state} · DG、MT 共用此授權</p>
    <ExpiryFields label="百家樂" value={until} onChange={setUntil} disabled={busy}/>
    <div className="flex flex-wrap gap-2">
      <Button disabled={busy||(state==='已開通'&&until===accountExpiryInput(grant?.expiresAt??null))} onClick={()=>void save(true)}>{state==='已開通'?'儲存百家樂期限':'開通百家樂'}</Button>
      {grant?.enabled&&<Button variant="outline" disabled={busy} onClick={()=>void save(false)}>停用百家樂</Button>}
    </div>
    {message&&<p role="status">{message}</p>}
  </div>;
}

const tabs:ReadonlyArray<[Filter,string]>=[['all','全部會員'],['pending','體育待授權'],['active','體育已授權'],['inactive','體育停用／到期']];
const sourceLabel=(status:'loading'|'ready'|'error')=>status==='loading'?'讀取中…':'暫時無法讀取';

export default function MemberConsole() {
  const sports=useDirectorySource(sportsList,true);
  const baccarat=useDirectorySource(baccaratList,false);
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState<Filter>('all');
  const [selected,setSelected]=useState('');
  const [inputError,setInputError]=useState('');
  const [notice,setNotice]=useState({name:'',text:''});
  const editor=useRef<HTMLElement>(null);
  const members=useMemo(()=>memberDirectory(sports.data,baccarat.data),[sports.data,baccarat.data]);
  const query=search.trim().toLowerCase();
  const matches=members.filter(row=>matchesFilter(row,filter)&&(row.username.toLowerCase().includes(query)||row.sports.some(a=>a.note?.toLowerCase().includes(query))));
  const current=members.find(row=>row.username.toLowerCase()===selected.toLowerCase());
  const name=current?.username||selected;
  function choose(value:string) {
    setSelected(value);
    setInputError('');
    setNotice({name:'',text:''});
    requestAnimationFrame(()=>editor.current?.focus());
  }
  function lookup(event:FormEvent) {
    event.preventDefault();
    const value=search.trim();
    if (!value||/[\s\u0000-\u001f\u007f]/u.test(value)||value.length>128) {
      setInputError('請輸入完整會員帳號。');return;
    }
    choose(value);
  }
  function saved(text:string,reload:()=>Promise<void>) {
    setNotice({name,text});
    return reload();
  }
  return <>
    <div className="member-tools">
      <form onSubmit={lookup}>
        <label htmlFor="member-lookup">會員帳號或備註</label>
        <div className="member-search"><Input id="member-lookup" value={search} onChange={e=>{setSearch(e.target.value);setInputError('');}} placeholder="搜尋帳號或備註" autoComplete="off" maxLength={1000}/><Button disabled={!search.trim()}>查詢／開通帳號</Button></div>
        {inputError&&<p role="alert">{inputError}</p>}
      </form>
    </div>
    {selected&&<section className="member-detail" ref={editor} tabIndex={-1} aria-label={'管理會員 '+name}>
      <div className="member-heading"><h2>管理會員 · {name}</h2><Button variant="outline" onClick={()=>setSelected('')}>關閉明細</Button></div>
      <div className="member-products">
        <section><h3>百家樂授權</h3>
          {baccarat.status!=='ready'&&<p>{sourceLabel(baccarat.status)}</p>}
          {(baccarat.status==='ready'||current?.baccarat)&&<fieldset disabled={baccarat.status!=='ready'}>
            {name.length>80?<p>百家樂帳號最多 80 字元。</p>:<BaccaratEditor key={JSON.stringify([name,current?.baccarat])} name={name} grant={current?.baccarat} onSaved={text=>saved(text,baccarat.reload)}/>}
          </fieldset>}
        </section>
        <section><h3>體育授權</h3>
          {sports.status!=='ready'&&<p>{sourceLabel(sports.status)}</p>}
          <fieldset disabled={sports.status!=='ready'}>
            {current?.sports.length?current.sports.map(account=><div key={JSON.stringify([account.memberId||account.username,account.accessState,account.enabled,account.expiresAt])}>
              {current.sports.length>1&&<p>體育會員識別碼 · {account.memberId||'預先開通'}</p>}
              <AccountRow account={account} statusAvailable={sports.status==='ready'} onSaved={text=>void saved(text,sports.reload)}/>
            </div>):sports.status==='ready'&&<DirectApproval key={name} selectedUsername={name} onSaved={()=>void saved('已開通體育授權。',sports.reload)}/>}
          </fieldset>
        </section>
      </div>
      {notice.name===name&&<p role="status" className="mt-3 text-emerald-300">{notice.text}</p>}
    </section>}
    <div className="member-heading"><h2>會員名單</h2><Button variant="outline" onClick={()=>{void sports.reload();void baccarat.reload();}}>重新載入</Button></div>
    <div className="member-tabs" role="group" aria-label="會員名單篩選">{tabs.map(([value,label])=><button type="button" key={value} aria-pressed={filter===value} onClick={()=>setFilter(value)}>{label} <span>{(value==='all'&&(sports.status!=='ready'||baccarat.status!=='ready'))||(value!=='all'&&sports.status!=='ready')?'—':members.filter(row=>matchesFilter(row,value)).length}</span></button>)}</div>
    {sports.status==='error'&&<p role="alert">體育資料暫時無法讀取，請重新載入。</p>}
    {baccarat.status==='error'&&<p role="alert">百家樂資料暫時無法讀取，請重新載入。</p>}
    <div className="member-table-wrap"><table className="member-table"><thead><tr><th>會員帳號</th><th>百家樂</th><th>體育</th><th><span className="sr-only">操作</span></th></tr></thead>
      <tbody>{matches.map(row=><tr key={row.username.toLowerCase()}>
        <th scope="row">{row.username}</th>
        <td>{baccarat.status==='ready'?baccaratStatus(row.baccarat):sourceLabel(baccarat.status)}</td>
        <td>{sports.status==='ready'?(Array.from(new Set(row.sports.map(a=>sportsLabels[a.accessState]))).join('／')||'未開通'):sourceLabel(sports.status)}</td>
        <td><Button size="sm" variant="outline" aria-label={'管理 '+row.username} onClick={()=>choose(row.username)}>管理</Button></td>
      </tr>)}</tbody></table></div>
    {!matches.length&&<p className="member-empty">{sports.status==='loading'||baccarat.status==='loading'?'正在讀取會員名單…':sports.status==='error'||baccarat.status==='error'?'目前可讀取的資料中沒有符合的會員。':'沒有符合條件的會員。'}</p>}
    <p className="member-footnote">體育登入狀態每 15 秒更新。「登入中」表示登入仍有效。</p>
  </>;
}
