import type {PregameData} from './international-pregame';
/** Stored public data is usable only for its exact league and fixture day. */
export function storedPregameResponse(league:string,date:string,payload:unknown,now=Date.now()){
 let pregame:PregameData;try{pregame=typeof payload==='string'?JSON.parse(payload):payload as PregameData;}catch{return null;}
 if(!pregame||pregame.league!==league||pregame.date!==date||!Array.isArray(pregame.games)||!pregame.games.length)return null;
 const captured=Date.parse(pregame.observedAt);if(!Number.isFinite(captured)||captured>now)return null;
 if(pregame.games.some(g=>g.league!==league||g.date!==date||!g.start?.startsWith(date+' ')||!g.away?.starter||!g.home?.starter||!g.source?.observedAt))return null;
 return {kind:league.toLowerCase()+'-pregame',status:'refreshing',fromStoredSnapshot:true,pregame,fetchedAt:pregame.observedAt,checkedAt:new Date(now).toISOString(),pollAfterMs:5000,scope:'同日已保存賽前資料；正在重新核對公開來源。',error:null};
}
