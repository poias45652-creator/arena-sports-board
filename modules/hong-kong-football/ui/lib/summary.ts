const involves=(game:FootballGame<string>,id:string)=>game.home.id===id||game.away.id===id;
export function summarizeFootballProfile(games:FootballGame<string>[],id:string){
 let wins=0,draws=0,losses=0,scored=0,conceded=0,cleanSheets=0,btts=0,over25=0;const recent:('勝'|'和'|'負')[]=[];
 for(const g of games){if(!involves(g,id)||g.homeScore===null||g.awayScore===null||g.state!=='final'||g.statusName!=='STATUS_FULL_TIME')continue;
  const own=g.home.id===id?g.homeScore:g.awayScore,against=g.home.id===id?g.awayScore:g.homeScore;
  scored+=own;conceded+=against;if(against===0)cleanSheets++;if(own>0&&against>0)btts++;if(own+against>2)over25++;
  if(own>against){wins++;recent.push('勝');}else if(own<against){losses++;recent.push('負');}else{draws++;recent.push('和');}
 }
 const count=wins+draws+losses,rate=(value:number)=>count?value/count:null;
 return {games:count,wins,draws,losses,scored,conceded,goalDifference:scored-conceded,winRate:rate(wins),scoredPerGame:rate(scored),concededPerGame:rate(conceded),cleanSheetRate:rate(cleanSheets),bttsRate:rate(btts),over25Rate:rate(over25),recent:recent.slice(0,5)};
}
