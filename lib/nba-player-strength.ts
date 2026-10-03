import model from '../data/nba-player-model.json';
import snapshot from '../data/nba-player-strength.json';
import {createPlayerStrengthEngine} from './basketball-player-strength';
export {availabilityFromNews} from './basketball-player-strength';
export type {PlayerAvailability,PlayerEvidence,PlayerRating,RotationPlayer,NbaPlayerContext} from './basketball-player-strength';
export const {allocateMinutes,rotation,applyPlayerStrength,playerRatings}=createPlayerStrengthEngine({league:'NBA',regulationMinutes:48,model,snapshot});
