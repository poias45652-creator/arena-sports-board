import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import * as directory from '../app/admin/baccarat/members/directory.ts';
import {accountExpiryInput,parseAccountExpiry} from '../lib/account-expiry.ts';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function mount(name, file='app/admin/accounts.tsx'){
 const slots=[],effects=[];let cursor=0;
 const hooks={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},
  useRef(initial){const i=cursor++;return slots[i]??={current:initial};},
  useMemo(fn){cursor++;return fn();},
  useCallback(fn){cursor++;return fn;},
  useEffect(run,deps){const i=cursor++,old=slots[i];if(!old||deps.some((value,j)=>value!==old.deps[j])){slots[i]={deps,cleanup:old?.cleanup};effects.push(()=>{slots[i].cleanup?.();slots[i].cleanup=run();});}}
 };
 const component=tag=>function Element(props){return React.createElement(tag,props);};
 const deps={react:hooks,'@/components/ui/button':{Button:component('button')},'@/components/ui/input':{Input:component('input')},'@/components/ui/textarea':{Textarea:component('textarea')},'@/components/ui/switch':{Switch:component('button')},'@/lib/account-expiry':{accountExpiryInput,parseAccountExpiry},'@/components/ui/alert-dialog':Object.fromEntries(['AlertDialog','AlertDialogTrigger','AlertDialogContent','AlertDialogHeader','AlertDialogTitle','AlertDialogDescription','AlertDialogFooter','AlertDialogCancel','AlertDialogAction'].map(key=>[key,component('div')]))};
 Object.assign(deps,{'./directory':directory,'./profile-tools':{...Object.fromEntries(['AgentBoard','NewBaccaratMember','ProfileFacts','ProfileActions'].map(key=>[key,component(key)])),groupKey:p=>String(p.agent_group_id??'')},'../../accounts':Object.fromEntries(['AccountRow','ExpiryFields','DirectApproval'].map(key=>[key,component(key)]))});
 const code=ts.transpileModule(readFileSync(file,'utf8'),{fileName:'accounts.tsx',compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports','React',code+(file.endsWith('console.tsx')?'\nexports.BaccaratEditor=BaccaratEditor;':''))(key=>{assert.ok(deps[key],key);return deps[key];},exports,React);
 return {render(props={}){cursor=0;const tree=exports[name](props);effects.splice(0).forEach(fn=>fn());return tree;},dispose(){for(const slot of slots)slot?.cleanup?.();}};
}
function elements(tree,predicate){if(!tree||typeof tree!=='object')return [];if(Array.isArray(tree))return tree.flatMap(child=>elements(child,predicate));return [...(predicate(tree)?[tree]:[]),...elements(tree.props?.children,predicate)];}
const byLabel=(tree,label)=>elements(tree,e=>e.props?.['aria-label']===label)[0];
const button=(tree,label)=>elements(tree,e=>e.props?.children===label&&typeof e.props?.onClick==='function')[0];
const base={memberId:'tz:2',username:'pending-test-user',enabled:0,expiresAt:null,lastLogin:null,signedIn:0,accessState:'pending',isAdmin:0,note:''};

test('note editing survives status refresh, saves independently, and targets verified or preapproved accounts',async t=>{
 for(const memberId of ['tz:2',null]){
  const row=mount('AccountRow'),account={...base,memberId};let saved=0,call;
  t.mock.method(globalThis,'fetch',async(url,options)=>{call={url,...options,body:JSON.parse(options.body)};return Response.json({ok:true});});
  const props={account,onSaved:()=>saved++,statusAvailable:true};
  byLabel(row.render(props),account.username+' 備註').props.onChange({target:{value:'週六聯絡客戶'}});
  const refreshed={...props,account:{...account,lastLogin:Date.now()}};
  assert.equal(byLabel(row.render(refreshed),account.username+' 備註').props.value,'週六聯絡客戶');
  button(row.render(refreshed),'儲存備註').props.onClick();await flush();
  assert.equal(saved,1);assert.equal(call.method,'PATCH');assert.deepEqual(call.body,{...(memberId?{memberId}:{pendingUsername:account.username}),note:'週六聯絡客戶'});
  row.dispose();
 }
});

test('direct account form submits username, Taiwan expiry with seconds and note, then selects the account',async t=>{
 const form=mount('DirectApproval');let sent,selected;
 t.mock.method(globalThis,'fetch',async(url,options)=>{sent={url,method:options.method,body:JSON.parse(options.body)};return Response.json({ok:true,username:'new-member',message:'帳號已開通'});});
 const props={selectedUsername:'new-member',onSaved:value=>selected=value};
 byLabel(form.render(props),'開通帳號備註').props.onChange({target:{value:'新客戶'}});
 elements(form.render(props),e=>e.type?.name==='ExpiryFields')[0].props.onChange('2099-12-30T12:34:56');
 form.render(props).props.onSubmit({preventDefault(){}});await flush();
 assert.equal(selected,'new-member');assert.deepEqual(sent,{url:'/api/admin/accounts',method:'POST',body:{username:'new-member',expiresAt:parseAccountExpiry('2099-12-30T12:34:56'),note:'新客戶'}});
 assert.equal(byLabel(form.render(props),'開通帳號備註').props.value,'');
 form.dispose();
});

test('failed direct grant keeps the entered account and note for correction',async t=>{
 const form=mount('DirectApproval'),props={selectedUsername:'existing-member',onSaved(){assert.fail('failed grant cannot select an account');}};
 t.mock.method(globalThis,'fetch',async()=>Response.json({error:'此帳號已開通，請從名單編輯期限或備註'},{status:409}));
 byLabel(form.render(props),'開通帳號備註').props.onChange({target:{value:'保留草稿'}});
 form.render(props).props.onSubmit({preventDefault(){}});await flush();
 const tree=form.render(props);assert.equal(byLabel(tree,'開通帳號備註').props.value,'保留草稿');assert.equal(elements(tree,e=>e.props?.role==='alert').length,1);form.dispose();
});

test('expiry controls preserve seconds and clear to an unlimited grant',()=>{
 const expiry=mount('ExpiryFields');let changed;
 const props={label:'新帳號',value:'2099-12-30T12:34:56',onChange:value=>changed=value,disabled:false};
 byLabel(expiry.render(props),'新帳號 到期秒（台灣）').props.onChange({target:{value:'07'}});assert.equal(changed,'2099-12-30T12:34:07');
 button(expiry.render(props),'不限期限').props.onClick();assert.equal(changed,'');expiry.dispose();
});

const consoleFile='app/admin/baccarat/members/console.tsx';
const readyBaccarat={enabled:true,expiresAt:null};
const profile=(id,name)=>({id:String(id),tz_account:name,status:'active',expires_at:null,created_at:'2026-11-01T00:00:00Z',last_login_at:null,is_online:false,display_name:null,notes:null,agent_group_id:null});

test('directory retains single-platform accounts, distinct sports identities, and original states',()=>{
 const sports=[base,{...base,memberId:'tz:3',username:base.username.toUpperCase(),enabled:1,accessState:'active',note:'獨立備註'},
   {...base,memberId:null,username:'pre-approved',accessState:'disabled'}];
 const rows=directory.memberDirectory(sports,[profile(10,base.username),profile(11,'table-only')]);
 assert.equal(rows.length,3);
 const both=rows.find(row=>row.username===base.username);
 assert.deepEqual(both.sports,sports.slice(0,2));assert.deepEqual(directory.profileGrant(both.profiles[0]),readyBaccarat);
 assert.ok(directory.matchesFilter(both,'pending'));assert.ok(directory.matchesFilter(both,'active'));
 assert.equal(rows.find(r=>directory.matchesFilter(r,'inactive')).username,'pre-approved');
 assert.equal(directory.baccaratStatus(undefined),'未開通');assert.equal(directory.baccaratStatus({...readyBaccarat,expiresAt:1}),'已到期');
});

test('one searchable directory uses independent sources and prevents writes to unavailable products',async t=>{
 const prevWindow=globalThis.window,prevDocument=globalThis.document,prevFrame=globalThis.requestAnimationFrame;
 globalThis.window=Object.assign(new EventTarget(),{setInterval:()=>0,clearInterval(){}});
 globalThis.document=Object.assign(new EventTarget(),{visibilityState:'visible'});
 globalThis.requestAnimationFrame=fn=>fn();
 let offline=false;const reads=[];
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  assert.equal(init.method,undefined);reads.push(url);
  if(url==='/api/admin/accounts') return Response.json({accounts:[{...base,note:'週六客戶'}]});
  if(url==='/api/admin/baccarat/agents')return Response.json({ok:true,groups:[]});
  assert.equal(url,'/api/admin/baccarat/users?directory=all');
  return Response.json({ok:!offline,stats:{total:2},users:[profile(10,base.username),profile(11,'table-only')]});
 });
 const view=mount('default',consoleFile);
 try{
  view.render();await flush();
  const search=elements(view.render(),e=>e.props?.id==='member-lookup')[0];
  search.props.onChange({target:{value:'週六客戶'}});
  assert.ok(byLabel(view.render(),'管理 '+base.username));assert.equal(byLabel(view.render(),'管理 table-only'),undefined);
  byLabel(view.render(),'管理 '+base.username).props.onClick();
  let tree=view.render();assert.equal(elements(tree,e=>e.props?.account?.memberId==='tz:2').length,1);
  assert.equal(elements(tree,e=>e.type?.name==='BaccaratEditor').length,1);
  offline=true;button(tree,'重新載入').props.onClick();await flush();tree=view.render();
  assert.equal(elements(tree,e=>e.props?.account?.memberId==='tz:2').length,1);
  assert.ok(elements(tree,e=>e.props?.role==='alert').length);assert.ok(reads.length>=4);
 }finally{view.dispose();globalThis.window=prevWindow;globalThis.document=prevDocument;globalThis.requestAnimationFrame=prevFrame;}
});

