// Input odds use Hong Kong format (profit on a winning unit stake).
function fairShares(prices) {
  if (!prices.every(p => Number.isFinite(p) && p > 0)) return null;
  const inverse = prices.map(p => 1 / (1 + p));
  const sum = inverse.reduce((a,b) => a+b, 0);
  return inverse.map(p => p/sum);
}

function mainTotal(markets) {
  let best = null;
  for (const row of markets.find(m => m.name === 'Totals')?.lines || []) {
    if (!Number.isInteger(row.line*4) || row.line < 0) continue;
    const shares = fairShares([row.first,row.second]);
    if (!shares) continue;
    const deviation = Math.abs(shares[0] - 0.5);
    if (!best || deviation < best.deviation) best = {line:row.line, over:shares[0], under:shares[1], deviation};
  }
  return best && {line:best.line, over:best.over, under:best.under};
}

function poisson(mean) {
  const values = [Math.exp(-mean)];
  for (let n = 1; n <= 40; n++) values.push(values[n-1]*mean/n);
  return values;
}

// At a quarter line the stake is split equally across the two adjoining half lines.
function overSettlement(goals,line) {
  return (Math.sign(goals - Math.floor(2*line)/2) + Math.sign(goals - Math.ceil(2*line)/2))/2;
}

function solve(low,high,target,measure) {
  if (target < measure(low) || target > measure(high)) return null;
  for (let i=0; i<30; i++) {
    const mid = (low+high)/2;
    if (measure(mid) < target) low=mid; else high=mid;
  }
  return (low+high)/2;
}

function scoreEstimate(result,total) {
  if (total.line > 12) return null;
  const settlement = Array.from({length:81},(_,n) => overSettlement(n,total.line));
  const simpleOver = mean => {
    let wins=0,losses=0;
    for (const [n,p] of poisson(mean).entries()) {
      wins += p*Math.max(0,settlement[n]);
      losses += p*Math.max(0,-settlement[n]);
    }
    return wins/(wins+losses);
  };
  const rawMean = solve(.01,28,total.over,simpleOver);
  if (!rawMean) return null;
  const homeFraction = share => {
    const h=poisson(rawMean*share),a=poisson(rawMean*(1-share));
    let home=0,away=0,awayBelow=0,homeBelow=0;
    for (let i=0; i<h.length; i++) {
      home+=h[i]*awayBelow; away+=a[i]*homeBelow;
      awayBelow+=a[i]; homeBelow+=h[i];
    }
    return home/(home+away);
  };
  const share = solve(.0001,.9999,result[0]/(result[0]+result[2]),homeFraction);
  if (!share) return null;
  function grid(mean,collect=false) {
    const h=poisson(mean*share),a=poisson(mean*(1-share));
    const masses=[0,0,0],wins=[0,0,0],losses=[0,0,0],cells=[];
    for (let i=0; i<h.length; i++) for (let j=0; j<a.length; j++) {
      const k=i>j?0:i===j?1:2, p=h[i]*a[j], settled=settlement[i+j];
      masses[k]+=p; wins[k]+=p*Math.max(0,settled); losses[k]+=p*Math.max(0,-settled);
      if (collect) cells.push({home:i,away:j,k,p});
    }
    const factor=masses.map((v,i)=>result[i]/v);
    if (!collect) {
      const win=wins.reduce((s,v,i)=>s+v*factor[i],0), loss=losses.reduce((s,v,i)=>s+v*factor[i],0);
      return win/(win+loss);
    }
    const probabilities=cells.map(c=>({home:c.home,away:c.away,probability:c.p*factor[c.k]}));
    const btts=probabilities.reduce((sum,c)=>sum+(c.home>0 && c.away>0?c.probability:0),0);
    const scores=probabilities.sort((a,b)=>b.probability-a.probability).slice(0,3);
    return {btts,scores};
  }
  const mean=solve(.01,28,total.over,grid);
  return mean?grid(mean,true):null;
}

export function marketPrediction(quote) {
  if (quote?.status !== 'priced' || !Array.isArray(quote.markets)) return null;
  const markets=quote.markets;
  const prices=markets.find(m=>m.name==='1X2')?.prices;
  const result=Array.isArray(prices) && prices.length===3 ? fairShares(prices) : null;
  const total=mainTotal(markets);
  if (!result && !total) return null;
  return {result,total,estimate:result && total ? scoreEstimate(result,total) : null};
}
