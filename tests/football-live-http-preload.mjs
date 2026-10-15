// Isolated test authentication and captured public sources. Never use on Render.
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
if(process.env.YJ_RENDER_HTTP_TEST!=='1')throw Error('Test-only fixture');
const RealDate=Date,now=RealDate.parse('2026-10-15T17:00:00Z');
globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}static parse(value){return RealDate.parse(value);}static UTC(...args){return RealDate.UTC(...args);}};
await import('./render-http-preload.mjs');
const native=fetch,read=name=>JSON.parse(readFileSync(new URL(`./fixtures/football-live/${name}.json`,import.meta.url),'utf8')),year=league=>JSON.parse(gunzipSync(readFileSync(new URL(`./fixtures/football-live/${league}-year.json.gz`,import.meta.url))));
const europa=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/football-europa-analysis-20261015.json.gz',import.meta.url))));
globalThis.fetch=async(input,options)=>{
 const u=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);
 if(['localhost','127.0.0.1'].includes(u.hostname))return native(input,options);
 if(u.hostname!=='site.api.espn.com')return new Response('',{status:503});
 const path=u.pathname.split('/soccer/')[1]+u.search,match=u.pathname.match(/\/sports\/soccer\/([^/]+)\/(scoreboard|summary|standings)$/);
 if(match){const [,league,kind]=match;
  if(kind==='summary'){const id=u.searchParams.get('event');return id==='401915416'?Response.json(read('champions-summary')):id==='401915415'?Response.json(read('champions-summary-second')):new Response('',{status:404});}
  if(kind==='standings')return Response.json(read(league+'-standings'));
  if(u.searchParams.get('dates')==='2026')return Response.json(year(league));
  if(league==='uefa.champions'){const raw=read('champions-schedule');if(u.searchParams.get('dates')!=='20261014')raw.events=[];return Response.json(raw);}
 }
 const source=europa.sources.find(s=>s.path===path||s.path===path.replace(/&limit=100$/,'&limit=1000'));if(source)return Response.json(source.data);
 if(match&&match[2]==='scoreboard')return Response.json({events:[],leagues:[{slug:match[1]}]});
 return new Response('',{status:503});
};
