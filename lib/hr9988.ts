import type {SuperSnapshot} from './super007';

export type HrDisplayQuote = {
 id: number; primary: boolean; open: boolean;
 homeLine: string; awayLine: string; total: string;
 homePrice: string | number | null; awayPrice: string | number | null;
 over: string | number | null; under: string | number | null;
};
export type HrDisplayMarket = {period:'full'|'firstHalf'; type:number; quotes:HrDisplayQuote[]};


/** Parse the observed CatID/WagerTypeKey=888888 response, without inventing a fetch timestamp. */
export function parseHrGameDetail(value: unknown, fetchedAt: string): SuperSnapshot {
 const response=value as any;
 if(String(response?.code)!=='200'||!Array.isArray(response.data)||!Number.isFinite(Date.parse(fetchedAt)))throw new Error('SUPER 盤口回應格式無效');
 const games:any[]=[];
 for(const category of response.data){
  if(!category?.Items||!Array.isArray(category.Items.List))throw new Error('SUPER 賽事分類格式改變');
  for(const league of category.Items.List){
   // The existing prediction model is for MLB only; never apply it to another sport.
   if(league?.LeagueNameStr!=='MLB 美國職棒')continue;
   if(!Array.isArray(league.Team))throw new Error('SUPER MLB 賽事格式改變');
   for(const team of league.Team){
    if(!Number.isInteger(team?.EvtID)||typeof team.HomeTeamStr!=='string'||typeof team.AwayTeamStr!=='string'||typeof team.ScheduleTimeStr!=='string'||!Array.isArray(team.Wager))throw new Error('SUPER MLB 盤口欄位不完整');
    const open=team.EvtStatus===1;
    // Observed source menu: group 10 = 全場; group 11 = 上半.
    // Keep closed primary rows for display, but never expose them to the model.
    const displayMarkets:HrDisplayMarket[]=team.Wager.filter((w:any)=>w?.WagerGrpID===10?[103,104,106,111].includes(w.WagerTypeID):w?.WagerGrpID===11&&[103,104,105,111].includes(w.WagerTypeID)).map((w:any)=>{
     if(!Array.isArray(w.Odds))throw new Error('SUPER 賠率格式改變');
     return {period:w.WagerGrpID===10?'full':'firstHalf',type:w.WagerTypeID,quotes:w.Odds.map((q:any,index:number)=>({
      primary:index===0,id:q.GameID,open:open&&q.Status===1,
      homeLine:q.HomeHdp??'',awayLine:q.AwayHdp??'',total:q.OULine??'',
      homePrice:q.HomeHdpOdds??q.HomeOdds??null,awayPrice:q.AwayHdpOdds??q.AwayOdds??null,
      over:q.OverOdds??null,under:q.UnderOdds??null
     }))};
    });
    games.push({id:team.EvtID,home:team.HomeTeamStr,away:team.AwayTeamStr,start:team.ScheduleTimeStr,live:team.Live!==false,
     displayMarkets,
     // Preserve the existing full-game-only recommendation contract.
     markets:displayMarkets.filter(m=>m.period==='full').map(m=>({type:m.type,quotes:m.quotes.filter(q=>q.open).map(({open,...q})=>q)}))});
   }
  }
 }
 if(new Set(games.map(g=>g.id)).size!==games.length)throw new Error('SUPER 回傳重複賽事，暫停配對');
 return {source:'hr9988',games,fetchedAt};
}
