// A normal, identified HTTP client. No browser cookies, challenge solving or proxy switching.
let blockedUntil=0,blockedReason='';
export async function coversFetch(url:string){
 const u=new URL(url);if(u.origin!=='https://www.covers.com')throw new Error('Covers 來源不符');
 if(Date.now()<blockedUntil)throw new Error(blockedReason+'（暫停重試）');
 const r=await fetch(url,{headers:{'User-Agent':'ArenaSportsBoard/1.0 (+https://arena-sports-board.poias45652.chatgpt.site)','Accept':'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5'},redirect:'manual',signal:AbortSignal.timeout(25000)});
 if(r.ok)return r;
 const text=(await r.text()).slice(0,64000);
 const challenge=r.headers.get('cf-mitigated')==='challenge'||/cf-chl-|challenge-platform|Just a moment|verify you are human/i.test(text);
 const denied=/access denied|request blocked|you have been blocked|forbidden/i.test(text);
 const reason=challenge?'來源要求瀏覽器驗證':denied?'來源拒絕自動請求':r.status>=300&&r.status<400?'來源發生轉址':'來源拒絕或暫不可用';
 // Record only selected diagnostics, never cookies, full HTML, or visitor/request headers.
 console.error('covers-fetch',JSON.stringify({status:r.status,challenge,denied,redirect:r.headers.has('location'),contentType:r.headers.get('content-type'),checkedAt:new Date().toISOString()}));
 blockedReason=`Covers ${r.status}：${reason}`;
 if([403,429].includes(r.status))blockedUntil=Date.now()+15*60000;
 throw new Error(blockedReason);
}