test('baccarat actions write only the selected product and preserve Taiwan expiry down to seconds',async t=>{
 const editor=mount('BaccaratEditor',consoleFile);const requests=[];let saved=0;
 t.mock.method(globalThis,'fetch',async(url,init)=>{requests.push({url,method:init.method,body:JSON.parse(init.body)});return Response.json({ok:true});});
 const props={name:'demo-member',grant:readyBaccarat,onSaved:async()=>{saved++;}};
 elements(editor.render(props),e=>e.props?.label==='百家樂')[0].props.onChange('2099-12-30T12:34:56');
 button(editor.render(props),'儲存百家樂期限').props.onClick();await flush();
 assert.deepEqual(requests,[{url:'/api/admin/baccarat/platform-members/baccarat',method:'POST',body:{username:'demo-member',enabled:true,expiresAt:parseAccountExpiry('2099-12-30T12:34:56')}}]);
 assert.equal(saved,1);editor.dispose();
});

test('unified member search, groups and filters retain both products and case-variant profile IDs',()=>{
 const primary={...profile(21,'Shared'),display_name:'陳先生',notes:'藍色',agent_group_id:'3',is_online:true};
 const second={...profile(22,'SHARED'),status:'suspended',expires_at:'2020-01-01T00:00:00Z'};
 const rows=directory.memberDirectory([{...base,username:'shared',note:'體育備註'}],[primary,second,profile(23,'OnlyTables')]);
 assert.equal(rows.length,2);
 const both=rows.find(x=>x.username==='Shared');
 assert.deepEqual(both.profiles.map(p=>p.id),['21','22']);assert.equal(both.sports.length,1);
 for(const text of ['陳先生','藍色','體育備註','shared'])assert.equal(directory.matchesSearch(both,text),true);
 for(const filter of ['all','table','normal','online','expired','suspended','pending'])assert.equal(directory.matchesFilter(both,filter),true);
 const isolated=rows.find(x=>x.username==='OnlyTables');
 assert.deepEqual(isolated.sports,[]);assert.equal(directory.matchesFilter(isolated,'pending'),false);
});
