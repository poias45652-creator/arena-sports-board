import {teamIds} from './baseball';
export type FanGraphsKind='injuries'|'bat-left'|'bat-right'|'pit-left'|'pit-right';
export function fangraphsUrl(kind:FanGraphsKind,year:number){
 if(kind==='injuries')return `https://www.fangraphs.com/roster-resource/injury-report?season=${year}`;
 return `https://www.fangraphs.com/leaders/major-league?pos=all&stats=${kind.startsWith('bat')?'bat':'pit'}&lg=all&qual=0&type=1&season=${year}&month=${kind.endsWith('left')?13:14}&season1=${year}&ind=0&pageitems=2000&pagenum=1`;
}
const number=(v:unknown)=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
export function parseFanGraphs(html:string,kind:FanGraphsKind,year:number){
 if(html.length>12000000)throw new Error('FanGraphs 資料超出上限');
 const embedded=html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
 if(!embedded)throw new Error('FanGraphs 資料格式改變');
 const queries=JSON.parse(embedded)?.props?.pageProps?.dehydratedState?.queries;
 if(!Array.isArray(queries))throw new Error('FanGraphs 缺少資料');
 const injury=kind==='injuries',key=injury?'roster-resource/injury-report/data':'leaders/major-league/data';
 const q=queries.find((q:any)=>q.queryKey?.[0]===key), params=q?.queryKey?.[1],data=q?.state?.data;
 if(params?.season!==year)throw new Error('FanGraphs 球季不符');
 if(!injury&&(params.stats!==(kind.startsWith('bat')?'bat':'pit')||params.month!==(kind.endsWith('left')?13:14)||params.season1!==year))throw new Error('FanGraphs 分項不符');
 const raw=injury?data:data?.data;
 if(!Array.isArray(raw)||(!injury&&raw.length!==data.totalCount))throw new Error('FanGraphs 資料不完整');
 const rows=raw.map((r:any)=>{
  const playerId=number(r.xMLBAMID??r.mlbamid);
  if(!playerId||!Number.isInteger(playerId)||r.season!==undefined&&r.season!==year||r.Season!==undefined&&r.Season!==year)throw new Error('FanGraphs 球員資料無法對應');
  if(injury)return {playerId,fanGraphsId:String(r.playerId),name:r.playerName,teamId:teamIds[r.team]??null,position:r.position,status:r.status,activeInjury:r.status!=='Activated',injury:r.injurySurgery,injuryDate:r.dateDisplay||r.date,retroDate:r.retrodate,eligibleDate:r.eligibledate,returnDate:r.returndate,latestUpdate:r.latestUpdate,sourceUpdatedAtRaw:r.loaddate};
  const metrics:Record<string,number|null>={};
  for(const key of ['PA','TBF','IP','K%','BB%','K-BB%','wOBA','wRC+','ISO','OPS','ERA','FIP','xFIP','GB%','HR/FB'])metrics[key]=number(r[key]);
  return {playerId,fanGraphsId:String(r.playerid),name:r.PlayerName,teamId:teamIds[r.TeamNameAbb]??null,team:r.TeamNameAbb,hand:r.Bats??r.Throws,opponentHand:kind.endsWith('left')?'L':'R',sampleSize:number(r.PA??r.TBF),metrics};
 });
 return {kind,year,rows,totalCount:rows.length,source:fangraphsUrl(kind,year),fetchedAt:new Date().toISOString(),sourceUpdatedAt:null,modelApplied:false,rateUnit:'fraction',status:'ready'};
}
