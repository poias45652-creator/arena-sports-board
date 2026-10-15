// Isolated public source/auth fixtures. Never enable this preload on Render.
import {readFileSync} from 'node:fs';
if(process.env.YJ_RENDER_HTTP_TEST!=='1')throw Error('Test-only fixture');
const RealDate=Date,now=RealDate.parse('2026-10-15T17:00:00Z');
globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}static parse(value){return RealDate.parse(value);}static UTC(...args){return RealDate.UTC(...args);}};
await import('./render-http-preload.mjs');
const native=fetch,read=(league,name)=>JSON.parse(readFileSync(new URL(`./fixtures/basketball-live/${league}-${name}.json`,import.meta.url),'utf8'));
globalThis.fetch=async(input,options)=>{
 const u=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);
 if(['localhost','127.0.0.1'].includes(u.hostname))return native(input,options);
 const match=u.pathname.match(/\/sports\/basketball\/(nba|wnba)\/(scoreboard|summary|standings)$/);
 if(u.hostname!=='site.api.espn.com'||!match)return new Response('',{status:503});
 const [,league,kind]=match;
 if(kind==='summary'){
  const raw=read(league,'summary');return raw.header.id===u.searchParams.get('event')?Response.json(raw):new Response('',{status:404});
 }
 if(kind==='standings')return Response.json(read(league,u.searchParams.get('seasontype')==='1'?'standings':'standings-regular'));
 const raw=read(league,'schedule'),date=league==='nba'?'20261014':'20261001';
 if(u.searchParams.get('dates')!==date)raw.events=[];
 return Response.json(raw);
};
