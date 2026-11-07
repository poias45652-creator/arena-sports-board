// Per fixture only the last saved public forecast counts, even if its model version changed.
export function footballSelectionAudit(rows:any[]) {
  const latest = new Map<string,{at:number; outcome:number; selection:any; probabilities:any}>();
  for (const row of rows) {
    const at=Date.parse(row.captured_at), kickoff=Date.parse(row.start_time);
    if (!row.game_id || !Number.isFinite(at) || !Number.isFinite(kickoff) || at>=kickoff-60000 ||
        row.home_goals==null || row.away_goals==null) continue;
    const home=Number(row.home_goals), away=Number(row.away_goals);
    if (![home,away].every(n=>Number.isInteger(n)&&n>=0)) continue;
    const key=[row.league,row.game_id,row.start_time].join('|');
    const old=latest.get(key);
    if (old && old.at>at) continue;
    try {
      const payload=JSON.parse(row.payload);
      if (old?.at===at) { latest.set(key,{...old,selection:undefined}); continue; }
      latest.set(key,{at,outcome:home>away?0:home===away?1:2,selection:payload.selection,probabilities:payload.probabilities});
    } catch { /* Corrupt snapshots cannot supply a forecast. */ }
  }
  let evaluated=0, picks=0, hits=0, drawPicks=0, drawHits=0;
  for (const {selection:s,outcome,probabilities:p} of latest.values()) {
    if (s?.version!=='football-selection-20261107-v1' || !['xg','shots'].includes(s.source)) continue;
    evaluated++;
    const ix=['home','draw','away'].indexOf(s.pick);
    if (ix<0 || !p || !(s.probability>=.7 && s.probability<=1) || Math.abs((p[s.pick]??-1)-s.probability)>1e-8 ||
      Math.max(p.home,p.draw,p.away)!==p[s.pick]) continue;
    picks++; hits+=Number(ix===outcome);
    if (ix===1) { drawPicks++; drawHits+=Number(outcome===1); }
  }
  return {evaluated,picks,hits,drawPicks,drawHits};
}
