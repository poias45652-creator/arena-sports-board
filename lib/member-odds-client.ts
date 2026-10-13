// All league panels use the same private snapshot. Share only the in-flight
// request; never cache it across sign-ins or change its source timestamp.
export class MemberOddsError extends Error{
 constructor(message:string,public retryable=false){super(message);}
}
export function memberOddsRequestError(error:unknown):MemberOddsError{
 if(error instanceof MemberOddsError)return error;
 if(error instanceof Error){
  if(error.name==='AbortError'||error.name==='TimeoutError')return new MemberOddsError('玩法資料請求逾時，稍後會自動重試。',true);
  if(error instanceof TypeError)return new MemberOddsError('玩法資料傳輸中斷，正在重新連線。',true);
  if(error instanceof SyntaxError)return new MemberOddsError('玩法資料回應不完整，請稍後重新取得。');
  if(error.message)return new MemberOddsError(error.message);
 }
 return new MemberOddsError('玩法資料暫時無法取得，請稍後重試。');
}
export function createMemberOddsReader(fetcher:typeof fetch=(...args)=>fetch(...args),wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms))){
 let pending:Promise<any>|null=null;
 return function read(){
  if(pending)return pending;
  const task=(async()=>{
   const signal=AbortSignal.timeout(70000);
   let busyRetries=0,transportRetries=0;
   for(;;){
    try{
     signal.throwIfAborted();
     const response=await fetcher('/api/member-odds',{cache:'no-store',signal});
     const transientStatus=[408,429,502,503,504].includes(response.status);
     let body:any;
     try{body=await response.json();}
     catch(error){
      // Render/proxy errors can contain HTML, while Safari can fail partway
      // through reading a response. Neither should strand all league panels.
      if(transientStatus)throw new MemberOddsError('玩法服務暫時無法回應，稍後會自動重試。',true);
      throw error;
     }
     if(!body||typeof body!=='object'||Array.isArray(body))throw new MemberOddsError('玩法來源回應格式異常，請稍後重試。');
     if(!response.ok&&body.code==='connection_busy'&&busyRetries++<4){await wait(1000);continue;}
     if(!response.ok||body.error){
      // Source authorization failures can also use HTTP 502. Only these
      // explicit temporary codes may retry; never reconnect or log in here.
      const retryable=body.code?['connection_busy','source_unreachable','source_unavailable','service_unavailable'].includes(body.code):transientStatus;
      throw new MemberOddsError(body.error||'玩法來源暫時無法連線',retryable);
     }
     return body;
    }catch(error){
     const failure=memberOddsRequestError(error);
     if(!failure.retryable||signal.aborted||busyRetries>4||transportRetries>=2)throw failure;
     await wait(750*2**transportRetries++);
    }
   }
  })();
  pending=task;
  void task.then(()=>{if(pending===task)pending=null;},()=>{if(pending===task)pending=null;});
  return task;
 };
}
export const readMemberOdds=createMemberOddsReader();
export function scopeMemberOdds(data:any,league:string|null){
 if(!league)return data;
 if(!['CPBL','NPB','KBO'].includes(league))throw new Error('不支援的聯盟');
 if(!Array.isArray(data.internationalGames))throw new Error('目前連線只回傳美棒盤口，請使用網站上方「立即更新」重新連接個人 SUPER。');
 return {...data,games:data.internationalGames.filter((g:any)=>g.league===league),internationalGames:undefined,league};
}
