const hosts=new Set(['hr9988.net','www.hr9988.net','m.hr9988.net','sp1788.net']);
export function superEntryUrl(value:unknown):string|null{
 if(typeof value!=='string'||value.length>4096)return null;
 try{const u=new URL(value),[route,query,...extra]=u.hash.slice(1).split('?'),p=new URLSearchParams(query);
  if(u.protocol!=='https:'||!hosts.has(u.hostname)||u.port||u.username||u.password||u.pathname!=='/'||u.search||route!=='/APILogin'||extra.length||[...p.keys()].length!==1||!p.has('MemID')||!/^[a-f0-9]{32}$/i.test(p.get('MemID')||''))return null;
  return u.href;
 }catch{return null;}
}

export function superDeviceEntryUrl(value:unknown,mobile:boolean):string|null{
 const valid=superEntryUrl(value);if(!valid)return null;
 const url=new URL(valid);if(url.hostname==='sp1788.net')return url.href;url.hostname=mobile?'m.hr9988.net':'hr9988.net';return url.href;
}
