// Confirm split season tables for only the six missing pitchers. No account data.
import {plain,tableData,dayInTaipei} from '../server/baseball-live-providers.mjs';
import {pitchingOuts} from '../server/baseball-season-pitching.mjs';
const people=[['65516','배제성','KT'],['56801','아빌라','SSG'],['52043','벤자민','두산'],['54362','전준표','키움'],['56939','클레빈저','NC'],['56459','페덱','삼성']];
console.log('ENV',JSON.stringify({environment:'GitHub Actions, not Render',date:dayInTaipei(),observedAt:new Date().toISOString()}));
for(let i=0;i<people.length;i+=3)await Promise.all(people.slice(i,i+3).map(async([id,name,team])=>{
 const url=`https://www.koreabaseball.com/Record/Player/PitcherDetail/Basic.aspx?playerId=${id}`;
 try{const r=await fetch(url,{redirect:'manual',headers:{'User-Agent':'YJBaseballSourceCheck/1.0',Accept:'text/html'},signal:AbortSignal.timeout(10000)});if(!r.ok){await r.body?.cancel();throw Error('HTTP '+r.status)}
 const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>4_000_000)throw Error('oversize');const html=new TextDecoder().decode(bytes),text=plain(html),tables=tableData(html);
 const index=tables.findIndex(t=>t.rows[0]?.includes('팀명')&&t.rows[0]?.includes('ERA')&&t.rows[0]?.includes('IP'));
 const selected=tables.slice(index,index+2),fields={};for(const t of selected)if(t.rows.length===2&&t.rows[0].length===t.rows[1].length)t.rows[0].forEach((h,k)=>fields[h]=t.rows[1][k]);
 const outs=pitchingOuts(fields.IP),era=Number(fields.ERA),whip=Number(fields.WHIP),h=Number(fields.H),bb=Number(fields.BB),er=Number(fields.ER);
 const complete=['ERA','IP','H','BB','ER','WHIP'].every(k=>fields[k]!==undefined)&&outs>0;
 console.log('KBO_VERIFIED_SEASON',JSON.stringify({url,id,name,expectedTeam:team,actualTeam:fields['팀명'],nameMatches:text.includes(name),tables:selected.map(t=>({headers:t.rows[0],rows:t.rows.slice(1,2)})),seasonLabels:[...text.matchAll(/.{0,16}2026.{0,32}/g)].slice(0,3).map(m=>m[0]),checks:{complete,eraMatches:complete&&Math.abs(er*27/outs-era)<.025,whipMatches:complete&&Math.abs((h+bb)*3/outs-whip)<.025},observedAt:new Date().toISOString()}));
 }catch(e){console.log('KBO_VERIFIED_SEASON',JSON.stringify({url,name,error:e.message}));}
}));
