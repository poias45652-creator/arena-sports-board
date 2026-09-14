'use client';
import {fresh,type Match} from '@/lib/baseball';
import {InningBoard} from './live-scoreboard';

export default function MatchInningBoard({match,score,fetchedAt,error,now}:{match:Match;score:any|null;fetchedAt?:string;error:string;now:number}){
 const game=score||{teams:{away:{team:match.away},home:{team:match.home}}};
 const state=score?.status?.abstractGameState||match.state;
 const stamp=score?.detailFetchedAt||fetchedAt;
 const notice=!score?'比分同步中':error?'比分暫時無法更新':state==='Live'&&!fresh(stamp,now,60000)?'比分等待更新':'';
 return <div className="match-inning-board" aria-label="本場逐局比分" data-game-id={match.id}>
  <InningBoard game={game} line={score?.linescore} state={state}/>
  {notice&&<p className="match-score-notice" role="status">{notice}</p>}
 </div>;
}
