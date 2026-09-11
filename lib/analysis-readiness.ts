// Audit archived pregame inputs, never infer model accuracy from data coverage.
export function auditReadiness(reports:any[],now=Date.now()){
 const latest=new Map<number,any>();let invalidRecords=0;
 for(const p of reports){const t=Date.parse(p?.capturedAt),start=Date.parse(p?.game?.date);if(!Number.isInteger(p?.game?.id)||!Number.isFinite(t)||!Number.isFinite(start)||t>=start||t>now){invalidRecords++;continue;}const old=latest.get(p.game.id);if(!old||Date.parse(old.capturedAt)<t)latest.set(p.game.id,p);}
 const rows=[...latest.values()],missing=new Map<string,number>(),sources=new Map<string,{available:number;missing:number}>();
 let confirmedLineups=0,completeInputs=0,withPinnacle=0,withCovers=0;const lead={under10Minutes:0,from10To60Minutes:0,atLeast60Minutes:0};
 for(const p of rows){
  for(const issue of new Set<string>((p.issues??[]).filter((x:any)=>typeof x==='string')))missing.set(issue,(missing.get(issue)||0)+1);
  if(p.context?.sides?.away?.lineupStatus==='confirmed'&&p.context?.sides?.home?.lineupStatus==='confirmed')confirmedLineups++;
  if(Array.isArray(p.issues)&&p.issues.length===0)completeInputs++;
  if(p.baseline?.markets?.length&&p.sources?.pinnacle?.usable)withPinnacle++;
  if(p.context?.coversOdds?.game&&p.sources?.['covers-odds']?.usable)withCovers++;
  const minutes=(Date.parse(p.game.date)-Date.parse(p.capturedAt))/60000;lead[minutes<10?'under10Minutes':minutes<60?'from10To60Minutes':'atLeast60Minutes']++;
  for(const [name,v] of Object.entries(p.sources??{})){const r=sources.get(name)||{available:0,missing:0};r[(v as any)?.usable===true?'available':'missing']++;sources.set(name,r);}
 }
 return {games:rows.length,invalidRecords,confirmedLineups,completeInputs,withPinnacle,withCovers,leadTime:lead,missing:[...missing].map(([reason,games])=>({reason,games})).sort((a,b)=>b.games-a.games),sources:Object.fromEntries(sources),scope:'latest recorded pregame snapshot per game; historical availability, not current freshness',modelReady:false,blockers:['尚未完成按時間切分的歷史訓練與驗證','球場因子與實際屋頂狀態未完整接入','各報價來源的結算規則與費用仍需核對']};
}
