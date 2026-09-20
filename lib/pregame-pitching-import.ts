import type {PregameData,PregameSide,PitchingImportSource} from './international-pregame';
export type PitchingImport={league:string;gameId:string;date:string;start:string;source:PitchingImportSource;away:Pick<PregameSide,'team'|'starter'|'bullpen'>;home:Pick<PregameSide,'team'|'starter'|'bullpen'>};

// A saved page supplements only its exact fixture. Its receipt time is not a
// verified capture time and must not replace the older batting provenance.
export function applyPitchingImports(snapshot:PregameData,imports:PitchingImport[]):PregameData{
 const games=snapshot.games.map(game=>{
  let result=game;
  for(const update of imports){
   if(update.league!==snapshot.league||update.league!==game.league||update.gameId!==game.id||update.date!==snapshot.date||update.date!==game.date||update.start!==game.start)continue;
   if(update.away.team!==game.away.team||update.home.team!==game.home.team)continue;
   let url:URL;try{url=new URL(update.source.url);}catch{continue;}
   if(url.origin!=='https://www.playsport.cc'||url.pathname!=='/gamesData/battle'||url.searchParams.get('allianceid')!=='6'||url.searchParams.get('gameid')!==game.id||update.league!=='CPBL')continue;
   const received=Date.parse(update.source.receivedAt),start=Date.parse(game.start.replace(' ','T')+'+08:00');
   if(!Number.isFinite(received)||received>=start||received<Date.parse(game.source.observedAt))continue;
   for(const side of ['away','home'] as const){
    const existing=result[side],next=update[side],previous=Date.parse(existing.pitchingSource?.receivedAt||game.source.observedAt);
    if(received<=previous||!next.starter.name||!['source_reported','needs_review'].includes(next.starter.quality))continue;
    result={...result,[side]:{...existing,starter:next.starter,bullpen:next.bullpen,pitchingSource:update.source}};
   }
  }
  return result;
 });
 return {...snapshot,games};
}
