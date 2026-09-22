/** Naver READY is the pre-first-pitch lineup phase; never recover after start time. */
export function recoverKboPregameState(game){
 const start=Date.parse(game.startTime),observed=Date.parse(game.source?.fetchedAt);
 if(game.league==='KBO'&&game.status==='unknown'&&game.rawStatus==='READY'&&Number.isFinite(start)&&Number.isFinite(observed)&&observed<start&&game.away?.score===null&&game.home?.score===null){game.status='pregame';}
 return game;
}
