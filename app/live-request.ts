'use client';
type Pending={controller:AbortController;promise:Promise<any>;readers:number;settled:boolean};
const pending=new Map<string,Pending>();
const recent=new Map<string,{value:any;expires:number}>();
function normalize(url:string){
 const parsed=new URL(url,'https://yj.local');
 if(parsed.origin!=='https://yj.local')throw new Error('不支援的賽事資料來源');
 parsed.searchParams.sort();
 return parsed.pathname+'?'+parsed.searchParams.toString();
}
function reusable(url:string){
 const parsed=new URL(url,'https://yj.local');
 return parsed.pathname==='/api/football'&&!parsed.searchParams.has('kind')||
  parsed.pathname==='/api/international-live';
}
export function liveRequest(url:string,signal:AbortSignal):Promise<any>{
 if(signal.aborted)return Promise.reject(signal.reason||new DOMException('Aborted','AbortError'));
 const key=normalize(url),now=Date.now();
 for(const [old,entry] of recent)if(entry.expires<=now)recent.delete(old);
 const hit=recent.get(key);
 if(reusable(url)&&hit)return Promise.resolve(hit.value);
 let entry=pending.get(key);
 if(!entry){
  const controller=new AbortController();
  entry={controller,promise:Promise.resolve(),readers:0,settled:false};const current=entry;
  const timer=setTimeout(()=>controller.abort(new Error('更新逾時，請稍後重試。')),55000);
  current.promise=(async()=>{
   const response=await fetch(url,{cache:'no-store',signal:controller.signal});
   const value=await response.json();
   if(response.status===401){window.location.assign('/login');throw Error('請重新登入');}
   if(!response.ok)throw Object.assign(new Error(value.error||'賽事資料更新失敗'),{status:response.status});
   if(reusable(url)&&!controller.signal.aborted&&!value.error&&!value.stale){
    if(recent.size>=24)recent.delete(recent.keys().next().value!);
    recent.set(key,{value,expires:Date.now()+1000});
   }
   return value;
  })().finally(()=>{current.settled=true;clearTimeout(timer);if(pending.get(key)===current)pending.delete(key);});
  pending.set(key,current);
 }
 const current=entry;current.readers++;
 return new Promise((resolve,reject)=>{
  let done=false;
  const finish=()=>{
   if(done)return false;done=true;signal.removeEventListener('abort',abort);current.readers--;
   if(!current.readers&&!current.settled){if(pending.get(key)===current)pending.delete(key);current.controller.abort();}
   return true;
  };
  const abort=()=>{if(finish())reject(signal.reason||new DOMException('Aborted','AbortError'));};
  signal.addEventListener('abort',abort,{once:true});
  current.promise.then(value=>{if(finish())resolve(value);},error=>{if(finish())reject(error);});
  if(signal.aborted)abort();
 });
}
