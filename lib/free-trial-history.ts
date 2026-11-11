import {trialDay,trialProbabilities,trialResult,type TrialData,type TrialFixture,type TrialProgress} from './free-trial';
type SavedTrial={day:string;fixture_key:string;fixture:string;forecast:string|null;progress:string|null};
export function savedTrialHistory(rows:SavedTrial[],now=Date.now()):TrialData[]{
 const counts=new Map<string,number>(),seen=new Set<string>(),out:TrialData[]=[];
 for(const row of [...rows].sort((a,b)=>b.day.localeCompare(a.day))){
  try{
   if(!/^\d{4}-\d{2}-\d{2}$/.test(row.day)||row.day>trialDay(now))continue;
   const g=JSON.parse(row.fixture),f=row.forecast?JSON.parse(row.forecast):null;
   if(!g||!['baseball','basketball','football'].includes(g.sport)||!['key','id','league','home','away','start'].every(k=>typeof g[k]==='string'&&g[k].trim())||g.key!==row.fixture_key||seen.has(g.key))continue;
   const start=Date.parse(g.start),at=Date.parse(f?.predictionAt),probabilities=trialProbabilities(f?.probabilities);
   if(!Number.isFinite(start)||trialDay(start)!==row.day||!Number.isFinite(at)||at>=start||at>now||!probabilities||!['key','id','sport','league','start','home','away'].every(k=>f?.game?.[k]===g[k]))continue;
   if((counts.get(g.sport)||0)>=5)continue;
   const game:TrialFixture={key:g.key,id:g.id,sport:g.sport,league:g.league,leagueName:typeof g.leagueName==='string'?g.leagueName:g.league,start:g.start,home:g.home,away:g.away};
   const p=row.progress?JSON.parse(row.progress):undefined;
   let progress:TrialProgress|undefined;
   if(p&&['scheduled','live','final','postponed','cancelled','suspended','other'].includes(p.state)&&Number.isFinite(Date.parse(p.observedAt))){
    const score=(n:unknown)=>typeof n==='number'&&Number.isInteger(n)&&n>=0?n:null;
    progress={state:p.state,label:typeof p.label==='string'?p.label:'賽況待更新',home:score(p.home),away:score(p.away),observedAt:p.observedAt,settleable:p.settleable===true,...(p.stale?{stale:true}:{})};
   }
   const data:TrialData={day:row.day,status:'ready',updatedAt:new Date(now).toISOString(),game,probabilities,predictionAt:f.predictionAt,progress};
   data.result=trialResult(data);
   out.push(data);seen.add(g.key);counts.set(g.sport,(counts.get(g.sport)||0)+1);
  }catch{/* One malformed saved record must not hide other published recommendations. */}
 }
 return out;
}

