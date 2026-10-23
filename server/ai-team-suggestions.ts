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
   const signals=Array.isArray(f.weightSignals)?f.weightSignals:[confidence(f.scored,1),confidence(f.conceded,1),confidence(f.xgFor,1),confidence(f.xgAgainst,1),null];
   values=adaptiveTeamWeights(model.defaults,[confidence(f.games*f.scored,10),confidence(f.games*f.conceded,10),confidence(xgGames,10),confidence(xgGames,10),confidence(f.games,20)],signals);
   if(!values)return null;
   value={model:'auto',weights:{[model.id]:values}};labels=FOOTBALL_FACTOR_LABELS;
   reason=`依${name}的 ${f.games} 場數據調整：場均進球 ${num(f.scored)}、失球 ${num(f.conceded)}。${Array.isArray(f.weightSignals)?'比較該隊逐場攻防與淨勝球的關聯及波動，分配攻防比例。':'依本場保存的攻防數值與樣本量分配比例。'}未實測項目保留原比例。`;
  }else if(kind==='basketball'){
   const m=analysis.inputs?.[side],s=m?.samples;
   if(!m||!s||!valid(m.games)||m.games<8||!Array.isArray(m.weightSignals)||m.weightSignals.length!==5||![s.possessions,s.threeAttempts,s.fieldGoalAttempts,s.minutes].every(valid))return null;
   values=adaptiveTeamWeights(defaultNbaWeights(),[confidence(s.possessions,800),confidence(s.possessions,800),confidence(s.threeAttempts,150),confidence(s.fieldGoalAttempts,500),confidence(s.minutes,400)],m.weightSignals);
   if(!values)return null;
   value={version:1,weights:values};labels=NBA_WEIGHT_LABELS;
   const emphasis=labels.map((label,i)=>({label,value:values![i]})).sort((a,b)=>b.value-a.value).slice(0,2).map(x=>x.label).join('、');
   reason=`依${name}最近 ${m.games} 場的攻防、三分、罰球與分差的關聯，以及逐場波動調整；節奏另比較回合數與總得分。這組配置較重視${emphasis}，以該隊的比賽表現作為依據。`;
  }else{
   const evidence=analysis.weightEvidence?.[side],input=analysis.inputs?.[side];
   const games=evidence?.games??input?.games,recent=evidence?.recentStarts??input?.recentStarts,outs=evidence?.starterOuts;
   const settings=defaultBaseballSettings(),family=analysis.modelFamily||analysis.personalModel?.settings?.moneyline||'multifactor';
   if(!valid(games)||games<20)return null;
   if(family==='innings'){
    const keys=Object.keys(settings.weights.innings);
    const quality=[valid(outs)&&outs>0?confidence(outs,180):null,confidence(games,30),confidence(games,30),input?.bullpenMode!=='team_defense'&&valid(evidence?.bullpenOuts)&&evidence.bullpenOuts>0?confidence(evidence.bullpenOuts,180):null];
    const lower=(n:unknown)=>valid(n)?4/(4+n):null;
    const signals=[lower(input?.starterEra),confidence(input?.offense,4),lower(input?.defense),lower(input?.bullpenEra)];
    values=adaptiveTeamWeights(Object.values(settings.weights.innings),quality,signals);if(!values)return null;
    keys.forEach((k,i)=>(settings.weights.innings as Record<string,number>)[k]=values![i]);
    settings.moneyline='innings';settings.fullGamePk='innings';
    value=settings;labels=keys.map(k=>BASEBALL_FACTOR_LABELS[k as keyof typeof BASEBALL_FACTOR_LABELS]);
    reason=`依${name}本場逐局模型採用的本季攻防與投手數據調整，球隊樣本 ${games} 場。沒有獨立實測數據的項目維持中性比例。`;
   }else{
    const keys=Object.keys(settings.weights.multifactor);
    const quality:Record<string,number|null>={season:confidence(games,30),starterEra:valid(outs)&&outs>0?confidence(outs,180):null,starterWhip:valid(outs)&&outs>0?confidence(outs,180):null,starterRecentEra:valid(recent)&&recent>=3?confidence(recent,5):null,lineup:confidence(evidence?.lineupPA,270),bullpenPitches:confidence(evidence?.bullpenCount,8),bullpenBackToBack:confidence(evidence?.bullpenCount,8)};
    const aliases:Record<string,string[]>={starterEra:['先發本季 ERA','先發 ERA'],starterWhip:['先發本季 WHIP'],starterRecentEra:['先發近期 ERA'],lineup:['九棒對左右投 wRC+']};
    // Match factor identities, never array positions (reports may sort by contribution).
    const factors=keys.map(key=>(analysis.factors||[]).filter((f:any)=>[BASEBALL_FACTOR_LABELS[key as keyof typeof BASEBALL_FACTOR_LABELS],...(aliases[key]||[])].includes(f.name)));
    const measured=keys.map((_,i)=>factors[i].length===1&&valid(factors[i][0][side]));
    const observed=(key:string)=>factors[keys.indexOf(key)][0]?.[side];
    const lower=(key:string,scale:number)=>valid(observed(key))?scale/(scale+observed(key)):null;
    const signals:Record<string,number|null>={season:valid(observed('season'))?observed('season'):null,starterEra:lower('starterEra',4),starterWhip:lower('starterWhip',.8),starterRecentEra:lower('starterRecentEra',4),lineup:confidence(observed('lineup'),100),bullpenPitches:confidence(observed('bullpenPitches'),180),bullpenBackToBack:confidence(observed('bullpenBackToBack'),5)};
    values=adaptiveTeamWeights(Object.values(settings.weights.multifactor),keys.map((k,i)=>measured[i]?quality[k]??null:null),keys.map((k,i)=>measured[i]?signals[k]??null:null));
    if(!values)return null;
    keys.forEach((k,i)=>(settings.weights.multifactor as Record<string,number>)[k]=values![i]);
    value=settings;labels=keys.map(k=>BASEBALL_FACTOR_LABELS[k as keyof typeof BASEBALL_FACTOR_LABELS]);
    const used=keys.filter((k,i)=>measured[i]&&quality[k]!==null&&quality[k]!==undefined&&signals[k]!==null&&signals[k]!==undefined).map(k=>BASEBALL_FACTOR_LABELS[k as keyof typeof BASEBALL_FACTOR_LABELS]);
    reason=`依${name}已核對的${used.join('、')}及各項樣本量分配比例，球隊樣本 ${games} 場。未實測項目維持中性，不把本季數據當成近期表現。`;
   }
  }
  teams.push({teamId:id,teamName:name,value,weights:labels.map((name,i)=>({name,value:values![i]})).filter(w=>w.value>0),reason});
 }
 const href=`/?league=${kind==='football'?'FOOTBALL':match.league}&view=analysis&date=${match.day}${kind==='football'?'&competition='+match.league:''}`;
 return {label:'雙方球隊專屬權重',storageKey:teamWeightStorageKey(match.league),value:{},href,weights:[],teams};
}
