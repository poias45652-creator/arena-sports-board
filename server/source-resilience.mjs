/** Read only a bounded response body; cancel unused streams instead of retaining them. */
export async function readTextBounded(response,maxBytes=4_000_000) {
  if(Number(response.headers.get('content-length'))>maxBytes){await response.body?.cancel();throw Error('來源內容超出上限');}
  if(!response.body)return '';
  const reader=response.body.getReader(),decoder=new TextDecoder(),parts=[];let bytes=0,done=false;
  try{for(;;){const part=await reader.read();if(part.done){done=true;break;}
    bytes+=part.value.byteLength;if(bytes>maxBytes)throw Error('來源內容超出上限');
    parts.push(decoder.decode(part.value,{stream:true}));}
    parts.push(decoder.decode());return parts.join('');
  }finally{if(!done)await reader.cancel().catch(()=>{});reader.releaseLock();}
}
/** Concurrency is held until the response body has been consumed, not just until headers. */
export function createTaskGate(limit=4,maxQueue=32) {
  let active=0;const queue=[];
  const abortError=signal=>signal?.reason||new Error('來源請求已取消');
  function pump(){while(active<limit&&queue.length){const entry=queue.shift();entry.signal?.removeEventListener('abort',entry.abort);
    if(entry.signal?.aborted){entry.reject(abortError(entry.signal));continue;}active++;entry.resolve();}}
  return async function run(task,signal){
    if(signal?.aborted)throw abortError(signal);
    if(active>=limit&&queue.length>=maxQueue)throw Error('來源更新繁忙，請稍後重試');
    await new Promise((resolve,reject)=>{const entry={resolve,reject,signal,abort:null};
      entry.abort=()=>{const i=queue.indexOf(entry);if(i>=0){queue.splice(i,1);reject(abortError(signal));}};
      signal?.addEventListener('abort',entry.abort,{once:true});queue.push(entry);pump();});
    try{if(signal?.aborted)throw abortError(signal);return await task();}
    finally{active--;pump();}
  };
}
/** Normal public requests only. Respect denial/rate limits; never bypass access challenges. */
export function createPublicTextSource({origin='',label='來源',fetcher=fetch,now=Date.now,timeoutMs=10000,
  maxBytes=4_000_000,maxConcurrent=3,maxPending=32,cooldownMs=900000}={}) {
  const gate=createTaskGate(maxConcurrent,maxPending),pending=new Map();let blockedUntil=0,reason='';
  function check(){if(now()<blockedUntil)throw Error(reason+'（暫停重試）');}
  async function read(url){
    const target=new URL(url);
    if(target.origin!==origin||target.protocol!=='https:'||target.username||target.password)throw Error('來源網址不符');
    check();if(pending.has(target.href))return pending.get(target.href);
    if(pending.size>=maxPending)throw Error('來源更新繁忙，請稍後重試');
    const signal=AbortSignal.timeout(timeoutMs);
    const task=gate(async()=>{
      check();const response=await fetcher(target.href,{redirect:'manual',cache:'no-store',
        headers:{Accept:'text/html','User-Agent':'ArenaSportsBoard/1.0'},signal});
      if(!response.ok){
        const message=`${label} HTTP ${response.status}`;
        if([403,429,503].includes(response.status)){
          const retry=response.headers.get('retry-after');
          const retryMs=retry&&/^\d+$/.test(retry)?Number(retry)*1000:retry?Date.parse(retry)-now():0;
          blockedUntil=now()+Math.max(cooldownMs,Number.isFinite(retryMs)?Math.min(3600000,Math.max(0,retryMs)):0);reason=message;
        }
        await response.body?.cancel();throw Error(message);
      }
      const html=await readTextBounded(response,maxBytes);
      if(/cf-chl-|challenge-platform|<title>Just a moment/i.test(html)){
        blockedUntil=now()+cooldownMs;reason=`${label} 來源要求驗證`;throw Error(reason);
      }
      return html;
    },signal).finally(()=>pending.delete(target.href));pending.set(target.href,task);return task;
  }
  return read;
}
