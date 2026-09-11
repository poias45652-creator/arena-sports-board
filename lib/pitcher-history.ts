// MLB feed startSpeed is retained as its own metric; it is not Statcast release_speed.
type Arsenal={count:number;measured:number;speedSum:number};
export type PitchSample={count:number;arsenal:Record<string,Arsenal>};
export function parsePitchEvents(data:any,gamePk:number):Record<string,PitchSample>{
 if(data?.gamePk!==gamePk||data.gameData?.status?.abstractGameState!=='Final'||!Array.isArray(data.liveData?.plays?.allPlays))throw new Error('逐球資料尚未完賽或格式不符');
 const result:Record<string,PitchSample>={},seen=new Set<string>();
 for(const play of data.liveData.plays.allPlays){
  // An at-bat with a mid-appearance pitching change cannot safely be assigned using its final matchup.
  if((play.playEvents||[]).some((e:any)=>e.details?.eventType==='pitching_substitution'))continue;
  const id=play.matchup?.pitcher?.id;if(!Number.isInteger(id))continue;
  for(const e of play.playEvents||[]){
   if(e.isPitch!==true)continue;
   const key=e.playId||`${play.about?.atBatIndex}:${e.index}`;
   if(!e.playId&&(!Number.isInteger(play.about?.atBatIndex)||!Number.isInteger(e.index)))throw new Error('逐球事件缺少識別碼');
   if(seen.has(key))continue;seen.add(key);
   const sample=result[id]??={count:0,arsenal:{}};sample.count++;
   const type=typeof e.details?.type?.code==='string'?e.details.type.code:'unknown';
   const bucket=sample.arsenal[type]??={count:0,measured:0,speedSum:0};bucket.count++;
   const speed=e.pitchData?.startSpeed;
   if(typeof speed==='number'&&Number.isFinite(speed)&&speed>0&&speed<130){bucket.measured++;bucket.speedSum+=speed;}
  }
 }
 return result;
}
export function recentPitcherGames(data:any,pitcherId:number,through:string){
 const splits=data?.stats?.find((s:any)=>s.type?.displayName==='gameLog'&&s.group?.displayName==='pitching')?.splits;
 if(!Array.isArray(splits))throw new Error('投手逐場紀錄格式不符');
 const games=splits.filter((s:any)=>s.player?.id===pitcherId&&s.gameType==='R'&&/^\d{4}-\d{2}-\d{2}$/.test(s.date)&&s.date<=through&&Number.isInteger(s.game?.gamePk)).sort((a:any,b:any)=>b.date.localeCompare(a.date)||b.game.gamePk-a.game.gamePk);
 const seen=new Set<number>();return games.filter((g:any)=>{if(seen.has(g.game.gamePk))return false;seen.add(g.game.gamePk);return true;}).slice(0,5).map((g:any)=>({gamePk:g.game.gamePk,date:g.date,name:g.player.fullName,officialPitchCount:Number.isInteger(g.stat?.numberOfPitches)?g.stat.numberOfPitches:null,innings:g.stat?.inningsPitched??null,strikeouts:g.stat?.strikeOuts??null,walks:g.stat?.baseOnBalls??null,earnedRuns:g.stat?.earnedRuns??null,started:g.stat?.gamesStarted===1}));
}
export function summarizeArsenal(samples:(PitchSample|null)[]){
 const all:Record<string,Arsenal>={};let total=0;
 for(const sample of samples){if(!sample)continue;total+=sample.count;for(const [type,b] of Object.entries(sample.arsenal)){const a=all[type]??={count:0,measured:0,speedSum:0};a.count+=b.count;a.measured+=b.measured;a.speedSum+=b.speedSum;}}
 return Object.entries(all).map(([type,b])=>({type,pitches:b.count,measuredPitches:b.measured,usage:total?b.count/total:null,averageStartSpeedMph:b.measured?b.speedSum/b.measured:null}));
}
const cache=new Map<string,{expires:number;value:any}>(),pending=new Map<string,Promise<any>>();
async function memo(key:string,ttl:number,run:()=>Promise<any>){
 const c=cache.get(key);if(c&&c.expires>Date.now())return c.value;if(pending.has(key))return pending.get(key)!;
 const task=run().then(value=>{if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(key,{value,expires:Date.now()+ttl});return value;}).finally(()=>pending.delete(key));pending.set(key,task);return task;
}
async function json(url:string){const r=await fetch(url,{signal:AbortSignal.timeout(6000)});if(!r.ok)throw new Error('MLB 來源暫時無法讀取');const text=await r.text();if(text.length>6000000)throw new Error('逐球資料超出上限');return JSON.parse(text);}
export async function getPitcherHistory(pitcherId:number){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const through=new Date(Date.parse(today+'T12:00:00Z')-86400000).toISOString().slice(0,10),season=Number(today.slice(0,4));
 return memo(`pitcher:${pitcherId}:${today}`,3600000,async()=>{
  const source=`https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats?stats=gameLog&group=pitching&season=${season}`;
  const games=recentPitcherGames(await json(source),pitcherId,through),details=[];
  for(const g of games){
   let sample:PitchSample|null=null,error:string|null=null;
   try{const all=await memo('game:'+g.gamePk,3600000,async()=>parsePitchEvents(await json(`https://statsapi.mlb.com/api/v1.1/game/${g.gamePk}/feed/live`),g.gamePk));sample=all[pitcherId]??null;if(!sample)error='缺少這位投手的逐球資料';}catch{error='逐球資料暫不可用';}
   details.push({...g,sample,error,pitchCountMatches:sample&&g.officialPitchCount!==null?sample.count===g.officialPitchCount:null});
  }
  const arsenal=summarizeArsenal(details.map(g=>g.sample));
  const latest=summarizeArsenal([details[0]?.sample??null]),prior=summarizeArsenal(details.slice(1).map(g=>g.sample));
  const speedChanges=latest.map(a=>{const b=prior.find(b=>b.type===a.type);return {type:a.type,latestMeasured:a.measuredPitches,priorMeasured:b?.measuredPitches??0,deltaMph:a.measuredPitches>=10&&(b?.measuredPitches??0)>=20&&a.averageStartSpeedMph!==null&&b?.averageStartSpeedMph!=null?a.averageStartSpeedMph-b.averageStartSpeedMph:null};});
  return {pitcherId,season,through,source,metric:'MLB feed pitchData.startSpeed (mph)',statcastStatus:'not_connected',fetchedAt:new Date().toISOString(),status:!details.length?'no_games':details.some(d=>d.error||d.pitchCountMatches!==true)?'partial':'ready',games:details,arsenal,speedChanges,modelApplied:false};
 });
}
