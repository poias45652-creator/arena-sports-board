import {getKblFeed,getKblDetail,getKblHistory,getKblStandings,getKblBox} from './kbl.mjs';
import {getNblFeed,getNblHistory,getNblStandings} from './nbl.mjs';
import {fetchNblMarkets} from './market-feed.mjs';
import {rosterBase} from './nbl-seed.mjs';
import {getNblRoster} from './nbl-roster.mjs';
import {getKblRoster,getKblPlayerLog} from './kbl-roster.mjs';
import {fetchKblMarkets} from './kbl-market.mjs';
import {fetchKblTeamNotices} from './kbl-availability.mjs';
import {fetchNblInjuries} from './injury-feed.mjs';
import {getNblDetail} from './nbl-detail.mjs';
const active=new Map();
const json=(body,status=200,ttl=0)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store',vary:'Cookie'}});
const allowedDay=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d&&Math.abs(Date.parse(d)-Date.now())<367*86400000;
const idOK=(l,id)=>l==='KBL'?/^S\d+G\d+N\d+$/.test(id||''):/^(?:\d{7,12}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(id||'');
async function cached(key,ttl,fn){
 const old=active.get(key),now=Date.now();if(old&&old.expires>now)return old.promise;
 const entry={expires:now+ttl*1000};entry.promise=Promise.resolve().then(fn).catch(err=>{if(active.get(key)===entry)active.delete(key);throw err;});
 active.set(key,entry);
 if(active.size>270)for(const [k,v] of active){if(v.expires<=now||active.size>350)active.delete(k);}
 return entry.promise;
}
const sourceNote={NBL:'NBL／ESPN',KBL:'KBL 官方'};
function unpack(snapshot){
 if(!snapshot?.playColumns)return snapshot;
 const {playColumns,plays,...d}=snapshot;
 return {...d,plays:plays.map(row=>Object.fromEntries(playColumns.map((k,i)=>[k,row[i]])))};
}
export async function api(req,readAsset=async()=>null){
 const url=new URL(req.url),p=url.searchParams,kind=url.pathname.split('/').at(-1),l=p.get('league'),day=p.get('date'),id=p.get('id');
 if(req.method!=='GET'||!['NBL','KBL'].includes(l))return json({error:'無效的查詢'},400);
 const loadSnapshot=async game=>unpack(await readAsset('/data/details/'+l.toLowerCase()+'/'+game+'.json'));
 const isK=l==='KBL',run=(key,ttl,fn)=>cached(l+'/'+key,ttl,fn);
 try{
  if(kind==='feed'&&allowedDay(day))return json(await run('feed/'+day,15,()=>isK?getKblFeed(day):getNblFeed(day)),200,10);
  if(kind==='detail'&&idOK(l,id))return json(await run('detail/'+id,18,async()=>{
   if(!isK)return getNblDetail(id,{loadSnapshot});
   const [live,backup]=await Promise.allSettled([getKblDetail(id),loadSnapshot(id)]);
   if(!live.value&&!backup.value)throw Error('韓職單場資料暫無回應');
   if(!live.value)return backup.value;
   const a=live.value,b=backup.value;
   if(b&&a.home===b.home&&a.away===b.away){
    if(a.status!=='final'&&b.status==='final')return b;
    if(a.status===b.status&&a.homeScore+a.awayScore<b.homeScore+b.awayScore)return b;
    if(a.homeScore===b.homeScore&&a.awayScore===b.awayScore&&(a.plays?.length||0)<(b.plays?.length||0))return b;
   }
   return a;
  }),200,8);
  if(kind==='roster'){
   const team=p.get('team');if(!/^[A-Z]{2,4}$/.test(team||''))return json({error:'無效的隊碼'},400);
   return json(await run('roster/'+team,600,()=>isK?getKblRoster(team):getNblRoster(team,rosterBase)),200,120);
  }
  if(kind==='player'){
   const player=p.get('player');
   if(!isK||!/^\d{1,9}$/.test(player||''))return json({error:'無效的球員編號'},400);
   return json(await run('player/'+player,450,()=>getKblPlayerLog(player)),200,90);
  }
  if(kind==='history'){
   const from=p.get('from'),to=p.get('to');if(!allowedDay(from)||!allowedDay(to)||from>to||Date.parse(to)-Date.parse(from)>110*86400000)return json({error:'無效的日期範圍'},400);
   const d=await run('history/'+from+'/'+to,180,()=>isK?getKblHistory(from,to):getNblHistory(from,to));
   return json({games:Array.isArray(d)?d:d.games,asOf:d.asOf||new Date().toISOString()},200,90);
  }
  if(kind==='standings'){
   const yr=Number(p.get('season')),phase=Number(p.get('phase'));
   if(!Number.isInteger(yr)||yr<2022||yr>new Date().getUTCFullYear()+1||![1,2,3].includes(phase))return json({error:'無效的球季'},400);
   return json(await run('rank/'+yr+'/'+phase,240,()=>isK?getKblStandings(yr,phase):getNblStandings(yr,phase)),200,90);
  }
  if(kind==='boxes'){
   const ids=[...new Set((p.get('ids')||'').split(','))];if(ids.length>6||!ids.every(id=>idOK(l,id)))return json({error:'無效的賽事編號'},400);
   const res=await Promise.allSettled(ids.map(id=>run('box/'+id,86400,async()=>{
    if(isK)return getKblBox(id);const d=await getNblDetail(id,{loadSnapshot});if(d.status!=='final'||!d.minutes)return null;
    return {id,date:d.date,time:d.time,home:d.home,away:d.away,minutes:d.minutes,homeStats:d.teamStats.home,awayStats:d.teamStats.away};
   })));return json({boxes:res.flatMap(r=>r.status==='fulfilled'&&r.value?[r.value]:[])},200,180);
  }
  if(kind==='context'){
   if(isK){const both=await Promise.allSettled([run('markets',100,fetchKblMarkets),run('notices',1800,fetchKblTeamNotices)]);return json({markets:both[0].value||[],notices:both[1].value||[],injuries:[]},200,45);}
   const j=await Promise.allSettled([run('markets',100,fetchNblMarkets),run('injuries',1800,fetchNblInjuries)]);
   return json({markets:j[0].status==='fulfilled'?j[0].value:[],injuries:j[1].status==='fulfilled'?j[1].value:[]},200,45);
  }
  return json({error:'無效的查詢'},400);
 }catch(err){return json({error:sourceNote[l]+' 資料服務暫未回應',asOf:new Date().toISOString()},503);}
}
