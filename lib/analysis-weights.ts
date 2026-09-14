import type {RunSnapshot} from './markets';

export const WEIGHT_FACTORS = ['scoring', 'defense', 'record'] as const;
export type WeightFactor = typeof WEIGHT_FACTORS[number];
export type AnalysisWeights = Record<WeightFactor, number>;
export const DEFAULT_ANALYSIS_WEIGHTS: AnalysisWeights = {scoring: 40, defense: 40, record: 20};
export const ANALYSIS_STORAGE_KEY = 'yj-team-analysis-weights-v1';
export type AnalysisStandings = {
  season: number;
  fetchedAt: string;
  rows: {id: number; name: string; wins: number | null; losses: number | null}[];
};

export function validAnalysisWeights(value: unknown): value is AnalysisWeights {
  if (!value || typeof value !== 'object') return false;
  const weights = value as AnalysisWeights;
  return WEIGHT_FACTORS.every(key => typeof weights[key] === 'number' && Number.isFinite(weights[key]) && weights[key] >= 0 && weights[key] <= 100)
    && WEIGHT_FACTORS.reduce((total, key) => total + weights[key], 0) > 0;
}

export function normalizeAnalysisWeights(value: unknown): AnalysisWeights | null {
  if (!validAnalysisWeights(value)) return null;
  const total = WEIGHT_FACTORS.reduce((sum, key) => sum + value[key], 0);
  return {scoring: value.scoring / total * 100, defense: value.defense / total * 100, record: value.record / total * 100};
}

export function readStoredAnalysisWeights(raw: string | null): AnalysisWeights | null {
  try {
    const data = JSON.parse(raw || 'null');
    return data?.version === 1 && validAnalysisWeights(data.weights)
      ? {scoring: data.weights.scoring, defense: data.weights.defense, record: data.weights.record}
      : null;
  } catch { return null; }
}

const count = (value: unknown): value is number => typeof value === 'number' && Number.isInteger(value) && value >= 0;
const rate = (total: unknown, games: unknown) => count(total) && count(games) && games > 0 ? total / games : null;

/** Relative season performance only; these scores are not game win probabilities. */
export function analyzeTeams(runs: RunSnapshot | null, standings: AnalysisStandings | null, value: unknown) {
  const weights = normalizeAnalysisWeights(value);
  if (!weights) return [];
  const season = runs?.year ?? standings?.season;
  const records = standings && standings.season === season ? standings.rows : [];
  const stats = runs && runs.year === season ? runs.rows : [];
  const ids = [...new Set([...stats.map(row => row.id), ...records.map(row => row.id)])];
  const rows = ids.map(id => {
    const matchingStats = stats.filter(row => row.id === id);
    const matchingRecords = records.filter(row => row.id === id);
    const stat = matchingStats.length === 1 ? matchingStats[0] : null;
    const record = matchingRecords.length === 1 ? matchingRecords[0] : null;
    const wins = record && count(record.wins) ? record.wins : null;
    const losses = record && count(record.losses) ? record.losses : null;
    return {
      id, name: record?.name || '', wins, losses,
      scoring: rate(stat?.scored, stat?.batGames),
      defense: rate(stat?.allowed, stat?.pitchGames),
      record: wins !== null && losses !== null ? rate(wins, wins + losses) : null,
    };
  });
  const pools = Object.fromEntries(WEIGHT_FACTORS.map(key => [key, rows.flatMap(row => row[key] === null ? [] : [row[key]])])) as Record<WeightFactor, number[]>;
  return rows.map(row => {
    let score: number | null = 0;
    for (const key of WEIGHT_FACTORS) {
      if (weights[key] === 0) continue;
      const metric = row[key], pool = pools[key];
      if (metric === null || pool.length < 2) { score = null; break; }
      const betterThan = pool.filter(other => key === 'defense' ? other > metric : other < metric).length;
      const ties = pool.filter(other => other === metric).length - 1;
      score += (betterThan + ties / 2) / (pool.length - 1) * weights[key];
    }
    return {...row, score};
  }).sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.id - b.id);
}
