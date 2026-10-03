// A projected final basketball score must select a winner. Keep the model's
// continuous means and win probabilities intact; round the display jointly.
export function basketballScoreDisplay(e:{home:number;away:number},p:{home:number;away:number}){
 if(![e.home,e.away,p.home,p.away].every(Number.isFinite)||p.home===p.away)return null;
 let home=Math.round(e.home),away=Math.round(e.away);
 const homeWins=p.home>p.away;
 if(homeWins?home<=away:away<=home){
  const candidates=homeWins?[[away+1,away],[home,Math.max(0,home-1)]]:[[home,home+1],[Math.max(0,away-1),away]];
  candidates.sort((a,b)=>(a[0]-e.home)**2+(a[1]-e.away)**2-((b[0]-e.home)**2+(b[1]-e.away)**2));
  [home,away]=candidates[0];
 }
 return {home,away,total:home+away,margin:home-away};
}
