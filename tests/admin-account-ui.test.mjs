import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {accountExpiryInput,parseAccountExpiry} from '../lib/account-expiry.ts';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function mount(name){
 const slots=[],effects=[];let cursor=0;
 const hooks={
  useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return [slots[i],next=>{slots[i]=typeof next==='function'?next(slots[i]):next;}];},
  useRef(initial){const i=cursor++;return slots[i]??={current:initial};},
  useCallback(fn){cursor++;return fn;},
  useEffect(run,deps){const i=cursor++,old=slots[i];if(!old||deps.some((value,j)=>value!==old.deps[j])){slots[i]={deps,cleanup:old?.cleanup};effects.push(()=>{slots[i].cleanup?.();slots[i].cleanup=run();});}}
 };
 const component=tag=>function Element(props){return React.createElement(tag,props);};
 const deps={react:hooks,'@/components/ui/button':{Button:component('button')},'@/components/ui/input':{Input:component('input')},'@/components/ui/textarea':{Textarea:component('textarea')},'@/components/ui/switch':{Switch:component('button')},'@/lib/account-expiry':{accountExpiryInput,parseAccountExpiry},'@/components/ui/alert-dialog':Object.fromEntries(['AlertDialog','AlertDialogTrigger','AlertDialogContent','AlertDialogHeader','AlertDialogTitle','AlertDialogDescription','AlertDialogFooter','AlertDialogCancel','AlertDialogAction'].map(key=>[key,component('div')]))};
 const code=ts.transpileModule(readFileSync('app/admin/accounts.tsx','utf8'),{fileName:'accounts.tsx',compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};new Function('require','exports','React',code+'\nexports.AccountRow=AccountRow;exports.DirectApproval=DirectApproval;exports.ExpiryFields=ExpiryFields;')(key=>{assert.ok(deps[key],key);return deps[key];},exports,React);
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
 const props={onSaved:value=>selected=value};
 byLabel(form.render(props),'直接開通帳號').props.onChange({target:{value:' new-member '}});
 byLabel(form.render(props),'開通帳號備註').props.onChange({target:{value:'新客戶'}});
 elements(form.render(props),e=>e.type?.name==='ExpiryFields')[0].props.onChange('2099-12-30T12:34:56');
 form.render(props).props.onSubmit({preventDefault(){}});await flush();
 assert.equal(selected,'new-member');assert.deepEqual(sent,{url:'/api/admin/accounts',method:'POST',body:{username:'new-member',expiresAt:parseAccountExpiry('2099-12-30T12:34:56'),note:'新客戶'}});
 assert.equal(byLabel(form.render(props),'直接開通帳號').props.value,'');assert.equal(byLabel(form.render(props),'開通帳號備註').props.value,'');
 form.dispose();
});

test('failed direct grant keeps the entered account and note for correction',async t=>{
 const form=mount('DirectApproval'),props={onSaved(){assert.fail('failed grant cannot select an account');}};
 t.mock.method(globalThis,'fetch',async()=>Response.json({error:'此帳號已開通，請從名單編輯期限或備註'},{status:409}));
 byLabel(form.render(props),'直接開通帳號').props.onChange({target:{value:'existing-member'}});
 byLabel(form.render(props),'開通帳號備註').props.onChange({target:{value:'保留草稿'}});
 form.render(props).props.onSubmit({preventDefault(){}});await flush();
 const tree=form.render(props);assert.equal(byLabel(tree,'直接開通帳號').props.value,'existing-member');assert.equal(byLabel(tree,'開通帳號備註').props.value,'保留草稿');assert.equal(elements(tree,e=>e.props?.role==='alert').length,1);form.dispose();
});

test('expiry controls preserve seconds and clear to an unlimited grant',()=>{
 const expiry=mount('ExpiryFields');let changed;
 const props={label:'新帳號',value:'2099-12-30T12:34:56',onChange:value=>changed=value,disabled:false};
 byLabel(expiry.render(props),'新帳號 到期秒（台灣）').props.onChange({target:{value:'07'}});assert.equal(changed,'2099-12-30T12:34:07');
 button(expiry.render(props),'不限期限').props.onClick();assert.equal(changed,'');expiry.dispose();
});

test('list search includes notes and successful direct grant opens the authorized tab',async t=>{
 const previousWindow=globalThis.window,previousDocument=globalThis.document;
 globalThis.window=new EventTarget();globalThis.document=new EventTarget();globalThis.document.visibilityState='visible';
 t.mock.method(globalThis,'setInterval',()=>0);t.mock.method(globalThis,'clearInterval',()=>{});
 const rows=[{...base,note:'小陳'}, {...base,memberId:null,username:'new-member',enabled:1,accessState:'active',note:'週六客戶'}];
 t.mock.method(globalThis,'fetch',async()=>Response.json({accounts:rows}));
 const view=mount('default');
 try{
  view.render();await flush();
  byLabel(view.render(),'搜尋帳號或備註').props.onChange({target:{value:'小陳'}});
  assert.equal(elements(view.render(),e=>e.type?.name==='AccountRow')[0].props.account.username,'pending-test-user');
  elements(view.render(),e=>e.type?.name==='DirectApproval')[0].props.onSaved('new-member');await flush();
  const tree=view.render();assert.equal(elements(tree,e=>e.type?.name==='AccountRow')[0].props.account.username,'new-member');
  byLabel(tree,'搜尋帳號或備註').props.onChange({target:{value:'週六客戶'}});assert.equal(elements(view.render(),e=>e.type?.name==='AccountRow').length,1);
 }finally{view.dispose();globalThis.window=previousWindow;globalThis.document=previousDocument;}
});
