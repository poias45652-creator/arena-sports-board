import archive from '../data/retrosheet.json';
const data:any=archive;
export function retrosheetSummary(){return {source:data.source,attribution:data.attribution,preparedAt:data.preparedAt,seasons:data.seasons,games:data.games.length,eligibilityScope:'normal completed games only; not a trained or fully qualified model dataset',idScheme:'home Retrosheet team code + game-log date + game number; not MLB gamePk',eligibleBaselineGames:data.games.filter((g:any)=>g.trainingEligible).length,archives:data.archives,scope:data.scope,lineupAvailability:data.lineupAvailability,modelApplied:false,historicalOddsAvailable:false,advancedModelTrained:false};}
export function retrosheetMatch(awayId:number,homeId:number,before:string){
 // Historical dates are not live matchup IDs. Never infer a player MLB ID from a Retrosheet ID.
 const games=data.games.filter((g:any)=>g.trainingEligible&&g.completionDate<before);
 const stats=(id:number)=>{const rows=games.filter((g:any)=>g.awayId===id||g.homeId===id);let wins=0,runsFor=0,runsAgainst=0;for(const g of rows){const side=g.homeId===id?'home':'away',other=side==='home'?'away':'home';wins+=Number(g.result[side]>g.result[other]);runsFor+=g.result[side];runsAgainst+=g.result[other];}return {games:rows.length,wins,losses:rows.length-wins,runsFor,runsAgainst};};
 const headToHead=games.filter((g:any)=>(g.awayId===awayId&&g.homeId===homeId)||(g.awayId===homeId&&g.homeId===awayId)).map((g:any)=>({id:g.id,date:g.date,awayId:g.awayId,homeId:g.homeId,result:g.result,parkId:g.parkId}));
 return {...retrosheetSummary(),before,away:stats(awayId),home:stats(homeId),headToHead,modelApplied:false,usage:'historical_reference_only'};
}
// Paginated research records retain result labels separately from prior-day features.
export function retrosheetRecords(season:number,offset:number){const rows=data.games.filter((g:any)=>g.season===season);return {season,total:rows.length,offset,limit:100,rows:rows.slice(offset,offset+100),source:data.source,attribution:data.attribution,modelApplied:false};}
