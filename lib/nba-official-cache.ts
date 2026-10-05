// Retain only the public fields consumed by the NBA parsers. Advertising,
// navigation and unrelated page hydration are not part of a player profile.
export function compactNbaPage(data:any,path:string){
 const props=data?.props?.pageProps;
 if(!props||typeof props!=='object')throw Error('NBA 官網資料格式錯誤');
 const select=(value:any,keys:string[])=>value&&typeof value==='object'?Object.fromEntries(keys.filter(k=>Object.hasOwn(value,k)).map(k=>[k,value[k]])):value;
 if(path==='players')return {props:{pageProps:{players:props.players}}};
 if(path.startsWith('team/'))return {props:{pageProps:{team:select(props.team,['id','info','roster','background','ranks','awards','fantasyNews'])}}};
 if(path.startsWith('player/'))return {props:{pageProps:{player:select(props.player,['info','stats','gameLogs','awards','latestNews'])}}};
 throw Error('NBA 官網路徑錯誤');
}
export function createNbaPageCache({maxEntries=160,maxBytes=12*1024*1024,ttl=15*60000,clock=()=>Date.now()}:{maxEntries?:number;maxBytes?:number;ttl?:number;clock?:()=>number}={}){
 if(!Number.isInteger(maxEntries)||maxEntries<1||!Number.isInteger(maxBytes)||maxBytes<1||!Number.isFinite(ttl)||ttl<=0)throw Error('Invalid NBA page cache limits');
 const rows=new Map<string,{data:any;bytes:number;created:number;until:number}>();let bytes=0;
 const remove=(key:string)=>{const row=rows.get(key);if(row){bytes-=row.bytes;rows.delete(key);}};
 const prune=()=>{const now=clock();for(const [key,row] of rows)if(row.until<=now||row.created>now)remove(key);};
 return {
  get(key:string){prune();const row=rows.get(key);if(!row)return undefined;rows.delete(key);rows.set(key,row);return row.data;},
  set(key:string,data:any){
   prune();remove(key);const size=Buffer.byteLength(JSON.stringify(data),'utf8');
   // A single large public response remains usable without pinning it in RAM.
   if(size>maxBytes)return false;
   while(rows.size>=maxEntries||bytes+size>maxBytes)remove(rows.keys().next().value!);
   const created=clock();rows.set(key,{data,bytes:size,created,until:created+ttl});bytes+=size;return true;
  },
  stats(){prune();return {entries:rows.size,bytes};}
 };
}
