import type {Match} from './baseball';

export type MatchScoreSnapshot={date:string;fetchedAt:string;games:any[]};

export function matchScore(game:Match,snapshot:MatchScoreSnapshot|null,day:string){
 if(!snapshot||snapshot.date!==day)return null;
 const rows=snapshot.games.filter(row=>row.gamePk===game.id&&row.teams?.away?.team?.id===game.away.id&&row.teams?.home?.team?.id===game.home.id);
 if(rows.length!==1)return null;
 const score=rows[0],state=score.status?.abstractGameState;
 if(state!=='Live'&&state!=='Final')return null;
 if(game.state==='Final'&&state!=='Final')return null;
 return score;
}

export function showMatchScoreboard(game:Match,score:any|null){
 return game.state==='Live'||game.state==='Final'||score?.status?.abstractGameState==='Live'||score?.status?.abstractGameState==='Final';
}
