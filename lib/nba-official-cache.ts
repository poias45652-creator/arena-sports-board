import {readNbaSeed,recordNbaSeed} from './nba-public-cache-seed';
// Retain only fields consumed by NBA parsers, never advertising or navigation.
export function compactNbaPage(data:any,path:string){
 const props=data?.props?.pageProps;
 if(!props||typeof props!=='object')throw Error('NBA 官網資料格式錯誤');
 const select=(value:any,keys:string[])=>value&&typeof value==='object'?Object.fromEntries(keys.filter(k=>Object.hasOwn(value,k)).map(k=>[k,value[k]])):value;
 if(path==='players')return {props:{pageProps:{players:props.players}}};
 if(path.startsWith('team/'))return {props:{pageProps:{team:select(props.team,['id','info','roster','background','ranks','awards','fantasyNews'])}}};
 if(path.startsWith('player/'))return {props:{pageProps:{player:select(props.player,['info','stats','gameLogs','awards','latestNews'])}}};
 throw Error('NBA 官網路徑錯誤');
}
export function createNbaPageCache({maxEntries=512,maxBytes=12*1024*1024,ttl=15*60000,clock=()=>Date.now()}:{maxEntries?:number;maxBytes?:number;ttl?:number;clock?:()=>number}={}){
 if(!Number.isInteger(maxEntries)||maxEntries<1||!Number.isInteger(maxBytes)||maxBytes<1||!Number.isFinite(ttl)||ttl<=0)throw Error('Invalid NBA page cache limits');
 const rows=new Map<string,{data:any;bytes:number;created:number;until:number}>();let bytes=0;
 const remove=(key:string)=>{const row=rows.get(key);if(row){bytes-=row.bytes;rows.delete(key);}};
 const prune=()=>{const now=clock();for(const [key,row] of rows)if(row.until<=now||row.created>now)remove(key);};
 function store(key:string,data:any,created:number){
  prune();remove(key);const size=Buffer.byteLength(JSON.stringify(data),'utf8');
  if(size>maxBytes||created>clock()||created+ttl<=clock())return false;
  while(rows.size>=maxEntries||bytes+size>maxBytes)remove(rows.keys().next().value!);
  rows.set(key,{data,bytes:size,created,until:created+ttl});bytes+=size;return true;
 }
 return {
  get(key:string){
   prune();let row=rows.get(key);
   if(!row){const seed=readNbaSeed('official',key,Math.min(ttl,15*60000));if(seed){try{store(key,compactNbaPage(seed.data,key),seed.capturedAt);row=rows.get(key);}catch{}}}
   if(!row)return undefined;rows.delete(key);rows.set(key,row);return row.data;
  },
  set(key:string,data:any){const created=clock();recordNbaSeed('official',key,data,created);return store(key,data,created);},
  stats(){prune();return {entries:rows.size,bytes};}
 };
}
