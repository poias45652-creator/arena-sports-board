import {createPublicTextSource} from '../server/source-resilience.mjs';

// Public HTTP only. Shared cooldown and bounded bodies; no access-challenge bypass.
const read=createPublicTextSource({origin:'https://www.covers.com',label:'Covers',timeoutMs:15000});
export async function coversFetch(url:string){
 return new Response(await read(url),{headers:{'Content-Type':'text/html; charset=utf-8'}});
}
