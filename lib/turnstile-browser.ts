export type TurnstileApi={render:(node:HTMLElement,options:Record<string,unknown>)=>string;remove:(id:string)=>void;ready?:(callback:()=>void)=>void};
const pending=new WeakMap<Window,Promise<TurnstileApi>>();
export function loadTurnstile(win:Window=window,doc:Document=document):Promise<TurnstileApi>{
 const existing=pending.get(win);if(existing)return existing;
 const promise=new Promise<TurnstileApi>((resolve,reject)=>{
  let settled=false;
  let script:HTMLScriptElement|undefined;
  const cleanup=()=>{win.clearTimeout(timeout);win.clearInterval(poll);script?.removeEventListener('error',fail);script?.removeEventListener('load',check);};
  const done=(api:TurnstileApi)=>{if(settled)return;settled=true;cleanup();resolve(api);};
  const fail=()=>{if(settled)return;settled=true;cleanup();reject(new Error('安全驗證程式載入失敗，請重新整理後再試。'));};
  const check=()=>{
   const api=(win as unknown as {turnstile?:TurnstileApi}).turnstile;
   if(settled||typeof api?.render!=='function')return;
   done(api);
  };
  const timeout=win.setTimeout(fail,15000),poll=win.setInterval(check,100);
  // Reuse the API or any existing official script, regardless of who inserted it.
  if(typeof (win as unknown as {turnstile?:TurnstileApi}).turnstile?.render!=='function'){
   script=Array.from(doc.scripts).find(s=>{try{const u=new URL(s.src,doc.baseURI);return u.hostname==='challenges.cloudflare.com'&&u.pathname==='/turnstile/v0/api.js';}catch{return false;}});
   if(!script){script=doc.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.addEventListener('error',fail);script.addEventListener('load',check);doc.head.appendChild(script);}else {script.addEventListener('error',fail);script.addEventListener('load',check);}
  }
  check();
 });
 pending.set(win,promise);void promise.catch(()=>{if(pending.get(win)===promise)pending.delete(win);});return promise;
}
