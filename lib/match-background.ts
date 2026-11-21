import {FOOTBALL_LEAGUES,footballDay,shiftFootballDay} from './football';
import {footballSchedule} from './football-source';
import {footballDetail} from './football-live-source';
import {nbaSchedule} from './nba-source';
import {wnbaSchedule} from './wnba-source';
import {basketballDetail} from './basketball-live-source';
import {loadMlbLiveGame} from './mlb-live-source';
import {api} from '../server/regional-basketball/api.mjs';
import {snapshot} from '../server/regional-basketball/archive.mjs';
import {createMatchCollector,currentCollector,registerCollector} from '../server/live-match-collector.mjs';
import {readSeasonFeed} from '../modules/hong-kong-football/server/season-sync.js';
import {dataResponse} from '../modules/hong-kong-football/server/football-data.js';
import {recentPitchFeed} from '../modules/hong-kong-football/server/pitch-feed.js';
import {recentOfficialDetail} from '../modules/hong-kong-football/server/hkfa-events.js';

type Fixture<T>={id:string;day:string;game:T;live:boolean;final:boolean};
type Listed={id:string|number;state?:string;status?:string;awaitingOfficial?:boolean};
function byDay<T extends Listed>(league:string,interval:number,list:(day:string)=>Promise<{games:T[]}>,detail:(game:T,day:string)=>Promise<unknown>){
  return {league,interval,async fixtures(now:number){
    const today=footballDay(new Date(now));
    // Keep overnight matches on their kickoff date, including after a process restart.
    const early=now-Date.parse(today+'T00:00:00+08:00')<6*3600000;
    const days=early?[today,shiftFootballDay(today,-1)]:[today];
    const reads=await Promise.allSettled(days.map(async day=>(await list(day)).games.map(game=>({
      id:String(game.id),day,game,live:game.state==='live'||game.status==='in_progress'||game.awaitingOfficial===true,final:game.state==='final'||game.status==='final'
    }))));
    if(reads.every(r=>r.status==='rejected'))throw Error('Schedule unavailable');
    return reads.flatMap(r=>r.status==='fulfilled'?r.value:[]);
  },detail:(fixture:Fixture<T>)=>detail(fixture.game,fixture.day)};
}
async function regionalMatchResponse(league:'KBL'|'NBL',kind:'detail'|'feed',query:Record<string,string>){
  const url=new URL('/api/regional-basketball/'+kind,'https://arena-sports-board.onrender.com');
  url.search=new URLSearchParams({...query,league}).toString();
  const response=await api(new Request(url),snapshot);
  if(!response.ok)throw Error('Regional basketball source unavailable');
  return response.json();
}

const hkOrigin='https://arena-sports-board.onrender.com';
async function hkBoard(day:string){
  const url=new URL('/api/football',hkOrigin);
  url.search=new URLSearchParams({kind:'board',date:day}).toString();
  const feed=await readSeasonFeed(new Request(url));
  const data=await dataResponse(url,feed).json();
  const age=Date.now()-Date.parse(data.fetchedAt);
  if(!Array.isArray(data.games)||(data.sync!=='feed'&&!(data.sync==='cached'&&age>=0&&age<900000)))throw Error('HKFA schedule unavailable');
  for(const game of data.games){
    const elapsed=Date.now()-Date.parse(game.start);
    game.awaitingOfficial=game.state==='pending'&&!!game.officialId&&game.timeConfirmed&&elapsed>=0&&elapsed<3*3600000;
  }
  return data;
}
async function mlbJson(url:string){
  const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('MLB source unavailable');
  return response.json();
}
async function mlbGames(day:string){
  const dates=await mlbJson('https://statsapi.mlb.com/api/v1/schedule?sportId=1&startDate='+shiftFootballDay(day,-1)+'&endDate='+day);
  if(!Array.isArray(dates.dates))throw Error('MLB schedule unavailable');
  const games=dates.dates.flatMap((row:{games?:{gamePk:number;gameDate:string;status:{abstractGameState:string}}[]})=>row.games||[])
    .filter((game:{gameDate:string})=>footballDay(game.gameDate)===day)
    .map((game:{gamePk:number;status:{abstractGameState:string}})=>({id:game.gamePk,state:({Live:'live',Final:'final'} as Record<string,string>)[game.status.abstractGameState]}));
  return {games};
}
export function startMatchBackground(){
  if(currentCollector())return;
  const sources=[
    ...FOOTBALL_LEAGUES.map(({code})=>byDay(code,10000,day=>footballSchedule(code,day),game=>footballDetail(game))),
    byDay('hkg.1',12000,hkBoard,async game=>{
      const now=Date.now();
      const [official,pitch]=await Promise.allSettled([recentOfficialDetail(game,now),recentPitchFeed(game,now)]);
      const sheet=official.status==='fulfilled'?official.value:null;
      const pitchFeed=pitch.status==='fulfilled'?pitch.value:null;
      const freshSheet=sheet?.match && Math.abs(now-Date.parse(sheet.checkedAt))<=45000?sheet:null;
      if(!freshSheet&&(!pitchFeed||pitchFeed.delayed))throw Error('港超場況暫時無法取得');
      return {sheet:freshSheet,pitchFeed,final:freshSheet?.match?.state==='final'||pitchFeed?.state==='final'};
    }),
    byDay('NBA',5000,nbaSchedule,game=>basketballDetail(game,'NBA')),
    byDay('WNBA',5000,wnbaSchedule,game=>basketballDetail(game,'WNBA')),
    ...(['KBL','NBL'] as const).map(league=>byDay(league,5000,
      day=>regionalMatchResponse(league,'feed',{date:day}),game=>regionalMatchResponse(league,'detail',{id:String(game.id)}))),
    byDay('MLB',10000,mlbGames,game=>loadMlbLiveGame(Number(game.id)))
  ];
  const collector=createMatchCollector(sources);
  registerCollector(collector);collector.start();
  for(const sig of ['SIGTERM','SIGINT'] as const)process.once(sig,()=>collector.stop());
}
