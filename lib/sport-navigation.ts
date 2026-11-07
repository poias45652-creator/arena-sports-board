export const BASEBALL_LEAGUES=[{code:'MLB',name:'美國職棒'},{code:'NPB',name:'日本職棒'}] as const;
export const BASKETBALL_LEAGUES=[{code:'NBA',name:'美國職籃'},{code:'WNBA',name:'美國女子職籃'},{code:'NBL',name:'澳洲職籃'},{code:'KBL',name:'韓國職籃'}] as const;
export type BasketballLeague=typeof BASKETBALL_LEAGUES[number]['code'];
export type FrontLeague='MLB'|'NPB'|'FOOTBALL'|BasketballLeague;
const frontLeagues:readonly string[]=['MLB','NPB','FOOTBALL',...BASKETBALL_LEAGUES.map(item=>item.code)];
export const FRONT_VIEWS=['analysis','overview','teams','standings','live'] as const;
export function frontSelection(search:string){
 const p=new URLSearchParams(search),league=p.get('league'),view=p.get('view');
 return {league:(frontLeagues.includes(league||'')?league:'MLB') as FrontLeague,view:FRONT_VIEWS.includes(view as typeof FRONT_VIEWS[number])?view!:'analysis'};
}
export function leaguePageHref(league:string,view='analysis'){
 return `${frontLeagues.includes(league)?'/':'/admin/leagues'}?${new URLSearchParams({league,view})}`;
}
