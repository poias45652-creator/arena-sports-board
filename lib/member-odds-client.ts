// All league panels use the same private snapshot. Share only the in-flight
// request; never cache it across sign-ins or change its source timestamp.
export function createMemberOddsReader(fetcher:typeof fetch=(...args)=>fetch(...args),wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms))){
 let pending:Promise<any>|null=null;
 return function read(){
  if(pending)return pending;
  const task=(async()=>{
   for(let attempt=0;;attempt++){
    const response=await fetcher('/api/member-odds',{cache:'no-store',signal:AbortSignal.timeout(30000)});
    const body=await response.json();
    if(!response.ok&&body.code==='connection_busy'&&attempt<4){await wait(1000);continue;}
    if(!response.ok||body.error)throw new Error(body.error||'盤口來源暫時無法連線');
    return body;
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
