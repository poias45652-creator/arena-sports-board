import type {SuperSnapshot} from './super007';

export type HrDisplayQuote = {
 id: number; primary: boolean; open: boolean;
 homeLine: string; awayLine: string; total: string;
 homePrice: string | number | null; awayPrice: string | number | null;
 over: string | number | null; under: string | number | null;
};
export type HrDisplayMarket = {period:'full'|'firstHalf'; type:number; quotes:HrDisplayQuote[]};

// Both encodings occur in the same baseball response: CPBL/KBO use 0/1,
// while the captured NPB/MLB format uses 10/11. Never infer other periods.
export function hrWagerPeriod(group:unknown):HrDisplayMarket['period']|null {
 return group===0||group===10?'full':group===1||group===11?'firstHalf':null;
}

/** Use SUPER's current baseball menu, rather than its incomplete hot-events category.
 * Public frontend app.fc4fbe31.js defines 3 = not playing, 101 = baseball,
 * 888888 = hot; getCatMenuKeys chooses the category's first WagerTypeKey.
 */
export function hrBaseballRequest(value:unknown):{GameType:3;CatID:101;WagerTypeKey?:number|string}|null {
 const response=value as any;
 if(String(response?.code)!=='200'||!Array.isArray(response.data?.list))throw new Error('SUPER 賽事選單格式改變');
 const menus=response.data.list.filter((m:any)=>m?.GameType===3);
 if(menus.length>1)throw new Error('SUPER 回傳重複賽前選單');
 if(!menus.length)return null;
 if(!Array.isArray(menus[0].LeftMenu?.item))throw new Error('SUPER 賽事分類選單格式改變');
 const categories=menus[0].LeftMenu.item.filter((c:any)=>c?.catid===101);
 if(categories.length>1)throw new Error('SUPER 回傳重複棒球分類');
 if(!categories.length)return null;
 if(!Array.isArray(categories[0].Items))throw new Error('SUPER 棒球玩法選單格式改變');
 const wager=categories[0].Items[0]?.WagerTypeKey;
 if(wager!==undefined&&wager!==null&&!(typeof wager==='number'?Number.isSafeInteger(wager)&&wager>0:typeof wager==='string'&&/^[1-9]\d{0,8}$/.test(wager)))throw new Error('SUPER 棒球玩法代碼無效');
 return {GameType:3,CatID:101,...(wager?{WagerTypeKey:wager}:{})};
}

/** Parse the observed GameDetail shape, without inventing a fetch timestamp. */
export function parseHrGameDetail(value: unknown, fetchedAt: string): SuperSnapshot {
 const response=value as any;
 if(String(response?.code)!=='200'||!Array.isArray(response.data)||!Number.isFinite(Date.parse(fetchedAt)))throw new Error('SUPER 資料回應格式無效');
 const games:any[]=[];const internationalGames:any[]=[];const sourceLeagues:{name:string;league:string|null;games:number}[]=[];
 for(const category of response.data){
  if(!category?.Items||!Array.isArray(category.Items.List))throw new Error('SUPER 賽事分類格式改變');
  for(const league of category.Items.List){
   // The existing prediction model is for MLB only; never apply it to another sport.
   const name=String(league?.LeagueNameStr||'').trim();
   const code=name==='MLB 美國職棒'?'MLB':/^(CPBL\b|中華職棒|中華職業棒球)/i.test(name)?'CPBL':/^(NPB\b|日本職棒)/i.test(name)?'NPB':/^(KBO\b|韓國職棒)/i.test(name)?'KBO':null;
   if(code||/棒球|baseball/i.test(String(category.CatName||'')))sourceLeagues.push({name:name.slice(0,100),league:code,games:Array.isArray(league.Team)?league.Team.length:0});
   if(!code)continue;
   if(!Array.isArray(league.Team))throw new Error('SUPER MLB 賽事格式改變');
   for(const team of league.Team){
    if(!Number.isInteger(team?.EvtID)||typeof team.HomeTeamStr!=='string'||typeof team.AwayTeamStr!=='string'||typeof team.ScheduleTimeStr!=='string'||!Array.isArray(team.Wager))throw new Error('SUPER MLB 資料欄位不完整');
    const open=team.EvtStatus===1;
    // Normalize both observed source encodings before selecting supported plays.
    // Keep closed primary rows for display, but never expose them to the model.
    const displayMarkets:HrDisplayMarket[]=team.Wager.flatMap((w:any)=>{
     const period=hrWagerPeriod(w?.WagerGrpID);
     if(!period||!(period==='full'?[103,104,106,111]:[103,104,105,111]).includes(w.WagerTypeID))return [];
     if(!Array.isArray(w.Odds))throw new Error('SUPER 賠率格式改變');
     return [{period,type:w.WagerTypeID,quotes:w.Odds.map((q:any,index:number)=>({
      primary:index===0,id:q.GameID,open:open&&q.Status===1,
      homeLine:q.HomeHdp??'',awayLine:q.AwayHdp??'',total:q.OULine??'',
      homePrice:q.HomeHdpOdds??q.HomeOdds??null,awayPrice:q.AwayHdpOdds??q.AwayOdds??null,
      over:q.OverOdds??null,under:q.UnderOdds??null
     }))}];
    });
    (code==='MLB'?games:internationalGames).push({...(code==='MLB'?{}:{league:code,leagueName:name}),id:team.EvtID,home:team.HomeTeamStr,away:team.AwayTeamStr,start:team.ScheduleTimeStr,live:team.Live!==false,
     displayMarkets,
     // Preserve the existing full-game-only recommendation contract.
     markets:displayMarkets.filter(m=>m.period==='full').map(m=>({type:m.type,quotes:m.quotes.filter(q=>q.open).map(({open,...q})=>q)}))});
   }
  }
 }
 if(new Set(internationalGames.map(g=>g.league+':'+g.id)).size!==internationalGames.length)throw new Error('SUPER 回傳重複聯盟賽事');
 if(new Set(games.map(g=>g.id)).size!==games.length)throw new Error('SUPER 回傳重複賽事，暫停配對');
 return {source:'hr9988',games,internationalGames,sourceLeagues,fetchedAt} as SuperSnapshot;
}
