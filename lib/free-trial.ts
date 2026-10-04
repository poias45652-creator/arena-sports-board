export type TrialSport='baseball'|'basketball'|'football';
export type TrialFixture={key:string;id:string;sport:TrialSport;league:string;leagueName:string;start:string;home:string;away:string;homeLogo?:string;awayLogo?:string};
export type TrialState='scheduled'|'live'|'final'|'postponed'|'cancelled'|'suspended'|'other';
export type TrialProgress={state:TrialState;label:string;home:number|null;away:number|null;observedAt:string;settleable:boolean;stale?:boolean};
export type TrialData={day:string;status:'ready'|'empty'|'unavailable';game?:TrialFixture;probabilities?:{home:number;away:number;draw?:number};expected?:{home:number;away:number};details?:{label:string;home:string;away:string}[];updatedAt:string;progress?:TrialProgress;predictionAt?:string;result?:'hit'|'miss'|'draw'|'no_pick'|'ungraded'};
export const trialDay=(now=Date.now())=>new Date(now+8*3600000).toISOString().slice(0,10);
export const onTrialDay=(start:string,day:string)=>Number.isFinite(Date.parse(start))&&new Date(Date.parse(start)+8*3600000).toISOString().slice(0,10)===day;
// Daily deterministic shuffle: reloading cannot reveal the other member fixtures.
export function dailyTrialPick<T extends {key:string}>(games:T[],day:string):T|undefined{
 const rank=(key:string)=>{let h=2166136261;for(const c of `maya-trial-v1:${day}:${key}`)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
 return [...games].sort((a,b)=>rank(a.key)-rank(b.key)||a.key.localeCompare(b.key))[0];
}
export function trialProbabilities(value:any):TrialData['probabilities']{
 if(!value||!['home','away'].every(k=>typeof value[k]==='number'&&Number.isFinite(value[k])&&value[k]>=0&&value[k]<=1))return undefined;
 const draw=value.draw;if(draw!==undefined&&(!Number.isFinite(draw)||draw<0||draw>1))return undefined;
 if(Math.abs(value.home+value.away+(draw||0)-1)>.015)return undefined;
 return {home:value.home,away:value.away,...(draw!==undefined?{draw}:{})};
}

export function trialPick(p:TrialData['probabilities']):'home'|'away'|'draw'|null{
 if(!p)return null;
 const rows:('home'|'away'|'draw')[]=p.draw===undefined?['home','away']:['home','away','draw'];
 rows.sort((a,b)=>(p[b]??0)-(p[a]??0));
 return (p[rows[0]]??0)>(p[rows[1]]??0)?rows[0]:null;
}
export function trialResult(data:TrialData):TrialData['result']{
 const s=data.progress;
 if(s?.state!=='final')return undefined;
 if(!s.settleable||s.home===null||s.away===null)return 'ungraded';
 if(!data.predictionAt||!data.game||Date.parse(data.predictionAt)>=Date.parse(data.game.start))return 'no_pick';
 const pick=trialPick(data.probabilities);if(!pick)return 'no_pick';
 if(s.home===s.away){
  if(data.game.sport==='basketball')return 'ungraded';
  return pick==='draw'?'hit':data.game.sport==='baseball'?'draw':'miss';
 }
 return pick===(s.home>s.away?'home':'away')?'hit':'miss';
}
export function retainTrialProgress(old:TrialProgress|undefined,next:TrialProgress|undefined):TrialProgress|undefined{
 if(!next)return old?{...old,stale:true}:undefined;
 if(old&&(Date.parse(next.observedAt)<Date.parse(old.observedAt)||old.state==='final'&&next.state!=='final'||old.state==='live'&&next.state==='scheduled'))return {...old,stale:true};
 return next;
}
