import {parseBaseballSettings,type BaseballModelSettings} from './baseball-model-settings';
import {parseFootballSettings,type FootballModelSettings} from './football-model-weights';
import {normalizedWeights,type Weights} from './basketball-efficiency';
export type TeamWeightProfile={teamId:string;teamName:string;league:string;value:unknown;updatedAt:number};
export type TeamWeightBook=Record<string,TeamWeightProfile>;
export const teamWeightStorageKey=(league:string)=>`xingzhun:team-weights:v1:${league}`;
export const validTeamId=(id:unknown):id is string=>typeof id==='string'&&/^[A-Za-z0-9._:-]{1,80}$/.test(id)&&!['__proto__','constructor','prototype'].includes(id);
export function teamWeightValue(league:string,value:any):unknown|null{
 if(['MLB','NPB','CPBL','KBO'].includes(league)){const parsed=parseBaseballSettings(value);if(!parsed)return null;const {teams:_,...base}=parsed;return base;}
 if(league==='NBA'||league==='WNBA'){
  try{if(value?.version!==1||!Array.isArray(value.weights))return null;return {version:1,weights:normalizedWeights(value.weights).map(n=>n*100)};}catch{return null;}
 }
 return parseFootballSettings(value);
}
export function readTeamWeightBook(serialized:string|null,league:string,now=Date.now()):TeamWeightBook{
 try{
  if(!serialized||serialized.length>250000)return {};
  const raw=JSON.parse(serialized);if(raw?.version!==1||!Array.isArray(raw.profiles)||raw.profiles.length>100)return {};
  const result:TeamWeightBook={};
  for(const p of raw.profiles){
   if(!p||p.league!==league||!validTeamId(p.teamId)||typeof p.teamName!=='string'||p.teamName.length>100||!Number.isFinite(p.updatedAt)||p.updatedAt>now+5000||now-p.updatedAt>7*86400000)continue;
   const value=teamWeightValue(league,p.value);if(value)result[p.teamId]={teamId:p.teamId,teamName:p.teamName,league,value,updatedAt:p.updatedAt};
  }
  return result;
 }catch{return {};}
}
export function saveTeamWeightProfiles(storage:Pick<Storage,'getItem'|'setItem'>,league:string,profiles:TeamWeightProfile[],now=Date.now()){
 const book=readTeamWeightBook(storage.getItem(teamWeightStorageKey(league)),league,now);
 for(const p of profiles){const value=teamWeightValue(league,p.value);if(p.league!==league||!validTeamId(p.teamId)||!value)throw Error('球隊權重格式錯誤');book[p.teamId]={...p,value,updatedAt:now};}
 const sorted=Object.values(book).sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,100);
 storage.setItem(teamWeightStorageKey(league),JSON.stringify({version:1,profiles:sorted}));
}
export const teamValues=(book:TeamWeightBook,home:string,away:string)=>[home,away].flatMap(id=>Object.hasOwn(book,id)?[book[id].value]:[]);
export function footballTeamSettings(base:FootballModelSettings,book:TeamWeightBook,home:string,away:string):FootballModelSettings{
 const values=teamValues(book,home,away).map(parseFootballSettings).filter((v):v is FootballModelSettings=>!!v);
 if(!values.length)return base;
 const weights:FootballModelSettings['weights']={};
 for(const key of ['recent','calibrated','elo','score'] as const){const rows=values.flatMap(s=>s.weights[key]?[s.weights[key]!]:[]);if(rows.length)weights[key]=rows[0].map((_,i)=>rows.reduce((s,r)=>s+r[i],0)/rows.length);}
 return {model:'auto',weights};
}
/** Keep the configuration actually used before kickoff when profiles change later. */
export function footballFixtureSettings(storage:Pick<Storage,'getItem'|'setItem'>,league:string,fixture:{id:string;start:string;homeId:string;awayId:string},base:FootballModelSettings,book:TeamWeightBook,now=Date.now()):FootballModelSettings{
 const start=Date.parse(fixture.start);if(!Number.isFinite(start))return base;
 const key=`xingzhun:fixture-weights:v1:${league}`,identity=JSON.stringify([fixture.id,start,fixture.homeId,fixture.awayId]);
 let entries:{id:string;start:number;savedAt:number;settings:FootballModelSettings}[]=[];
 try{
  const raw=storage.getItem(key);const list=raw&&raw.length<200000?JSON.parse(raw):[];
  if(Array.isArray(list))entries=list.slice(0,80).filter(e=>e&&typeof e.id==='string'&&Number.isFinite(e.start)&&e.start>=now-2*86400000&&Number.isFinite(e.savedAt)&&e.savedAt<e.start&&e.savedAt<=now&&parseFootballSettings(e.settings));
 }catch{/* Storage may be disabled. */}
 if(now>=start)return entries.find(e=>e.id===identity)?.settings||base;
 const settings=footballTeamSettings(base,book,fixture.homeId,fixture.awayId);
 try{storage.setItem(key,JSON.stringify([{id:identity,start,savedAt:now,settings},...entries.filter(e=>e.id!==identity)].slice(0,80)));}catch{/* Session calculation remains available. */}
 return settings;
}
export function basketballTeamWeights(base:Weights,book:TeamWeightBook,home:string,away:string):Weights{
 const values=teamValues(book,home,away).flatMap((v:any)=>{try{return [normalizedWeights(v.weights)];}catch{return [];}});
 return values.length?base.map((_,i)=>100*values.reduce((sum,v)=>sum+v[i],0)/values.length) as Weights:base;
}
export function baseballTeamSettings(base:BaseballModelSettings,book:TeamWeightBook):BaseballModelSettings{
 const teams:NonNullable<BaseballModelSettings['teams']>={};
 for(const [id,p] of Object.entries(book)){const value=parseBaseballSettings(p.value);if(value){const {teams:_,...settings}=value;teams[id]=settings;}}
 return Object.keys(teams).length?{...base,teams}:base;
}
/** Bounded sample-quality adjustment, not fitted or advertised as optimal.
 * Unmeasured factors retain their neutral budget; only measured shares are rebalanced. */
export function adaptiveTeamWeights(base:number[],reliability:(number|null)[]):number[]|null{
 if(base.length!==reliability.length||base.some(n=>!Number.isFinite(n)||n<0)||Math.abs(base.reduce((a,b)=>a+b,0)-100)>.01)return null;
 const active=base.map((n,i)=>n>0&&typeof reliability[i]==='number'&&Number.isFinite(reliability[i])&&reliability[i]!>=0&&reliability[i]!<=1);
 if(active.filter(Boolean).length<2)return null;
 const budget=base.reduce((sum,n,i)=>sum+(active[i]?n:0),0),scaled=base.map((n,i)=>active[i]?n*(.85+.3*reliability[i]!):0),total=scaled.reduce((a,b)=>a+b,0);
 if(!total)return null;
 // Largest-remainder rounding gives exactly 100.0% on both cards and calculation inputs.
 const raw=base.map((n,i)=>active[i]?budget*scaled[i]/total:n),units=raw.map(n=>Math.floor(n*10)),remaining=1000-units.reduce((a,b)=>a+b,0);
 const order=raw.map((n,i)=>({i,r:n*10-units[i]})).sort((a,b)=>b.r-a.r||a.i-b.i);
 for(let i=0;i<remaining;i++)units[order[i%order.length].i]++;
 return units.map(n=>n/10);
}
