'use client';
import {useState,type FormEvent} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {ExpiryFields} from '../../accounts';
import {parseAccountExpiry} from '@/lib/account-expiry';
import {baccaratStatus,profileGrant,type AgentGroup,type BaccaratProfile} from './directory';

export type Edit = (path:string,method:'POST'|'PATCH'|'DELETE',body:Record<string,unknown>,message:string)=>Promise<boolean>;
export const groupKey=(p:BaccaratProfile)=>p.agent_group_id==null?'':String(p.agent_group_id);
const dateFormat=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
const dateText=(value:string|null,empty:string)=>value?dateFormat.format(new Date(value)):empty;

export function NewBaccaratMember({initial,edit,done,busy}:{initial:string;edit:Edit;done:(name:string)=>void;busy:boolean}) {
  const [expiry,setExpiry]=useState('');
  const [error,setError]=useState('');
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    const tzAccount=String(form.get('account')||'').trim();
    if(!tzAccount){setError('請輸入會員帳號。');return;}
    try{
      const until=parseAccountExpiry(expiry);
      if(until!==null&&until<=Date.now())throw Error('到期時間必須晚於現在。');
      setError('');
      if(await edit('users','POST',{tzAccount,displayName:form.get('displayName'),notes:form.get('notes'),expiresAt:until===null?null:new Date(until).toISOString()},'已建立百家樂會員。'))done(tzAccount);
    }catch(e){setError(e instanceof Error?e.message:'建立失敗');}
  }
  return <form className="member-create" onSubmit={submit}><fieldset disabled={busy}>
    <label>百家會員帳號<Input name="account" defaultValue={initial} maxLength={80} required autoComplete="off"/></label>
    <label>顯示名稱<Input name="displayName" maxLength={120}/></label>
    <label>百家備註<Input name="notes" maxLength={200}/></label>
    <ExpiryFields label="新增百家會員" value={expiry} onChange={setExpiry} disabled={busy}/>
    <Button type="submit">建立百家會員</Button>{error&&<p role="alert">{error}</p>}
  </fieldset></form>;
}

export function AgentBoard({profiles,groups,choose,edit,disabled,ready}:{profiles:BaccaratProfile[];groups:AgentGroup[];choose:(name:string)=>void;edit:Edit;disabled:boolean;ready:boolean}){
  const [renaming,setRenaming]=useState('');
  async function rename(e:FormEvent<HTMLFormElement>,id:string){
    e.preventDefault();const name=String(new FormData(e.currentTarget).get('name')||'').trim();
    if(name&&await edit('agents/'+id,'PATCH',{name},'已更新代理名稱。'))setRenaming('');
  }
  if(!ready)return null;
  return <details className="member-agents" open><summary>百家代理分組</summary>
    <div className="member-group-grid">{[{id:'',name:'尚未分組'},...groups].map(group=>{
      const id=String(group.id),rows=profiles.filter(p=>groupKey(p)===id);
      return <details className="member-group" key={id} open onDragOver={e=>{if(!disabled&&e.dataTransfer.types.includes('application/x-member-id'))e.preventDefault();}} onDrop={e=>{
        e.preventDefault();if(disabled)return;const userId=e.dataTransfer.getData('application/x-member-id');
        const user=profiles.find(p=>String(p.id)===userId);if(user&&groupKey(user)!==id)void edit('users/'+userId+'/agent','PATCH',{agentGroupId:id||null},'已移動百家會員。');
      }}><summary>{group.name}（{rows.length}）</summary>
      {id&&(renaming===id?<form onSubmit={e=>void rename(e,id)}><Input name="name" aria-label="代理新名稱" defaultValue={group.name} required maxLength={100}/><Button size="sm" disabled={disabled}>儲存名稱</Button><button type="button" onClick={()=>setRenaming('')}>取消</button></form>:
        <button className="member-text-btn" type="button" disabled={disabled} onClick={()=>setRenaming(id)}>更名</button>)}
      <div className="member-chips">{rows.map(p=><button key={p.id} type="button" draggable={!disabled} onDragStart={e=>e.dataTransfer.setData('application/x-member-id',String(p.id))} onClick={()=>choose(p.tz_account)}>{p.tz_account}</button>)}</div>
      </details>;
    })}</div>
  </details>;
}

export function ProfileFacts({p}:{p:BaccaratProfile}){
  return <dl className="member-facts">
    <div><dt>顯示名稱</dt><dd>{p.display_name||'—'}</dd></div><div><dt>百家備註</dt><dd>{p.notes||'—'}</dd></div>
    <div><dt>建立時間</dt><dd>{dateText(p.created_at,'—')}</dd></div><div><dt>使用至</dt><dd>{dateText(p.expires_at,'不限期')}</dd></div>
    <div><dt>最後登入</dt><dd>{dateText(p.last_login_at,'尚無紀錄')}</dd></div><div><dt>百家登入狀態</dt><dd>{p.is_online?'在線':'離線'}</dd></div>
  </dl>;
}
export function ProfileActions({p,groups,groupsReady,edit,multiple}:{p:BaccaratProfile;groups:AgentGroup[];groupsReady:boolean;edit:Edit;multiple:boolean}){
  const [confirm,setConfirm]=useState('');
  return <div className="member-profile">
    {multiple&&<p>{p.tz_account} · {baccaratStatus(profileGrant(p))} · 編號 {p.id}</p>}
    <ProfileFacts p={p}/>
    <label>代理分組 <select aria-label={p.tz_account+' 代理分組'} value={groupKey(p)} disabled={!groupsReady} onChange={e=>void edit('users/'+p.id+'/agent','PATCH',{agentGroupId:e.target.value||null},'已更新代理分組。')}>
      <option value="">尚未分組</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}
    </select></label>
    <div className="member-quick"><span>延長期限</span>{[7,30,90].map(days=><Button key={days} size="sm" variant="outline" onClick={()=>void edit('users/'+p.id+'/extend','POST',{days},'已延長 '+days+' 天。')}>＋{days} 天</Button>)}
    {(multiple||(p.status==='suspended'&&p.expires_at&&Date.parse(p.expires_at)<=Date.now()))&&<Button variant="outline" onClick={()=>void edit('users/'+p.id+'/status','POST',{status:p.status==='active'?'suspended':'active'},'已更新百家狀態。')}>{p.status==='active'?'停用百家樂':'恢復百家樂'}</Button>}</div>
    <details className="member-delete"><summary>刪除百家會員</summary>
      <label>輸入完整帳號以永久刪除百家資料與登入紀錄<Input aria-label="確認刪除百家帳號" value={confirm} onChange={e=>setConfirm(e.target.value)} autoComplete="off"/></label>
      <Button variant="destructive" disabled={confirm!==p.tz_account} onClick={()=>void edit('users/'+p.id,'DELETE',{confirmDelete:true,tzAccount:confirm},'已刪除百家會員。')}>確認刪除百家會員</Button>
    </details>
  </div>;
}
