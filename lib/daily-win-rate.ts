import type {Database} from '../db';

export const DAILY_SPORTS=['MLB','NBA','WNBA','FOOTBALL'] as const;
export type DailySport=typeof DAILY_SPORTS[number];
export type DailyPick='home'|'away'|'draw';

export const dailySportDay=(value:string|number|Date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export const validDailyDay=(day:string)=>/^\d{4}-\d{2}-\d{2}$/.test(day)&&Number.isFinite(Date.parse(day))&&new Date(day).toISOString().slice(0,10)===day;

function direction(probabilities:{home:number;away:number;draw?:number}):DailyPick|null{
 const rows:[DailyPick,number][]=[['home',probabilities.home],['away',probabilities.away],...(probabilities.draw===undefined?[]:[['draw',probabilities.draw] as [DailyPick,number]])];
 if(rows.some(([,p])=>!Number.isFinite(p)||p<0||p>1))return null;
 const sorted=rows.sort((a,b)=>b[1]-a[1]);
 return sorted.length>1&&Math.abs(sorted[0][1]-sorted[1][1])<=1e-9?null:sorted[0][0];
}
function teamName(team:any){return String(team?.name||team?.zh||team?.displayName||'').trim();}

export async function saveDailyForecast(db:Database,sport:DailySport,game:any,probabilities:{home:number;away:number;draw?:number},capturedAt:string,version:string){
 if(!DAILY_SPORTS.includes(sport))return false;
 const start=Date.parse(game?.start||game?.date),captured=Date.parse(capturedAt),pick=direction(probabilities);
 if(!pick||!game?.id||!Number.isFinite(start)||!Number.isFinite(captured)||captured>=start||Date.now()>=start)return false;
 const home=teamName(game.home),away=teamName(game.away);if(!home||!away||home===away)return false;
 const id=[sport,game.id,new Date(start).toISOString()].join('|'),day=dailySportDay(start);
 const payload=JSON.stringify({home,away,probabilities,pick,version});
 await db.prepare(`INSERT INTO daily_forecasts (id,sport,game_id,day,start_time,captured_at,pick,payload) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT (id) DO UPDATE SET captured_at=excluded.captured_at,pick=excluded.pick,payload=excluded.payload WHERE daily_forecasts.captured_at<excluded.captured_at AND excluded.captured_at<daily_forecasts.start_time`).bind(id,sport,String(game.id),day,new Date(start).toISOString(),new Date(captured).toISOString(),pick,payload).run();
 return true;
}

export async function saveDailyResults(db:Database,sport:DailySport,games:any[],now=Date.now()){
 let count=0;
 for(const game of games){
  const start=Date.parse(game?.start||game?.date),home=Number(game?.homeScore),away=Number(game?.awayScore);
  const final=game?.state==='final'||game?.status?.abstractGameState==='Final'||game?.final===true;
  if(!final||!game?.id||!Number.isFinite(start)||start>=now||!Number.isInteger(home)||!Number.isInteger(away)||home<0||away<0)continue;
  if(sport!=='FOOTBALL'&&home===away)continue;
  const id=[sport,game.id,new Date(start).toISOString()].join('|'),day=dailySportDay(start);
  await db.prepare(`INSERT INTO daily_results (id,sport,game_id,day,start_time,home_score,away_score,fetched_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT (id) DO UPDATE SET home_score=excluded.home_score,away_score=excluded.away_score,fetched_at=excluded.fetched_at`).bind(id,sport,String(game.id),day,new Date(start).toISOString(),home,away,new Date(now).toISOString()).run();count++;
 }
 return count;
}

export async function saveDailyResult(db:Database,sport:DailySport,game:{id:string|number;start:string;homeScore:number;awayScore:number},now=Date.now()){
 return saveDailyResults(db,sport,[{...game,state:'final'}],now);
}

export type DailySportSummary={sport:DailySport;recommendations:number;hits:number;misses:number;pending:number;winRate:number|null};
export async function summarizeDailyWinRate(db:Database,day:string){
 if(!validDailyDay(day))throw new Error('Invalid daily win-rate date');
 const rows=await db.prepare(`SELECT f.id,f.sport,f.pick,r.home_score,r.away_score FROM daily_forecasts f LEFT JOIN daily_results r ON r.id=f.id WHERE f.day=? AND f.sport IN ('MLB','NBA','WNBA','FOOTBALL') ORDER BY f.start_time,f.id`).bind(day).all();
 const base=Object.fromEntries(DAILY_SPORTS.map(s=>[s,{sport:s,recommendations:0,hits:0,misses:0,pending:0,winRate:null}])) as Record<DailySport,DailySportSummary>;
 for(const row of rows.results??[]){
  const sport=row.sport as DailySport;if(!DAILY_SPORTS.includes(sport))continue;const item=base[sport];item.recommendations++;
  if(row.home_score===null||row.home_score===undefined||row.away_score===null||row.away_score===undefined){item.pending++;continue;}
  const home=Number(row.home_score),away=Number(row.away_score);if(!Number.isInteger(home)||!Number.isInteger(away)){item.pending++;continue;}
  const actual:DailyPick=home>away?'home':home<away?'away':'draw';
  if(row.pick===actual)item.hits++;else item.misses++;
 }
 for(const item of Object.values(base)){const settled=item.hits+item.misses;item.winRate=settled?item.hits/settled:null;}
 const sports=DAILY_SPORTS.map(s=>base[s]),hits=sports.reduce((n,s)=>n+s.hits,0),misses=sports.reduce((n,s)=>n+s.misses,0),pending=sports.reduce((n,s)=>n+s.pending,0),recommendations=sports.reduce((n,s)=>n+s.recommendations,0),settled=hits+misses;
 return {day,sports,total:{recommendations,hits,misses,pending,settled,winRate:settled?hits/settled:null},scope:'每場只計一個賽前主勝負方向；僅 MLB、NBA、WNBA、足球。KBO、CPBL 不顯示也不計入。未完賽不計勝率。'};
}


async function insertHistoricalForecast(db:Database,sport:DailySport,game:any,probabilities:{home:number;away:number;draw?:number},capturedAt:string,version:string){
 const start=Date.parse(game?.start||game?.date),captured=Date.parse(capturedAt),pick=direction(probabilities);
 if(!pick||!game?.id||!Number.isFinite(start)||!Number.isFinite(captured)||captured>=start)return false;
 const home=teamName(game.home),away=teamName(game.away);if(!home||!away||home===away)return false;
 const id=[sport,game.id,new Date(start).toISOString()].join('|'),day=dailySportDay(start);
 const payload=JSON.stringify({home,away,probabilities,pick,version,legacyBackfill:true});
 await db.prepare(`INSERT INTO daily_forecasts (id,sport,game_id,day,start_time,captured_at,pick,payload) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT (id) DO NOTHING`).bind(id,sport,String(game.id),day,new Date(start).toISOString(),new Date(captured).toISOString(),pick,payload).run();
 return true;
}

export async function backfillLegacyDaily(db:Database,day:string){
 if(!validDailyDay(day))throw new Error('Invalid daily backfill date');
 const start=new Date(Date.parse(day+'T00:00:00+08:00')).toISOString(),end=new Date(Date.parse(day+'T00:00:00+08:00')+86400000).toISOString();
 let forecasts=0,results=0;
 const mlb=await db.prepare(`SELECT s.game_id,s.start_time,s.captured_at,s.version,s.payload,r.home,r.away FROM analysis_snapshots s LEFT JOIN analysis_results r ON r.game_id=s.game_id AND r.scheduled_start=s.start_time WHERE s.start_time>=? AND s.start_time<? AND s.captured_at<s.start_time AND s.captured_at=(SELECT MAX(s2.captured_at) FROM analysis_snapshots s2 WHERE s2.game_id=s.game_id AND s2.start_time=s.start_time AND s2.captured_at<s2.start_time)`).bind(start,end).all();
 for(const row of mlb.results??[]){try{const report=JSON.parse(String(row.payload)),p=Number(report?.trialWin?.homeWin);if(Number.isFinite(p)&&p>=0&&p<=1&&Math.abs(p-.5)>1e-9&&!report?.issues?.some((x:string)=>x.includes('衝突')||x.includes('先發投手來源不一致'))){forecasts+=Number(await insertHistoricalForecast(db,'MLB',report.game,{home:p,away:1-p},String(row.captured_at),String(report?.trialWin?.version||row.version)));}if(Number.isInteger(Number(row.home))&&Number.isInteger(Number(row.away))&&Number(row.home)!==Number(row.away)){results+=await saveDailyResult(db,'MLB',{id:row.game_id,start:String(row.start_time),homeScore:Number(row.home),awayScore:Number(row.away)});}}catch{/* Invalid legacy row is skipped. */}}
 const football=await db.prepare(`SELECT f.league,f.game_id,f.start_time,f.captured_at,f.version,f.payload,r.home_goals,r.away_goals FROM football_forecasts f LEFT JOIN football_results r ON r.league=f.league AND r.game_id=f.game_id AND r.start_time=f.start_time WHERE f.start_time>=? AND f.start_time<? AND f.captured_at<f.start_time AND f.captured_at=(SELECT MAX(f2.captured_at) FROM football_forecasts f2 WHERE f2.league=f.league AND f2.game_id=f.game_id AND f2.start_time=f.start_time AND f2.captured_at<f2.start_time)`).bind(start,end).all();
 for(const row of football.results??[]){try{const payload=JSON.parse(String(row.payload)),p=payload?.probabilities,game={id:row.game_id,start:row.start_time,home:payload.home,away:payload.away};if(p)forecasts+=Number(await insertHistoricalForecast(db,'FOOTBALL',game,p,String(row.captured_at),String(row.version)));if(Number.isInteger(Number(row.home_goals))&&Number.isInteger(Number(row.away_goals)))results+=await saveDailyResult(db,'FOOTBALL',{id:row.game_id,start:String(row.start_time),homeScore:Number(row.home_goals),awayScore:Number(row.away_goals)});}catch{/* Invalid legacy row is skipped. */}}
 return {forecasts,results};
}
