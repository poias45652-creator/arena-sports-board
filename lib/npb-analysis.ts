export {analysisStartTime as npbStartTime,analysisFixtureKey as npbFixtureKey,scoreDistribution as npbScoreDistribution,buildRunAnalysis as buildNpbAnalysis,matchingRunAnalysis as matchingNpbAnalysis,marketOutcomes as npbMarketOutcomes,suggestedPicks as npbSuggestedPicks} from './baseball-run-analysis';
export type {RunAnalysis as NpbAnalysis,RunModelInput as NpbModelInput} from './baseball-run-analysis';
import {MODEL_VERSION} from './baseball-run-analysis';
export const NPB_MODEL_VERSION=MODEL_VERSION.NPB;
export const NPB_MODEL_NOTE='模型估算，尚未經歷史回測校準。';
