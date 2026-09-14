import {parsePlayerBio,parsePlayerQuery,playerStatLines,playerTotal,type PlayerGroup,type PlayerGroupData,type PlayerProfileData} from '@/lib/player-profile';
export const dynamic='force-dynamic';
const ROOT='https://statsapi.mlb.com/api/v1';
const cache=new Map<string,{until:number;data:any}>(),pending=new Map<string,Promise<any>>();
async function mlb(url:string){
  const hit=cache.get(url);if(hit&&hit.until>Date.now())return hit.data;
  if(pending.has(url))return pending.get(url)!;
  const task=(async()=>{
    const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error('MLB 資料暫時無法取得');
    const text=await response.text();if(text.length>5000000)throw new Error('資料超出上限');
    const data=JSON.parse(text);
    if(cache.size>=90)cache.delete(cache.keys().next().value!);
    cache.set(url,{until:Date.now()+5*60000,data});return data;
  })().finally(()=>pending.delete(url));pending.set(url,task);return task;
}
export async function GET(request:Request){
  const q=new URL(request.url).searchParams,options=parsePlayerQuery(q.get('id'),q.get('season'),q.get('type'));
  if(!options)return Response.json({error:'無效的球員、年度或賽事類型'},{status:400});
  const {id,season,gameType}=options;
  const source=`${ROOT}/people/${id}?hydrate=currentTeam`;
  const [bio,history,selected]=await Promise.allSettled([
    mlb(source),
    mlb(`${ROOT}/people/${id}/stats?stats=yearByYear,career&group=hitting,pitching&gameType=${gameType}&sportIds=1`),
    mlb(`${ROOT}/people/${id}/stats?stats=season,gameLog&group=hitting,pitching&season=${season}&gameType=${gameType}&sportIds=1`),
  ]);
  if(bio.status==='rejected')return Response.json({error:'球員資料暫時無法取得，請稍後重試。'},{status:503});
  const player=parsePlayerBio(bio.value,id);
  if(!player)return Response.json({error:'找不到這位球員。'},{status:404});
  const warnings:string[]=[],groups={} as Record<PlayerGroup,PlayerGroupData>;
  const historyOK=history.status==='fulfilled'&&Array.isArray(history.value?.stats),selectedOK=selected.status==='fulfilled'&&Array.isArray(selected.value?.stats);
  if(!historyOK)warnings.push('生涯與歷年成績暫時無法取得。');
  if(!selectedOK)warnings.push('所選球季與逐場紀錄暫時無法取得。');
  for(const group of ['pitching','hitting'] as const){
    groups[group]={
      season:selectedOK?playerTotal(playerStatLines(selected.value,id,group,'season',gameType,season)):null,
      career:historyOK?playerTotal(playerStatLines(history.value,id,group,'career',gameType)):null,
      history:historyOK?playerStatLines(history.value,id,group,'yearByYear',gameType):[],
      games:selectedOK?playerStatLines(selected.value,id,group,'gameLog',gameType,season):[],
    };
  }
  const data:PlayerProfileData={player,season,gameType,groups,warnings,source,fetchedAt:new Date().toISOString()};
  return Response.json(data,{headers:{'Cache-Control':'no-store'}});
}
