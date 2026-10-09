import type {FootballAnalysis} from './football';

type Score={home:number;away:number;probability:number};
export type FootballScoreScenarios={
 mode:'ranked'|'attacking';
 scores:(Score&{label:string})[];
 favourite?:'home'|'away';
 winBy2Plus?:number;
 winBy3Plus?:number;
};

// This is a presentation preference, not a change to the probability model.
// The exact-score probabilities, full grid and stored forecasts stay intact.
export function footballScoreScenarios(analysis:FootballAnalysis):FootballScoreScenarios{
 const fallback:FootballScoreScenarios={mode:'ranked',scores:(analysis.scores||[]).slice(0,3).map((s,i)=>({...s,label:['首選','次選','第三組'][i]}))};
 const p=analysis.probabilities,d=analysis.scoreDistribution,e=analysis.expected;
 if(analysis.status!=='ready'||!p||!d||!e||!Array.isArray(d.scores)||!d.scores.length)return fallback;
 if(![p.home,p.draw,p.away].every(n=>Number.isFinite(n)&&n>=0&&n<=1)||Math.abs(p.home+p.draw+p.away-1)>1e-6)return fallback;
 if(![d.home,d.away,e.home,e.away].every(n=>Number.isFinite(n)&&n>=0)||Math.abs(d.home-e.home)>1e-6||Math.abs(d.away-e.away)>1e-6)return fallback;
 const seen=new Set<string>();
 for(const s of d.scores){
  const key=`${s.home}:${s.away}`;
  if(!Number.isInteger(s.home)||!Number.isInteger(s.away)||s.home<0||s.away<0||!Number.isFinite(s.probability)||s.probability<0||s.probability>1||seen.has(key))return fallback;
  seen.add(key);
 }
 if(Math.abs(d.scores.reduce((n,s)=>n+s.probability,0)-1)>1e-6)return fallback;
 for(const side of ['home','draw','away'] as const){
  const mass=d.scores.filter(s=>side==='home'?s.home>s.away:side==='away'?s.away>s.home:s.home===s.away).reduce((n,s)=>n+s.probability,0);
  if(Math.abs(mass-p[side])>1e-5)return fallback;
 }
 const favourite=p.home>=p.away?'home':'away',other=favourite==='home'?'away':'home';
 const margin=(s:Score)=>s[favourite]-s[other];
 const winBy2Plus=d.scores.filter(s=>margin(s)>=2).reduce((n,s)=>n+s.probability,0);
 const winBy3Plus=d.scores.filter(s=>margin(s)>=3).reduce((n,s)=>n+s.probability,0);
 // High win probability alone is insufficient: require scoring and margin support.
 if(p[favourite]<.70||e[favourite]<2||winBy2Plus<.40)return fallback;
 const sorted=[...d.scores].sort((a,b)=>b.probability-a.probability||a.home-b.home||a.away-b.away);
 const main=sorted[0];
 if(margin(main)<=0)return fallback;
 const credible=(s:Score)=>s.probability>=Math.max(.01,main.probability*.20);
 const attack=sorted.find(s=>credible(s)&&s[favourite]>main[favourite]&&s[other]>main[other]&&margin(s)>=Math.max(2,margin(main)));
 const dominant=sorted.find(s=>credible(s)&&s!==main&&s!==attack&&margin(s)>=Math.max(3,margin(main)+1));
 if(!attack||!dominant)return fallback;
 return {mode:'attacking',favourite,winBy2Plus,winBy3Plus,scores:[{...main,label:'主推'},{...attack,label:'進攻'},{...dominant,label:'大勝'}]};
}
