// Retry transport failures only; schema/identity validation stays with the parser.
export class BasketballSourceUnavailable extends Error {constructor(message:string,readonly retryable=true,readonly status?:number){super(message);}}
export async function basketballPage(url:string,timeout=10000,league='WNBA'){
 for(let attempt=0;attempt<2;attempt++){
  try{
   const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(timeout)});
   if(!response.ok){await response.body?.cancel();if(response.status===403||response.status===404)throw new BasketballSourceUnavailable(`${league} source HTTP ${response.status}`,false,response.status);if(response.status===408||response.status===429||response.status>=500)throw new BasketballSourceUnavailable(`${league} source HTTP ${response.status}`,true,response.status);throw Error(`${league} source HTTP ${response.status}`);}
   const reader=response.body?.getReader();if(!reader)throw new BasketballSourceUnavailable(`${league} source body unavailable`);
   const chunks:Uint8Array[]=[];let size=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>6000000){await reader.cancel();throw Error(`${league} source exceeds size limit`);}chunks.push(value);}}finally{reader.releaseLock();}
   return Buffer.concat(chunks).toString('utf8');
  }catch(error){
   const transient=error instanceof BasketballSourceUnavailable||error instanceof TypeError||(error instanceof Error&&['AbortError','TimeoutError'].includes(error.name));
   if(!transient)throw error;
   if(error instanceof BasketballSourceUnavailable&&!error.retryable)throw error;
   if(attempt===1)throw new BasketballSourceUnavailable(error instanceof Error?error.message:`${league} source unavailable`);
   await new Promise(resolve=>setTimeout(resolve,200));
  }
 }
 throw new BasketballSourceUnavailable(`${league} source unavailable`);
}

export {BasketballSourceUnavailable as WnbaSourceUnavailable};
export const wnbaPage=(url:string,timeout=10000)=>basketballPage(url,timeout,'WNBA');
export const nbaPage=(url:string,timeout=10000)=>basketballPage(url,timeout,'NBA');
