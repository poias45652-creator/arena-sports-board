import {footballForm,footballDistribution,type FootballGame} from './football';
import {calibratedFootballGoals,footballCalibrationAudit} from './football-calibration';
import {domesticLeague} from './football-five-league';

// Score-only fallback with the league's existing approved goal formula.
export function domesticScoreEstimate(game:FootballGame,history:FootballGame<string>[],before:number){
 if(!domesticLeague(game.league))return null;
 const audit=footballCalibrationAudit(game.league),p=audit?.enabled?audit.parameters:null;
 const rows=history.filter(g=>g.league===game.league&&g.id!==game.id&&g.state==='final'&&g.statusName==='STATUS_FULL_TIME'&&Date.parse(g.start)<before&&Date.parse(g.start)>=before-365*86400000);
 if(rows.length<180)return null;
 const h=footballForm(game.home.id,'home',rows,before,game.neutral,p??undefined),a=footballForm(game.away.id,'away',rows,before,game.neutral,p??undefined);
 if([h,a].some(f=>f.games<5||!f.latest||before-Date.parse(f.latest)>120*86400000))return null;
 const clamp=(n:number)=>Math.max(.25,Math.min(4,n));
 const expected=p?calibratedFootballGoals(h,a,p,game.neutral):{home:clamp((h.scored+a.conceded)/2),away:clamp((a.scored+h.conceded)/2)};
 return {expected,...footballDistribution(expected.home,expected.away,p?.rho??0),homeForm:h,awayForm:a};
}
