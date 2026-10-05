import {sourceWork,withSourceRequest} from './source-request';
import {availabilityFromNews,type PlayerEvidence} from './basketball-player-strength';
import {wnbaTeam} from './wnba';
import photos from '../data/wnba-official-photos.json';
import supplements from '../data/wnba-player-supplements.json';
const slugs:Record<string,string>={'20':'dream','19':'sky','18':'sun','3':'wings','129689':'valkyries','5':'fever','17':'aces','6':'sparks','8':'lynx','9':'liberty','11':'mercury','132052':'fire','14':'storm','131935':'tempo','16':'mystics'};
const clean=(v:unknown)=>typeof v==='string'&&!['-','N/A'].includes(v.trim())?v.trim():'';
const number=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0?v:null;
const normalizedName=(v:string)=>v.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function parseOfficialWnbaDirectory(data:any){
 const p=data?.props?.pageProps,season=Number(p?.defaultSeason);
 if(!Number.isInteger(season)||season<1997||!Array.isArray(p.currentPlayersData)||p.currentPlayersData.length<100)throw Error('WNBA 官網球員格式不符');
 const seen=new Set<number>();
 const players=(p.currentPlayersData as any[]).map((r:any)=>{
  if(!Array.isArray(r)||r.length<25||!Number.isSafeInteger(r[0])||r[0]<=0||seen.has(r[0])||!clean(r[1])||!clean(r[2])||!/^[-a-z0-9]+$/.test(r[3]))throw Error('WNBA 官網球員身分不符');seen.add(r[0]);
  const name=`${r[2]} ${r[1]}`,valid=r[24]==='Season'&&String(r[20])===String(season);
  const photoRecord=(photos as Record<string,{url:string;name:string;source:string}>)[String(r[0])];
  const override=photoRecord&&normalizedName(photoRecord.name)===normalizedName(name)?photoRecord:undefined;
  const supplement=supplements.find(s=>s.id===r[0]&&normalizedName(s.name)===normalizedName(name));
  return {id:r[0],name:`${r[2]} ${r[1]}`,slug:r[3],teamSlug:clean(r[5]),teamCity:clean(r[6]),teamName:clean(r[7]),active:r[18]===1,
   number:clean(r[9]),position:clean(r[10]),height:clean(r[11])||supplement?.height||'',weight:clean(r[12]),school:clean(r[13]),country:clean(r[14])||supplement?.country||'',draftYear:r[15]?String(r[15]):'',season:String(season),experience:'',
   photo:override?.url||`https://cdn.wnba.com/headshots/wnba/latest/1040x760/${r[0]}.png`,
   photoFallback:override?`https://cdn.wnba.com/headshots/wnba/latest/1040x760/${r[0]}.png`:'',href:`https://www.wnba.com/player/${r[0]}/${r[3]}`,
   averages:valid&&[r[21],r[22],r[23]].some(v=>number(v)!==null)?{season,points:number(r[21]),rebounds:number(r[22]),assists:number(r[23])}:null};
 });
 return {season,players};
}
let cache:{value:ReturnType<typeof parseOfficialWnbaDirectory>;until:number}|undefined;
export async function officialWnbaDirectory(){
 if(cache&&cache.until>Date.now())return cache.value;
 const {pending}=sourceWork('wnba-official');if(pending.has('players'))return pending.get('players')! as Promise<ReturnType<typeof parseOfficialWnbaDirectory>>;
 const task=(async()=>{
  const r=await fetch('https://www.wnba.com/players',{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('WNBA 官網無法更新');
  const reader=r.body?.getReader();if(!reader)throw Error('WNBA 官網內容為空');const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>6000000){await reader.cancel();throw Error('WNBA 官網資料過大');}chunks.push(value);}}finally{reader.releaseLock();}
  const html=Buffer.concat(chunks).toString('utf8'),json=html.match(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/)?.[1];
  if(!json)throw Error('WNBA 官網資料缺漏');const value=parseOfficialWnbaDirectory(JSON.parse(json));cache={value,until:Date.now()+15*60000};return value;
 })().finally(()=>pending.delete('players'));pending.set('players',task);return task;
}
export function officialWnbaRosterFromDirectory(data:ReturnType<typeof parseOfficialWnbaDirectory>,id:string){
 const team=wnbaTeam(id);if(!team)throw Error('球隊不存在');
 const roster=data.players.filter(p=>p.teamSlug===slugs[id]&&p.active);if(!roster.length)throw Error('官網尚無此球隊名單');
 return {team,season:String(data.season),rosterSeason:String(data.season),roster,background:{coach:''},recordSummary:'',sourceLabel:'WNBA 官方',sourceUrl:'https://www.wnba.com/players',fetchedAt:new Date().toISOString()};
}
export async function officialWnbaRoster(id:string){return officialWnbaRosterFromDirectory(await officialWnbaDirectory(),id);}

