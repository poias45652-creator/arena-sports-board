import {mergePregameFixtures,type PregameData,type PregameFixture} from './international-pregame';
export type {PregameData as KboPregameData,PregameGame as KboPregameGame,PregameSide as KboPregameSide,PregamePitchingStats as KboPitchingStats} from './international-pregame';
export {displayPitcherStat as displayKboPitcherStat} from './international-pregame';
export function mergeKboPregameFixtures(fixtures:PregameFixture[],snapshot?:PregameData,knownSchedule:PregameFixture[]=[]){
 return mergePregameFixtures(fixtures,snapshot,'KBO',knownSchedule);
}
