import model from '../data/wnba-player-model.json';
import snapshot from '../data/wnba-player-strength.json';
import {createPlayerStrengthEngine} from './basketball-player-strength';
export {availabilityFromNews} from './basketball-player-strength';
export type {PlayerAvailability,PlayerEvidence,PlayerRating,RotationPlayer,NbaPlayerContext} from './basketball-player-strength';
export const {allocateMinutes,rotation,applyPlayerStrength,playerRatings}=createPlayerStrengthEngine({league:'WNBA',regulationMinutes:40,model,snapshot});
