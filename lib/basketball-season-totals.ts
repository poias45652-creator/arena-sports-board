type League = 'NBA' | 'WNBA';
type SeasonLine = {games:number; points:number; rebounds:number; assists:number; values:Record<string,string>};
type SeasonTable = Map<number, SeasonLine | null>;

export function basketballSeasonUrl(league:League, year:number) {
 const season = league === 'NBA' ? `${year-1}-${String(year).slice(-2)}` : String(year);
 const params = new URLSearchParams({
  LeagueID:league === 'NBA' ? '00' : '10', Season:season, SeasonType:'Regular Season',
  PerMode:'PerGame', MeasureType:'Base', PlusMinus:'N', PaceAdjust:'N', Rank:'N',
  Outcome:'', Location:'', Month:'0', SeasonSegment:'', DateFrom:'', DateTo:'',
  OpponentTeamID:'0', VsConference:'', VsDivision:'', GameSegment:'', Period:'0',
  ShotClockRange:'', LastNGames:'0',
 });
 return new URL(`https://stats.${league.toLowerCase()}.com/stats/leaguedashplayerstats?${params}`);
}

export function parseBasketballSeason(raw:any, url:URL):SeasonTable {
 const params = raw?.parameters;
 if (raw?.resource !== 'leaguedashplayerstats' || !params ||
     [...url.searchParams].some(([key,value]) => String(params[key] ?? '') !== value) ||
     params.TeamID || params.PlayerID || params.Conference || params.Division || params.ActiveRoster)
  throw Error('聯盟或球季統計範圍不符');
 const table = raw.resultSets?.find((s:any) => s.name === 'LeagueDashPlayerStats');
 if (!Array.isArray(table?.headers) || !Array.isArray(table.rowSet) || !table.rowSet.length)
  throw Error('聯盟球季統計尚未提供');
 const keys = ['PLAYER_ID','GP','PTS','REB','AST'];
 if (!keys.every(k => table.headers.includes(k))) throw Error('聯盟統計缺少必要欄位');
 const result:SeasonTable = new Map();
 for (const row of table.rowSet) {
  if (!Array.isArray(row) || row.length !== table.headers.length) throw Error('聯盟統計格式不符');
  const stat = (key:string) => row[table.headers.indexOf(key)];
  const [id,games,points,rebounds,assists] = keys.map(stat);
  if (!Number.isSafeInteger(id) || id <= 0) throw Error('球員編號不符');
  // Multiple rows can represent separate stints. Keep the existing whole-season source in that case.
  if (result.has(id) || !Number.isInteger(games) || games < 0 ||
      ![points,rebounds,assists].every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0)) {
   result.set(id,null);
   continue;
  }
  const values:Record<string,string> = {gamesPlayed:String(games),avgPoints:String(points),avgRebounds:String(rebounds),avgAssists:String(assists)};
  for (const [key,column] of Object.entries({avgMinutes:'MIN',avgSteals:'STL',avgBlocks:'BLK',avgTurnovers:'TOV',fieldGoalPct:'FG_PCT',threePointFieldGoalPct:'FG3_PCT',freeThrowPct:'FT_PCT'})) {
   const n = stat(column);
   if (typeof n === 'number' && Number.isFinite(n)) values[key] = key.endsWith('Pct') ? String(Math.round(n*1000)/10) : String(n);
  }
  result.set(id,{games,points,rebounds,assists,values});
 }
 return result;
}

type CachedTable = {until:number; value:Promise<SeasonTable | null>};
const cache = new Map<string,CachedTable>();
export function officialBasketballSeason(league:League, year:number):Promise<SeasonTable | null> {
 const url = basketballSeasonUrl(league,year), key = url.href;
 const hit = cache.get(key);
 if (hit && hit.until > Date.now()) return hit.value;
 const entry:CachedTable = {until:Date.now()+300000,value:load()};
 async function load() {
  try {
   const site = `https://www.${league.toLowerCase()}.com`;
   const response = await fetch(url.href,{cache:'no-store',signal:AbortSignal.timeout(12000),
    headers:{Accept:'application/json','User-Agent':'Mozilla/5.0 (compatible; XingzhunSports/1.0)',Origin:site,Referer:site+'/','x-nba-stats-origin':'stats','x-nba-stats-token':'true'}});
   if (!response.ok) throw Error('聯盟統計暫時無法讀取');
   return parseBasketballSeason(await response.json(),url);
  } catch {
   const cached = cache.get(key);
   if (cached) cached.until = Date.now()+30000;
   return null;
  }
 }
 if (cache.size >= 48) cache.delete(cache.keys().next().value!);
 cache.set(key,entry);
 return entry.value;
}

export function playerSeasonResult(table:SeasonTable|null, officialId:number|undefined) {
 if (!table || !officialId) return {line:null,missing:false};
 const line = table.get(officialId);
 return {line:line && line.games > 0 ? line : null, missing:line === undefined || line?.games === 0};
}

export const noRegularAppearance = '官方例行賽尚無此球員的出賽紀錄';
