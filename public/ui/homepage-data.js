// Only the same-day public recommendation may appear on the marketing homepage.
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