export function parseOfficialWnbaPlayer(data:any,id:number,teamSlug:string){
 const p=data?.props?.pageProps?.player;
 if(Number(p?.pid)!==id||Number(p?.info?.PERSON_ID)!==id||p.teamSlug!==teamSlug||!p.rosterActive||!/^[-a-z0-9]+$/.test(p.slug)||!Array.isArray(p.rotowireLatestNews))throw Error('WNBA 球員身分或轉隊資料尚未同步');
 return {id,name:String(p.info.DISPLAY_FIRST_LAST),news:p.rotowireLatestNews.filter((n:any)=>Number(n.wnbaId)===id),sourceUrl:`https://www.wnba.com/player/${id}/${p.slug}`};
}

// News on WNBA.com uses wnbaId, unlike the NBA feed's nbaId. Bind it to
// the current opponent before interpreting natural-language availability.
export function wnbaPlayerEvidence(player:ReturnType<typeof parseOfficialWnbaPlayer>,now:number,opponentWords:string[]):PlayerEvidence{
 const evidence=availabilityFromNews(player.id,player.name,player.sourceUrl,player.news,now,opponentWords);
 if(evidence.minutesCap!==undefined&&evidence.minutesCap>40)return {...evidence,minutesCap:undefined,minutesConfirmed:false};
 return evidence;
}

const playerPages=new Map<string,{value:ReturnType<typeof parseOfficialWnbaPlayer>;until:number}>();
async function officialWnbaAnalysisPlayer(p:ReturnType<typeof parseOfficialWnbaDirectory>['players'][number]){
 const key=`${p.id}:${p.teamSlug}`,hit=playerPages.get(key);if(hit&&hit.until>Date.now())return hit.value;
 const work=sourceWork('wnba-official-player'),{pending,queue}=work;
 if(pending.has(key))return pending.get(key)! as Promise<ReturnType<typeof parseOfficialWnbaPlayer>>;
 if(queue.length>64)throw Error('WNBA 球員資料忙碌中');
 const task=(async()=>{
  if(work.active>=4)await new Promise<void>(r=>queue.push(r));else work.active++;
  try{
   const r=await fetch(p.href,{cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error('WNBA 球員頁更新失敗');
   const reader=r.body?.getReader();if(!reader)throw Error('WNBA 球員頁為空');const chunks:Uint8Array[]=[];let size=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>6000000){await reader.cancel();throw Error('WNBA 球員頁過大');}chunks.push(value);}}finally{reader.releaseLock();}
   const json=Buffer.concat(chunks).toString('utf8').match(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/)?.[1];
   if(!json)throw Error('WNBA 球員頁資料缺漏');const value=parseOfficialWnbaPlayer(JSON.parse(json),p.id,p.teamSlug);
   if(playerPages.size>=240)playerPages.delete(playerPages.keys().next().value!);
   playerPages.set(key,{value,until:Date.now()+5*60000});return value;
  }finally{const next=queue.shift();if(next)next();else work.active--;}
 })().finally(()=>pending.delete(key));pending.set(key,task);return task;
}

export async function officialWnbaAnalysisRosters(homeId:string,awayId:string,season:number){
 return withSourceRequest(async()=>{
 const directory=await officialWnbaDirectory();if(directory.season!==season)throw Error('WNBA 現役名單球季不符');
 const rosters=[homeId,awayId].map(id=>officialWnbaRosterFromDirectory(directory,id));
 const words=rosters.map(r=>[slugs[r.team.id],...new Set(r.roster.flatMap(p=>[p.teamCity,p.teamName]))]);
 const evidence=await Promise.all(rosters.map((r,side)=>Promise.all(r.roster.map(async p=>{
  const player=await officialWnbaAnalysisPlayer(p);return wnbaPlayerEvidence(player,Date.now(),words[1-side]);
 }))));
 return {home:evidence[0],away:evidence[1]};
 });
}
