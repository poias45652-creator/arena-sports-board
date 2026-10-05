// Read only six public NBA resources. No credentials, private APIs or retries.
import {mkdirSync,writeFileSync} from 'node:fs';
const root='https://www.nba.com',paths=['players','team/1610612755/sixers','player/203954/joel-embiid'];
const rows=[];
for(const path of paths){
 const row={path};
 try{
  const started=performance.now(),r=await fetch(`${root}/${path}`,{signal:AbortSignal.timeout(15000)}),html=await r.text();
  row.htmlStatus=r.status;row.htmlBytes=Buffer.byteLength(html);row.htmlMs=performance.now()-started;
  if(!r.ok)throw Error('html unavailable');
  const m=html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);if(!m)throw Error('hydration missing');
  const hydration=JSON.parse(m[1]);if(!/^[a-zA-Z0-9_-]{1,160}$/.test(hydration.buildId))throw Error('invalid build');
  row.buildId=hydration.buildId;
  const t=performance.now(),j=await fetch(`${root}/_next/data/${hydration.buildId}/${path}.json`,{signal:AbortSignal.timeout(15000)}),text=await j.text();
  row.jsonStatus=j.status;row.jsonBytes=Buffer.byteLength(text);row.jsonMs=performance.now()-t;
  if(j.ok){const d=JSON.parse(text),p=d.pageProps;row.keys=Object.keys(p||{});row.samePageProps=JSON.stringify(p)===JSON.stringify(hydration.props.pageProps);row.playerId=p?.player?.info?.PERSON_ID;row.teamId=p?.team?.info?.TEAM_ID;row.players=Array.isArray(p?.players)?p.players.length:undefined;}
 }catch(e){row.error=String(e.message).slice(0,150);}
 rows.push(row);console.log(JSON.stringify(row));
}
mkdirSync('evidence',{recursive:true});writeFileSync('evidence/nba-page-data-probe.json',JSON.stringify({run:process.env.GITHUB_RUN_ID,at:new Date().toISOString(),rows},null,2));
