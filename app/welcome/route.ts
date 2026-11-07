import {homepageTemplate} from '@/lib/homepage-template';
import {BASEBALL_LEAGUES,BASKETBALL_LEAGUES} from '@/lib/sport-navigation';
import {FOOTBALL_LEAGUES} from '@/lib/football';
export const dynamic='force-static';
export function GET(){
 const leagues=[...BASEBALL_LEAGUES.map(l=>({code:l.code,name:l.code+' '+l.name,sport:'baseball'})),...BASKETBALL_LEAGUES.map(l=>({code:l.code,name:l.code+' '+l.name,sport:'basketball'})),...FOOTBALL_LEAGUES.map(l=>({code:l.code,name:l.name,sport:'football'}))];
 const html=homepageTemplate.replaceAll('__LEAGUE_COUNT__',String(leagues.length)).replace('__FRONT_LEAGUES__',JSON.stringify(leagues).replaceAll('<','\\u003c'));
 return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public, max-age=0, must-revalidate'}});
}
