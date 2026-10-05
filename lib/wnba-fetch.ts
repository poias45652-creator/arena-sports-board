// Retry transport failures only; schema/identity validation stays with the parser.
export class WnbaSourceUnavailable extends Error {constructor(message:string,readonly retryable=true){super(message);}}
export async function wnbaPage(url:string,timeout=10000){
 for(let attempt=0;attempt<2;attempt++){
  try{
   const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(timeout)});
   if(!response.ok){await response.body?.cancel();if(response.status===403||response.status===404)throw new WnbaSourceUnavailable(`WNBA source HTTP ${response.status}`,false);if(response.status===408||response.status===429||response.status>=500)throw new WnbaSourceUnavailable(`WNBA source HTTP ${response.status}`);throw Error(`WNBA source HTTP ${response.status}`);}
   const reader=response.body?.getReader();if(!reader)throw new WnbaSourceUnavailable('WNBA source body unavailable');
   const chunks:Uint8Array[]=[];let size=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>6000000){await reader.cancel();throw Error('WNBA source exceeds size limit');}chunks.push(value);}}finally{reader.releaseLock();}
   return Buffer.concat(chunks).toString('utf8');
  }catch(error){
   const transient=error instanceof WnbaSourceUnavailable||error instanceof TypeError||(error instanceof Error&&['AbortError','TimeoutError'].includes(error.name));
   if(!transient)throw error;
   if(error instanceof WnbaSourceUnavailable&&!error.retryable)throw error;
   if(attempt===1)throw new WnbaSourceUnavailable(error instanceof Error?error.message:'WNBA source unavailable');
   await new Promise(resolve=>setTimeout(resolve,200));
  }
 }
 throw new WnbaSourceUnavailable('WNBA source unavailable');
}
