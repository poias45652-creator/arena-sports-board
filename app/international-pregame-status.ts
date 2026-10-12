type SourceState={status?:string;pregame?:{date?:string;observedAt?:string;games?:unknown[]}};
export type InternationalPregameNotice={date:string;status:'unavailable'|'partial'|'stale';message:string;hasRecords:boolean;retained:boolean;observedAt:string|null};

/** Presentation only. Source availability never changes fixture/model eligibility. */
export function internationalPregameNotice(source:SourceState|undefined,date:string):InternationalPregameNotice|null{
  if(!source||!['unavailable','partial','stale'].includes(source.status||'')||!/^\d{4}-\d{2}-\d{2}$/.test(date))return null;
  // A previous date's result must not label the newly selected day as failed.
  if(source.pregame?.date&&source.pregame.date!==date)return null;
  const hasRecords=source.pregame?.date===date&&Array.isArray(source.pregame.games)&&source.pregame.games.some(game=>!!game&&typeof game==='object'&&'date' in game&&game.date===date);
  const status=source.status as InternationalPregameNotice['status'];
  const retained=hasRecords&&status!=='partial';
  const prefix=status==='partial'?'部分賽前來源尚未齊全':status==='stale'?'賽前來源更新失敗':'賽前來源暫時無法取得';
  const detail=hasRecords?(retained?'保留上次取得的同日資料。':'已取得的同日資料仍可查看。'):'尚未取得可用的同日賽前資料。';
  const observed=hasRecords?source.pregame?.observedAt:null;
  const observedAt=observed&&Number.isFinite(Date.parse(observed))?new Date(observed).toISOString():null;
  return {date,status,message:`${date} ${prefix}；${detail}`,hasRecords,retained,observedAt};
}
