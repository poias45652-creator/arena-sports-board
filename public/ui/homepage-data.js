// The focus card uses today's pick; the results board also retains saved public picks.
// The server supplies the current front-end league list; there is no demo fallback.
export const taipeiDay=(now=Date.now())=>new Date(now+8*3600000).toISOString().slice(0,10);
export const probabilityLabel=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1?Math.round(value*100)+'%':'—';
export function visibleTrial(data,leagues,now=Date.now()){
 const game=data?.game;
 if(data?.status!=='ready'||data.day!==taipeiDay(now)||!game||data.progress?.stale)return null;
 const league=leagues.find(l=>l.code===game.league&&l.sport===game.sport);
 if(!league||!['key','id','home','away'].every(k=>typeof game[k]==='string'&&game[k].trim()))return null;
 const start=Date.parse(game.start),updated=Date.parse(data.updatedAt);
 if(!Number.isFinite(start)||taipeiDay(start)!==data.day||!Number.isFinite(updated)||updated>now+60000||now-updated>120000)return null;
 const p=data.probabilities;
 const values=p?[p.home,p.away,...(p.draw===undefined?[]:[p.draw])]:[];
 const validProbability=values.length>=2&&values.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1)&&Math.abs(values.reduce((a,b)=>a+b,0)-1)<=.015;
 return {...data,game:{...game,leagueName:league.name},probabilities:validProbability?p:undefined};
}

export function trialRecommendation(data){
 const p=data?.probabilities,g=data?.game;if(!p||!g)return '無賽前推薦';
 const sides=p.draw===undefined?['home','away']:['home','away','draw'];
 sides.sort((a,b)=>(p[b]??0)-(p[a]??0));
 if((p[sides[0]]??0)===(p[sides[1]]??0))return '雙方接近';
 return sides[0]==='draw'?'和局':g[sides[0]]+' 勝';
}
export function trialOutcomeLabel(data){
 const labels={hit:'命中',miss:'未命中',draw:'和局',no_pick:'無賽前推薦',ungraded:'不列入結算'};
 if(data?.progress?.state==='final')return labels[data.result]||'待結算';
 return ({scheduled:'未開賽',live:'進行中',postponed:'延賽',cancelled:'取消',suspended:'暫停'})[data?.progress?.state]||'賽況待更新';
}
export function visibleTrialHistory(data,leagues,now=Date.now()){
 const rows=Array.isArray(data?.history)?data.history:[],seen=new Set(),counts={baseball:0,basketball:0,football:0},out=[];
 const sorted=[...rows].sort((a,b)=>String(b?.day||'').localeCompare(String(a?.day||'')));
 for(const row of sorted){
  const g=row?.game,league=leagues.find(l=>l.code===g?.league&&l.sport===g?.sport);
  if(!league||!['key','id','home','away'].every(k=>typeof g[k]==='string'&&g[k].trim())||seen.has(g.key)||counts[g.sport]>=5)continue;
  const start=Date.parse(g.start),at=Date.parse(row.predictionAt);
  if(!Number.isFinite(start)||taipeiDay(start)!==row.day||row.day>taipeiDay(now)||!Number.isFinite(at)||at>=start||at>now)continue;
  const p=row.probabilities,values=p?[p.home,p.away,...(p.draw===undefined?[]:[p.draw])]:[];
  if(values.length<2||!values.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1)||Math.abs(values.reduce((a,b)=>a+b,0)-1)>.015)continue;
  out.push({...row,game:{...g,leagueName:league.name}});seen.add(g.key);counts[g.sport]++;
 }
 return out;
}

