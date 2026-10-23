import {type AiMatch,type AiSuggestion,type AiTeamSuggestion} from '@/lib/ai-assistant';
import {adaptiveTeamWeights,teamWeightStorageKey,validTeamId} from '@/lib/team-model-settings';
import {defaultBaseballSettings,BASEBALL_FACTOR_LABELS} from '@/lib/baseball-model-settings';
import {defaultNbaWeights,NBA_WEIGHT_LABELS} from '@/lib/nba-model-weights';
import {footballModelCatalog} from '@/lib/football-model-catalog';
import {FOOTBALL_FACTOR_LABELS} from '@/lib/football-model-weights';
import {isFootballLeague} from '@/lib/football';
const valid=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
const confidence=(n:unknown,prior:number)=>valid(n)?n/(n+prior):null;
const num=(n:number)=>Number(n.toFixed(2));
export function aiTeamSuggestion(match:AiMatch,analysis:any,kind:'baseball'|'basketball'|'football'):AiSuggestion|null{
 if(!validTeamId(match.homeId)||!validTeamId(match.awayId)||match.homeId===match.awayId)return null;
 const teams:AiTeamSuggestion[]=[];
 for(const side of ['home','away'] as const){
  const id=match[side+'Id' as 'homeId'|'awayId']!,name=match[side];
  let values:number[]|null=null,value:unknown,labels:readonly string[]=[],reason='';
  if(kind==='football'){
   if(!isFootballLeague(match.league))return null;
   const f=analysis[side+'Form'];if(!f||![f.games,f.scored,f.conceded].every(valid)||f.games<5)return null;
   const catalog=footballModelCatalog(match.league),model=catalog.models.find(m=>m.id===catalog.active)!;
   const xgGames=analysis.external?.[side+'XgGames'];
   // Rate sample volume is an explicit engineering reliability proxy. It does
   // not optimize a team's win probability or claim a backtested optimum.
   values=adaptiveTeamWeights(model.defaults,[confidence(f.games*f.scored,10),confidence(f.games*f.conceded,10),confidence(xgGames,10),confidence(xgGames,10),confidence(f.games,20)]);
   if(!values)return null;
   value={model:'auto',weights:{[model.id]:values}};labels=FOOTBALL_FACTOR_LABELS;
   reason=`依${name}的 ${f.games} 場分析樣本調整：場均進球 ${num(f.scored)}、失球 ${num(f.conceded)}。依各項樣本量小幅調整原模型比例，沒有為了提高該隊勝率而加權。`;
  }else if(kind==='basketball'){
   const m=analysis.inputs?.[side],s=m?.samples;
   if(!m||!s||!valid(m.games)||m.games<8||![s.possessions,s.threeAttempts,s.fieldGoalAttempts,s.minutes].every(valid))return null;
   values=adaptiveTeamWeights(defaultNbaWeights(),[confidence(s.possessions,800),confidence(s.possessions,800),confidence(s.threeAttempts,150),confidence(s.fieldGoalAttempts,500),confidence(s.minutes,400)]);
   if(!values)return null;
   value={version:1,weights:values};labels=NBA_WEIGHT_LABELS;
   reason=`依${name}的 ${m.games} 場數據調整，包含 ${num(s.possessions)} 回合、${s.threeAttempts} 次三分出手與 ${s.fieldGoalAttempts} 次投籃。樣本量不同，各項比例也分別調整。`;
  }else{
   const evidence=analysis.weightEvidence?.[side],input=analysis.inputs?.[side];
   const games=evidence?.games??input?.games,recent=evidence?.recentStarts??input?.recentStarts,outs=evidence?.starterOuts;
   if(!valid(games)||games<20||!valid(recent)||recent<3||!valid(outs)||outs<=0)return null;
   const settings=defaultBaseballSettings(),keys=Object.keys(settings.weights.multifactor);
   const quality:Record<string,number|null>={season:confidence(games,30),starterEra:confidence(outs,180),starterWhip:confidence(outs,180),starterRecentEra:confidence(recent,5),lineup:confidence(evidence?.lineupPA,270),bullpenPitches:confidence(evidence?.bullpenCount,8),bullpenBackToBack:confidence(evidence?.bullpenCount,8)};
   const factors=analysis.factors||[];
   const measured=keys.map((_,i)=>valid(factors[i]?.[side]));
   values=adaptiveTeamWeights(Object.values(settings.weights.multifactor),keys.map((k,i)=>measured[i]?quality[k]??null:null));
   if(!values)return null;
   keys.forEach((k,i)=>(settings.weights.multifactor as Record<string,number>)[k]=values![i]);
   value=settings;labels=keys.map(k=>BASEBALL_FACTOR_LABELS[k as keyof typeof BASEBALL_FACTOR_LABELS]);
   reason=`依${name}的 ${games} 場球隊樣本及先發投手 ${recent} 場近期紀錄調整。球隊戰績、先發與有實測數據的項目按樣本量分配，未實測項目維持中性。`;
  }
  teams.push({teamId:id,teamName:name,value,weights:labels.map((name,i)=>({name,value:values![i]})).filter(w=>w.value>0),reason});
 }
 const href=`/?league=${kind==='football'?'FOOTBALL':match.league}&view=analysis&date=${match.day}${kind==='football'?'&competition='+match.league:''}`;
 return {label:'雙方球隊專屬權重',storageKey:teamWeightStorageKey(match.league),value:{},href,weights:[],teams};
}
