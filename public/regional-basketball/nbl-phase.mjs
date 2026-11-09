// Blitz uses the league calendar's generic in_season code despite being a preseason tournament.
export function nblPhase(seasonType, round) {
  if (/\bblitz\b/i.test(round || '')) return 1;
  if (seasonType === 'regular' && round && !/^\d+$/.test(String(round))) {
    return /ignite|cup/i.test(round) ? 4 : 3;
  }
  return ({preseason:1, regular:2, finals:3, in_season:4})[seasonType] ?? null;
}
