import {isFootballClubCup,type FootballLeague} from './football';
import {selectFootballCalibration} from './football-calibration';
import {selectExternalFootballModel} from './football-external-model';
import {selectFootballMarketModel} from './football-market-model';
import {selectFootballXgStrengthModel} from './football-xg-strength-model';
import {footballPercentages,type FootballModelCatalog} from './football-model-weights';
export function footballModelCatalog(league:FootballLeague,now=Date.now()):FootballModelCatalog{
 const national=league==='uefa.nations',cal=selectFootballCalibration(league,now).parameters,elo=selectFootballXgStrengthModel(league,now)||selectExternalFootballModel(league,now),score=selectFootballMarketModel(league,now);
 return {active:national?'elo':score?'score':elo?'elo':cal?'calibrated':'recent',models:[
  {id:'recent',name:'近期進失球',available:!isFootballClubCup(league)&&!national,defaults:[50,50,0,0,0],enabled:[true,true,false,false,false]},
  {id:'calibrated',name:'賽果校準',available:!!cal,defaults:footballPercentages([cal?.attack||.5,cal?.defense||.5,0,0,0]),enabled:[true,true,false,false,false]},
  {id:'elo',name:national?'國家隊攻防':'進球與 Elo',available:!!elo||national,defaults:footballPercentages(national?[1,1,0,0,0]:[elo?.goalAttack||0,elo?.goalDefense||0,elo?.xgAttack||0,elo?.xgDefense||0,elo?.elo||1]),enabled:[true,true,!!elo?.usesXg,!!elo?.usesXg,!national]},
  {id:'score',name:'比分校準',available:!!score,defaults:footballPercentages([score?.goalAttack||0,score?.goalDefense||0,0,0,score?.elo||1]),enabled:[true,true,false,false,true]},
 ]};
}
