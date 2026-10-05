// Server-side cache for public NBA calculations only. Authentication and member
// markets remain in their existing routes and are never stored here.
export function createNbaAnalysisCache<T>({ttl=60000,maxEntries=64,maxPending=32,clock=()=>Date.now()}:{ttl?:number;maxEntries?:number;maxPending?:number;clock?:()=>number}={}){
 if(!Number.isFinite(ttl)||ttl<=0||!Number.isInteger(maxEntries)||maxEntries<1||!Number.isInteger(maxPending)||maxPending<1)throw Error('Invalid analysis cache limits');
 const values=new Map<string,{value:T;created:number;expires:number}>(),pending=new Map<string,Promise<T>>();
 function prune(){const now=clock();for(const [key,row] of values)if(row.expires<=now||row.created>now)values.delete(key);}
 async function read(key:string,load:()=>Promise<T>,valid:(value:T)=>boolean):Promise<{value:T;cache:'hit'|'shared'|'miss'}>{
  prune();const hit=values.get(key);
  if(hit){if(valid(hit.value)){values.delete(key);values.set(key,hit);return {value:structuredClone(hit.value),cache:'hit'};}values.delete(key);}
  const running=pending.get(key);
  if(running)return {value:structuredClone(await running),cache:'shared'};
  if(pending.size>=maxPending)throw Error('NBA 分析更新忙碌中，請稍後重試。');
  const task=Promise.resolve().then(load).then(value=>{
   // Waiting, failed or invalid reports are not retained as a successful pick.
   if(valid(value)){
    prune();while(values.size>=maxEntries)values.delete(values.keys().next().value!);
    const created=clock();values.set(key,{value:structuredClone(value),created,expires:created+ttl});
   }
   return value;
  });
  pending.set(key,task);
  try{return {value:structuredClone(await task),cache:'miss'};}
  finally{if(pending.get(key)===task)pending.delete(key);}
 }
 return {read,sizes:()=>{prune();return {entries:values.size,pending:pending.size};}};
}
