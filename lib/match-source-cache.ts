// Share successful public requests across fixtures and back off briefly after failures.
export function cachedMatchSource<T>(load:(key:string)=>Promise<T>, ttl:number){
  const cache=new Map<string,{expires:number; request:Promise<T>}>();
  return (key:string)=>{
    const hit=cache.get(key);
    if(hit&&hit.expires>Date.now())return hit.request;
    const entry={expires:Date.now()+ttl,request:load(key)};
    entry.request.catch(()=>{entry.expires=Date.now()+30000;});
    if(cache.size>=128)cache.delete(cache.keys().next().value!);
    cache.set(key,entry);
    return entry.request;
  };
}
export async function matchSourceText(url:string,limit:number){
  const r=await fetch(url,{cache:'no-store',headers:{'User-Agent':'Mozilla/5.0 (compatible; sports match analysis)'},signal:AbortSignal.timeout(12000)});
  if(!r.ok)throw Error('賽前資料來源暫時無法讀取');
  const body=await r.text();
  if(body.length>limit)throw Error('賽前來源資料過大');
  return body;
}
