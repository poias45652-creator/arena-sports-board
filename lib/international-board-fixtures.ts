import {internationalFixtureTime,canonicalFixtureStart} from './international-fixture-time';
import {internationalTeam} from './international-teams';
import {uniqueInternationalFixtures} from './international-fixtures';
import type {PregameFixture,PregameExclusion} from './international-pregame';

type BoardFixture=PregameFixture&{oddsSource?:boolean;venue?:string;status?:string;note?:string};
export const taipeiFixtureDay=(now:number)=>new Date(now+8*3600000).toISOString().slice(0,10);
const startTime=(g:{start:string})=>internationalFixtureTime(g.start);

// Card visibility is independent of eligibility for a new pregame recommendation.
// Keep today's games after first pitch; never let an empty list stop dated fetching.
export function selectInternationalBoardFixtures<T extends BoardFixture>(listed:T[],source:T[],league:string,now:number,day='auto',exclusions:PregameExclusion[]=[],hasOptions:(g:T)=>boolean=()=>false){
 const today=taipeiFixtureDay(now);
 const team=(name:string)=>internationalTeam(name.replace(/\s*[（(](?:主|客)[）)]\s*/g,'').trim(),league);
 const normalize=(g:T)=>({...g,start:canonicalFixtureStart(g.start),home:team(g.home),away:team(g.away)});
 const visible=(g:T)=>Number.isFinite(startTime(g))&&g.start.slice(0,10)>=today&&
  !/cancelled|postponed|suspended|取消|延賽|中止|취소/i.test((g.status||'')+' '+(g.note||''))&&
  !exclusions.some(x=>team(x.home)===g.home&&team(x.away)===g.away&&startTime(x)===startTime(g));
 const listedCandidates=listed.map(normalize).filter(visible),sourceCandidates=source.map(normalize).filter(visible);
 const availableDays=[...new Set([...listedCandidates,...sourceCandidates].map(g=>g.start.slice(0,10)))].sort();
 const automaticDay=availableDays.includes(today)?today:availableDays[0]||today;
 const days=[...new Set([today,...availableDays])].sort(),targetDay=day==='auto'?automaticDay:day;
 // Collapse aliases BEFORE pairing, keeping the richest statistics and the usable quote.
 const richness=(g:T)=>Number(!!g.pregame)*4+Number(!!g.starters?.away)+Number(!!g.starters?.home);
 const listedDay=uniqueInternationalFixtures(listedCandidates.filter(g=>g.start.startsWith(targetDay)).sort((a,b)=>richness(b)-richness(a)),league);
 const sourceDay=uniqueInternationalFixtures(sourceCandidates.filter(g=>g.start.startsWith(targetDay)).sort((a,b)=>Number(b.live)-Number(a.live)||Number(hasOptions(b))-Number(hasOptions(a))),league);
 const used=new Set<T>();
 const merged=listedDay.map(g=>{
  const found=sourceDay.find(s=>!used.has(s)&&s.home===g.home&&s.away===g.away&&startTime(s)===startTime(g));
  if(!found)return g;
  used.add(found);return {...g,...found,starters:{away:g.starters?.away||found.starters?.away,home:g.starters?.home||found.starters?.home},venue:g.venue||found.venue,pregame:g.pregame||found.pregame};
 }).concat(sourceDay.filter(g=>!used.has(g)));
 const started=(g:T)=>g.live||startTime(g)<=now;
 const games=uniqueInternationalFixtures(merged.sort((a,b)=>Number(started(b))-Number(started(a))||Number(hasOptions(b))-Number(hasOptions(a))||a.start.localeCompare(b.start)),league);
 return {games,days,automaticDay,targetDay};
}
