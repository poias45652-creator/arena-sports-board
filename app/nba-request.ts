'use client';
type Pending={controller:AbortController;promise:Promise<any>;readers:number;settled:boolean};
const pending=new Map<string,Pending>();
const recent=new Map<string,{value:any;expires:number}>();
export function nbaRequest(url:string,signal:AbortSignal):Promise<any>{
 if(signal.aborted)return Promise.reject(signal.reason||new DOMException('Aborted','AbortError'));
 // The board and LIVE badge share a request, including near-simultaneous
 // mount/resume events. NBA and WNBA keep distinct URL keys.
 const schedule=/^\/api\/(?:nba|wnba)\?date=\d{4}-\d{2}-\d{2}$/.test(url),hit=recent.get(url);
 if(schedule&&hit&&hit.expires>Date.now())return Promise.resolve(hit.value);
 let entry=pending.get(url);
 if(!entry){
  const controller=new AbortController();
  entry={controller,promise:Promise.resolve(),readers:0,settled:false};const current=entry;
  const timer=setTimeout(()=>controller.abort(new Error('更新逾時，請稍後重試。')),url.includes('kind=analysis')?90000:55000);
  current.promise=(async()=>{
   const r=await fetch(url,{cache:'no-store',signal:controller.signal});
   if(r.status===401){window.location.assign('/login');throw Error('請重新登入');}
   const d=await r.json();if(!r.ok)throw Error(d.error||'籃球資料更新失敗');
   if(schedule&&!controller.signal.aborted){if(recent.size>=20)recent.delete(recent.keys().next().value!);recent.set(url,{value:d,expires:Date.now()+1000});}
   return d;
  })().finally(()=>{current.settled=true;clearTimeout(timer);if(pending.get(url)===current)pending.delete(url);});
  pending.set(url,current);
 }
 const current=entry;current.readers++;
 return new Promise((resolve,reject)=>{
  let done=false;
  const finish=()=>{
   if(done)return false;done=true;signal.removeEventListener('abort',abort);current.readers--;
   if(!current.readers&&!current.settled){if(pending.get(url)===current)pending.delete(url);current.controller.abort();}
   return true;
  };
  const abort=()=>{if(finish())reject(signal.reason||new DOMException('Aborted','AbortError'));};
  signal.addEventListener('abort',abort,{once:true});
  current.promise.then(value=>{if(finish())resolve(value);},error=>{if(finish())reject(error);});
  if(signal.aborted)abort();
 });
}
