const hosts=new Set(['hr9988.net','www.hr9988.net','m.hr9988.net','sp1788.net','m.sp1788.net']);
/** OFA navigates game_url when game_post is empty; game_method is optional. */
export function superLaunchIsGet(data:unknown):boolean{
 if(!data||typeof data!=='object'||Array.isArray(data))return false;
 const {game_method:method,game_post:post}=data as Record<string,unknown>;
 if(method!=null&&(typeof method!=='string'||!['','GET'].includes(method.trim().toUpperCase())))return false;
 // Do not silently discard form fields or turn a POST launch into a GET.
 return post==null||(typeof post==='object'&&!Array.isArray(post)&&Object.keys(post).length===0);
}

/** Safe shape-only diagnostics: never log URLs, tickets, tokens, or source text. */
export function superLaunchShape(data:unknown){
 const d=data&&typeof data==='object'?data as Record<string,unknown>:{};
 return {method:d.game_method==null?'absent':typeof d.game_method==='string'&&/^(GET|POST)$/i.test(d.game_method.trim())?d.game_method.trim().toUpperCase():'other',hasUrl:typeof d.game_url==='string'&&d.game_url.length>0,hasPost:!!d.game_post&&typeof d.game_post==='object'&&Object.keys(d.game_post).length>0};
}
export function superEntryUrl(value:unknown):string|null{
 if(typeof value!=='string'||value.length>4096)return null;
 try{const u=new URL(value),[route,query,...extra]=u.hash.slice(1).split('?'),p=new URLSearchParams(query);
  if(u.protocol!=='https:'||!hosts.has(u.hostname)||u.port||u.username||u.password||u.pathname!=='/'||u.search||route!=='/APILogin'||extra.length||[...p.keys()].length!==1||!p.has('MemID')||!/^[a-f0-9]{32}$/i.test(p.get('MemID')||''))return null;
  return u.href;
 }catch{return null;}
}

export function superDeviceEntryUrl(value:unknown,mobile:boolean):string|null{
 const valid=superEntryUrl(value);if(!valid)return null;
 const url=new URL(valid);const ofa=url.hostname==='sp1788.net'||url.hostname==='m.sp1788.net';url.hostname=ofa?(mobile?'m.sp1788.net':'sp1788.net'):(mobile?'m.hr9988.net':'hr9988.net');return url.href;
}
