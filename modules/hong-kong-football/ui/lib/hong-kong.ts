import {crests} from '../../../../public/hk-football/team-crests.js';
export {summarizeFootballProfile} from './summary';
export const FOOTBALL_LEAGUES=[{code:'hkg.1',name:'香港超級聯賽'}];
export const footballDay=(value:string|Date= new Date())=> new Date(new Date(value).valueOf()+8*3600000).toISOString().slice(0,10);
export const footballLogo=(id:string)=>crests[id] || '';
export const isFootballNationalCompetition=()=>false;
export const footballCompetitionName=()=>FOOTBALL_LEAGUES[0].name;
export const footballVenue=(g,id)=>g.neutral?'neutral':g.home.id===id?'home':'away';
export const footballTeamHref=(league,id,day?,season?)=>{
 const q=new URLSearchParams();
 if(day)q.set('date',day);
 const year=season||(day?Number(day.slice(0,4))-(Number(day.slice(5,7))<7?1:0):undefined);
 if(year)q.set('season',String(year));
 return '/teams/football/'+encodeURIComponent(league)+'/'+encodeURIComponent(id)+(q.size?'?'+q:'');
};
export const footballBoardHref=(league,day?)=> '/?'+new URLSearchParams({league:'FOOTBALL',competition:league,view:'analysis',...(day?{date:day}:{})});
export const footballPhotoPending=()=>false;
export const footballPortraitStyle=()=>undefined;
export const playerCountry=(v)=>v||'';
