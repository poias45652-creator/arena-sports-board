import {parseLiveGame} from './live-game';
export async function loadMlbLiveGame(gamePk:number){
  const response=await fetch(`https://statsapi.mlb.com/api/v1.1/game/${gamePk}/feed/live`,{cache:'no-store',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('詳細資料暫時無法取得');
  const text=await response.text();
  if(text.length>8000000)throw Error('比賽資料超出上限');
  return parseLiveGame(JSON.parse(text),gamePk);
}
