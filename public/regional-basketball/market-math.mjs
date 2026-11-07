// Integer full-game results, shared by the regional board and the NBA/WNBA markets.
function normalCdf(z) {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const polynomial = ((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592;
  const erf = 1 - polynomial * t * Math.exp(-x * x);
  return 0.5 * (1 + Math.sign(z) * erf);
}

/** @param {number} mean @param {number} sigma @param {"margin"|"total"} kind @param {number} [homeProbability] */
export function basketballMarketGrid(mean, sigma, kind, homeProbability = undefined) {
  if (!Number.isFinite(mean) || !Number.isFinite(sigma) || sigma <= 0) return [];
  const low = Math.floor(mean - 9 * sigma);
  const high = Math.ceil(mean + 9 * sigma);
  if (!Number.isSafeInteger(low) || !Number.isSafeInteger(high) || high - low > 2000) return [];
  const grid = [];
  let homeMass = 0, awayMass = 0;
  for (let value = low; value <= high; value++) {
    if (kind === 'margin' ? value === 0 : value <= 0) continue;
    const p = normalCdf((value + 0.5 - mean) / sigma) - normalCdf((value - 0.5 - mean) / sigma);
    grid.push({value, p});
    if (value > 0) homeMass += p;
    else awayMass += p;
  }
  const mass = homeMass + awayMass;
  if (mass <= 0) return [];
  if (kind === 'margin' && Number.isFinite(homeProbability) && homeProbability >= 0 && homeProbability <= 1) {
    if (homeMass <= 0 || awayMass <= 0) return [];
    return grid.map(({value, p}) => ({value, p: p * (value > 0 ? homeProbability / homeMass : (1 - homeProbability) / awayMass)}));
  }
  return grid.map(({value, p}) => ({value, p: p / mass}));
}

export function settleSportGrid(grid, quote, side) {
  if (quote.kind === 'moneyline' || !grid.length || grid.some(r => !Number.isFinite(r.value) || !Number.isFinite(r.p) || r.p < 0)
      || Math.abs(grid.reduce((n, r) => n + r.p, 0) - 1) > 1e-6) return null;
  const result = {win: 0, partialWin: 0, push: 0, partialLoss: 0, loss: 0, ev: 0};
  const direction = side === 'away' || side === 'under' ? -1 : 1;
  const price = direction === 1 ? quote.home : quote.away;
  const parts = quote.parts || [quote.line];
  for (const {value, p} of grid) {
    const fraction = direction * parts.reduce((sum, line) => {
      const delta = quote.kind === 'spread' ? value + line : value - line;
      return sum + (Math.abs(delta) < 1e-9 ? quote.boundary : Math.sign(delta));
    }, 0) / parts.length;
    const bucket = fraction === 1 ? 'win' : fraction === -1 ? 'loss' : fraction > 0 ? 'partialWin' : fraction < 0 ? 'partialLoss' : 'push';
    result[bucket] += p;
    result.ev += (fraction > 0 ? fraction * price : fraction) * p;
  }
  return result;
}
