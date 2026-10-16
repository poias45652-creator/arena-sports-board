const cache=new Map<string,{value:any;until:number}>(),pending=new Map<string,Promise<any>>();
export async function playerSource(url:string,html=false){
 const hit=cache.get(url);if(hit&&hit.until>Date.now())return hit.value;if(pending.has(url))return pending.get(url)!;
 const task=(async()=>{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('球員來源暫時無法讀取');const text=await r.text();if(text.length>8000000)throw Error('球員資料格式超出範圍');const value=html?text:JSON.parse(text);if(cache.size>=160)cache.delete(cache.keys().next().value!);cache.set(url,{value,until:Date.now()+300000});return value;})().finally(()=>pending.delete(url));pending.set(url,task);return task;
}
export function espnPagePlayer(html:string,id:string){const json=html.match(/window\['__espnfitt__'\]\s*=\s*({[\s\S]*?});?\s*<\/script>/)?.[1];if(!json)throw Error('球員成績格式不符');const p=JSON.parse(json).page?.content?.player;if(String(p?.playerId)!==id)throw Error('球員成績身分不符');return p;}
