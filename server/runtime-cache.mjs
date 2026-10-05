/** Bounded, expiring application caches. Expired data is never relabelled as fresh. */
export function createBoundedCache({maxEntries=80,maxBytes=16*1024*1024,now=Date.now,
  sizeOf=value=>2*JSON.stringify(value).length}={}) {
  if(!Number.isInteger(maxEntries)||maxEntries<1||!Number.isFinite(maxBytes)||maxBytes<1)throw Error('Invalid cache capacity');
  const entries=new Map();let bytes=0;
  function remove(key){const old=entries.get(key);if(old){bytes-=old.bytes;entries.delete(key);}}
  function prune(){for(const [key,entry] of entries)if(entry.until<=now())remove(key);}
  return {
    get(key){prune();const entry=entries.get(key);if(!entry)return undefined;entries.delete(key);entries.set(key,entry);return entry.value;},
    set(key,value,ttl){prune();remove(key);const size=sizeOf(value)+2*String(key).length;
      if(!Number.isFinite(size)||size<0||size>maxBytes||ttl<=0)return false;
      while(entries.size>=maxEntries||bytes+size>maxBytes)remove(entries.keys().next().value);
      entries.set(key,{value,bytes:size,until:now()+ttl});bytes+=size;return true;},
    snapshot(){prune();return {entries:entries.size,bytes,maxEntries,maxBytes};}
  };
}
export function createRequestCache({maxPending=32,...options}={}) {
  const cache=createBoundedCache(options),pending=new Map();
  async function get(key,ttl,fetcher){
    const previous=cache.get(key);if(previous!==undefined)return previous;
    if(pending.has(key))return pending.get(key);
    if(pending.size>=maxPending)throw Error('資料更新繁忙，請稍後重試');
    // The upstream task owns its timeout. One disconnected visitor must not cancel everyone.
    const task=Promise.resolve().then(fetcher).then(value=>{cache.set(key,value,ttl);return value;})
      .finally(()=>pending.delete(key));pending.set(key,task);return task;
  }
  return {get,snapshot:()=>({...cache.snapshot(),pending:pending.size})};
}
