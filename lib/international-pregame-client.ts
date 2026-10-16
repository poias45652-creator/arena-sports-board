/** A failed mobile request must recover without waiting for the five-minute refresh. */
export class PregameRequestError extends Error {
 constructor(message:string,public status=0){super(message);}
}
export async function requestPregame(league:string,date:string,signal:AbortSignal,stored=false,fetcher:typeof fetch=fetch){
 const controller=new AbortController(),abort=()=>controller.abort();
 if(signal.aborted)controller.abort();else signal.addEventListener('abort',abort,{once:true});
 const timeout=setTimeout(abort,stored?5000:45000);
 try{
  const response=await fetcher(`/api/international?kind=${league.toLowerCase()}-pregame&date=${encodeURIComponent(date)}${stored?'&mode=stored':''}`,{cache:'no-store',signal:controller.signal});
  if(response.status===401||response.status===403)throw new PregameRequestError('請重新登入',response.status);
  if(!response.ok)throw new PregameRequestError(`賽前資料連線暫時中斷（${response.status}）`,response.status);
  const data=await response.json();
  if(data.pregame?.date!==date||data.pregame?.league!==league||!Array.isArray(data.pregame?.games))throw new PregameRequestError('賽前資料日期或聯盟不符');
  return data;
 }finally{clearTimeout(timeout);signal.removeEventListener('abort',abort);}
}
export function startPregamePolling({league,date,onValue,onError,visible=()=>true,request=requestPregame,setTimer=setTimeout,clearTimer=clearTimeout}:{
 league:string;date:string;onValue:(data:any)=>void;onError:(error:unknown)=>void;visible?:()=>boolean;
 request?:typeof requestPregame;setTimer?:typeof setTimeout;clearTimer?:typeof clearTimeout;
}){
 const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,busy=false,first=true,failures=0;
 async function refresh(){
  if(busy||controller.signal.aborted||!visible())return;
  clearTimer(timer);busy=true;let fresh=false,retry=false,authorized=true;
  const stored=first?request(league,date,controller.signal,true).then(data=>{if(!fresh&&!controller.signal.aborted&&data.pregame.games.length)onValue({...data,status:'refreshing'});}).catch(()=>{}):Promise.resolve();first=false;
  try{
   const data=await request(league,date,controller.signal);
   if(controller.signal.aborted)return;fresh=true;onValue(data);
   retry=!['ready'].includes(data.status);if(!retry)failures=0;
  }catch(error){
   await stored;if(controller.signal.aborted)return;
   authorized=!(error instanceof PregameRequestError&&[401,403].includes(error.status));retry=true;onError(error);
  }finally{
   busy=false;
   if(!controller.signal.aborted&&authorized)timer=setTimer(()=>void refresh(),retry?Math.min(30000,5000*2**Math.min(failures++,3)):300000);
  }
 }
 void refresh();return {refresh,stop(){controller.abort();clearTimer(timer);}};
}
