import {collectedMatch} from '../../../server/live-match-collector.mjs';
import {firstPaintFeed} from './season-sync.js';
import {recentPitchFeed} from './pitch-feed.js';
import {recentOfficialDetail} from './hkfa-events.js';
import {getClubRoster,currentPlayerFeed,getClubPortraits} from './player-feed.js';
import {dataResponse,incomingDetailGame,registeredPlayer,matchingPlayerGame,recordedMatchSheet} from './football-data.js';
import {oddsResponse} from './bet365-odds.js';

async function fillNewStarts(player,feed,now){
  const missing=player.games.filter(g=>g.started==null);
  // Only match confirmed final scores. A live or incomplete team sheet cannot confirm a start.
  for(let offset=0;offset<missing.length;offset+=3){
    await Promise.all(missing.slice(offset,offset+3).map(async row=>{
      const game=matchingPlayerGame(player,row,feed,now);
      if(!game)return;
      const sheet=recordedMatchSheet(game)||await recentOfficialDetail(game,now);
      const lineup=sheet?.lineups?.[player.team]||[];
      if(lineup.filter(p=>p.starter).length!==11)return;
      const found=lineup.find(p=>String(p.hkfaId)===String(player.id));
      if(found)row.started=found.starter;
    }));
  }
  player.startCount=player.games.every(g=>typeof g.started==='boolean')?player.games.filter(g=>g.started).length:null;
}
export default {
  async fetch(request,env,ctx) {
    if (!['GET','HEAD'].includes(request.method)) return new Response(null,{status:405,headers:{Allow:'GET, HEAD'}});
    const path=new URL(request.url).pathname;
    if (path==='/api/football/odds') {
      const response=await oddsResponse(env,request,ctx);
      return request.method==='HEAD'?new Response(null,{headers:response.headers}):response;
    }
    if (['/api/football','/api/football-team','/api/sport-player'].includes(path)) {
      const url=new URL(request.url),q=url.searchParams,day=q.get('date');
      const season=day?Number(day.slice(0,4))-(Number(day.slice(5,7))<7?1:0):Number(q.get('season')||2026);
      const shouldSync=season===2026 && path!=='/api/sport-player' && q.get('kind')!=='models' && q.get('action')!=='roster';
      let feed=shouldSync?await firstPaintFeed(request,ctx):null;
      const now=Date.now();
      const game=season===2026&&q.get('kind')==='detail'?incomingDetailGame(q.get('game'),feed,now):null;
      const [liveSource,pitchFeed]=game?await Promise.all([collectedMatch('hkg.1',game.id,game.day)||recentOfficialDetail(game,now),recentPitchFeed(game,now)]):[null,null];
      let playerFeed=null;
      if(season===2026){
        const team=q.get('team'),id=q.get('id');
        const base=path==='/api/sport-player'?registeredPlayer(id,team):null;
        const checkPortraits=(path==='/api/football-team'&&q.get('action')==='roster')||(base&&!base.photo);
        const portraits=checkPortraits?getClubPortraits(team||base?.team,url.origin).catch(()=>null):null;
        try{
          if(path==='/api/football-team'&&q.get('action')==='roster')playerFeed={club:await getClubRoster(team,url.origin)};
          if(path==='/api/sport-player'){
            playerFeed=await currentPlayerFeed(base,id,team||base?.team,url.origin);
            if(playerFeed?.player?.games.some(g=>g.started==null)){
              feed=await firstPaintFeed(request,ctx);
              await fillNewStarts(playerFeed.player,feed,now);
            }
          }
        }catch{
          // Keep the most recent verified season record when both public pages cannot be reconciled.
        }
        if(portraits)playerFeed={...playerFeed,photos:await portraits};
      }
      const response=dataResponse(url,feed,now,liveSource,playerFeed,pitchFeed);
      response.headers.set('Cache-Control','private, no-store');
      return request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response;
    }
    return new Response('找不到頁面',{status:404});
  }
};
