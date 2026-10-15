import {DEFAULT_WEIGHTS,normalizedWeights,weightKey,type Weights,type EfficiencyAnalysis} from './basketball-efficiency';

export const NBA_WEIGHT_STORAGE_KEY='yj:nba:model-weights:v1';
export const basketballWeightStorageKey=(league:'NBA'|'WNBA')=>league==='NBA'?NBA_WEIGHT_STORAGE_KEY:'yj:wnba:model-weights:v1';
export const NBA_WEIGHT_LABELS=['進攻效率','防守效率','三分命中率','罰球出手率','節奏'] as const;
export const defaultNbaWeights=()=>[...DEFAULT_WEIGHTS] as Weights;
export const isDefaultNbaWeights=(weights:readonly number[])=>weightKey(weights)===weightKey(DEFAULT_WEIGHTS);
export function readNbaWeights(serialized:string|null):Weights{
 try{
  const value=JSON.parse(serialized||'null');
  if(value?.version!==1||!Array.isArray(value.weights))return defaultNbaWeights();
  normalizedWeights(value.weights);
  return [...value.weights] as Weights;
 }catch{return defaultNbaWeights();}
}
export function writeNbaWeights(weights:Weights){
 normalizedWeights(weights);
 return JSON.stringify({version:1,weights:[...weights]});
}

// Preserve the fitted player model at the default ratio. For a custom ratio,
// retain only the efficiency projection's change from its default baseline.
// This prevents the player adjustment from discarding the first four sliders.
export function nbaEfficiencyWeightShift(base:EfficiencyAnalysis){
 if(base.weightsKey===weightKey(DEFAULT_WEIGHTS)||!base.inputs)return 0;
 const c=base.inputs.calculation;
 const defaultMargin=(c.baselineHome-c.baselineAway)*c.projectedPace/c.finalPace+2*c.alpha*.2*c.deltas.reduce((sum,v)=>sum+v,0);
 const shift=c.home-c.away-defaultMargin;
 if(!Number.isFinite(shift))throw Error('自訂效率權重計算錯誤');
 return Math.abs(shift)<1e-10?0:shift;
}
