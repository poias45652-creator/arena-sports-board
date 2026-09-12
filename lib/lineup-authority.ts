import type {Match} from './baseball';
import type {LineupGame} from './rotowire';

const normalize=(name:string)=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+(?:jr\.?|sr\.?|ii|iii|iv)$/,'').replace(/[^a-z0-9]/g,'');
export function resolveOfficialLineup(game:Match,candidate:LineupGame|null){
  const conflicts:string[]=[];
  for(const side of ['away','home'] as const){
    const official=game[side],secondary=candidate?.[side];
    if(official.pitcherId&&secondary?.pitcher&&normalize(official.pitcherName)!==normalize(secondary.pitcher)){
      conflicts.push(`${side==='away'?'客隊':'主隊'}先發採 MLB 官方 ${official.pitcherName}；打線來源列 ${secondary.pitcher}`);
    }
  }
  // A batting order prepared against a different starter cannot support the
  // handedness splits. Discard the whole secondary lineup, not just its name.
  return {lineup:conflicts.length?null:candidate,conflicts};
}
