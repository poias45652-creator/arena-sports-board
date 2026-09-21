import {pitcherIdentity} from './international-pitcher-identity';
import {internationalTeam} from './international-teams';
import type {PregameData,PregameGame,PregameSide,PregameExclusion} from './international-pregame';
import {displayPitcherStat} from './international-pregame';
const fields=['wins','losses','era','opponentAverage','innings','strikeouts','walks','whip'] as const;
const emptyTable=(title:string)=>({title,headers:[],rows:[]});
const taipeiStart=(v:string)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).format(new Date(v));
export function addNewsStarters(snapshot:PregameData,news:any):PregameData{
 if(snapshot.league!==news.league||snapshot.date!==news.date)return snapshot;
 return {...snapshot,games:snapshot.games.map(g=>{
  const n=news.games.find((n:any)=>n.away===g.away.team&&n.home===g.home.team&&n.start===g.start);if(!n)return g;
  const out={...g};for(const side of ['away','home'] as const){if(g[side].starter.name)continue;
   out[side]={...g[side],starter:{...g[side].starter,name:n[side+'Starter'],warnings:['新聞預告先發；投手成績與臨時異動仍待來源補充。'],source:news.source}};
  }return out;
 })};
}
// Merge exact date, sides and start time. A new pitcher discards the previous
// pitcher's statistics. Static fields retain their own original provenance.
export function currentPregame(league:string,date:string,feed:any,archives:PregameData[]):PregameData{
 const byFixture=new Map<string,PregameGame>();
 const excluded=new Map<string,PregameExclusion>();
 const excludedKey=(g:{start:string;away:string;home:string})=>`${g.start}|${internationalTeam(g.away,league)}|${internationalTeam(g.home,league)}`;
 for(const a of archives)if(a.league===league&&a.date===date)for(const x of a.excludedFixtures||[])if(x.start.startsWith(date+' '))excluded.set(excludedKey(x),x);
 const key=(g:PregameGame)=>`${g.start}|${internationalTeam(g.away.team,league)}|${internationalTeam(g.home.team,league)}`;
 for(const archive of archives){if(archive?.league!==league||archive.date!==date)continue;for(const g of archive.games){const old=byFixture.get(key(g));if(!old||Date.parse(g.source.observedAt)>Date.parse(old.source.observedAt))byFixture.set(key(g),g);}}
 for(const live of feed.games||[]){
  if(live.league===league&&live.date===date&&!live.sourceStale&&Number.isFinite(Date.parse(live.startTime))&&Number.isFinite(Date.parse(live.source?.fetchedAt))){
   const x={start:taipeiStart(live.startTime),away:live.away.name,home:live.home.name,status:live.status,observedAt:live.source.fetchedAt,sourceUrl:live.source.url},k=excludedKey(x),old=excluded.get(k);
   if(['cancelled','postponed','suspended'].includes(live.status))excluded.set(k,x);
   else if(live.status==='pregame'&&old&&Date.parse(x.observedAt)>Date.parse(old.observedAt))excluded.delete(k);
  }
  if(live.league!==league||live.date!==date||!live.startTime||live.sourceStale||live.status!=='pregame')continue;
  const captured=Date.parse(live.source?.fetchedAt),startTime=Date.parse(live.startTime);if(!Number.isFinite(captured)||!Number.isFinite(startTime)||captured>=startTime)continue;
  const start=taipeiStart(live.startTime),away=internationalTeam(live.away.name,league),home=internationalTeam(live.home.name,league),k=`${start}|${away}|${home}`,previous=byFixture.get(k);
  if(previous&&Date.parse(previous.source.observedAt)>captured)continue;
  const source={name:live.source.provider,url:live.source.url,observedAt:live.source.fetchedAt,publishedAt:null,sourceTitle:`${date} ${away} vs ${home}`,contentSha256:''};
  const sideData=(side:'away'|'home'):PregameSide=>{
   const old=previous?.[side],person=live.starters?.[side],name=person?.name||old?.starter.name||'';
   const same=!!person?.name&&!!old?.starter.name&&pitcherIdentity(person.name,league,old.team)===pitcherIdentity(old.starter.name,league,old.team);
   const preserve=!!old&&(!person?.name||same);
   const starter:PregameSide['starter']=preserve?{...old.starter}:{name,throws:person?.throws||null,season:Object.fromEntries(fields.map(f=>[f,''])) as PregameSide['starter']['season'],splits:emptyTable('投手分項成績'),recent:emptyTable('逐場出賽紀錄'),quality:'unavailable',warnings:[]};
   if(person?.name){
    starter.name=person.name;
    // A partial fresh row must not silently replace a previously flagged season.
    if(!preserve||starter.quality!=='needs_review'){
     const values=Object.fromEntries(fields.filter(f=>Number.isFinite(person[f])).map(f=>[f,String(person[f])]));
     if(Object.keys(values).length){starter.season={...starter.season,...values};starter.quality='source_reported';starter.statSources={...starter.statSources};for(const field of fields)if(field in values)starter.statSources[field]={name:person.source?.provider||source.name,url:person.source?.url||source.url,observedAt:person.source?.fetchedAt||source.observedAt,publishedAt:null};}
    }
    starter.source={name:person.source?.provider||source.name,url:person.source?.url||source.url,observedAt:person.source?.fetchedAt||source.observedAt,publishedAt:null};
   }
   return {team:side==='away'?away:home,teamCode:old?.teamCode||live[side].id,sourceTeam:live[side].name,starter,bullpen:old?.bullpen||null,batting:old?.batting||emptyTable('團隊打擊'),...(old?.record?{record:old.record}:{}),...(old?.battingWarnings?{battingWarnings:old.battingWarnings}:{}),...(old?.pitchingSource&&preserve?{pitchingSource:old.pitchingSource}:{}),...(old?.gameLogs&&preserve?{gameLogs:old.gameLogs}:{}),...(old?{retainedSource:old.retainedSource||previous!.source}:{}),lineup:live.lineups?.[side]||[]};
  };
  byFixture.set(k,{id:previous?.id||live.id,league,date,start,kind:'pregame_snapshot',liveVerified:false,source,away:sideData('away'),home:sideData('home'),...(previous?.comparison?{comparison:previous.comparison,comparisonSource:previous.comparisonSource,rules:previous.rules}:{})});
 }
 const games=[...byFixture.values()].filter(g=>!excluded.has(key(g))).sort((a,b)=>a.start.localeCompare(b.start));
 return {excludedFixtures:[...excluded.values()],schemaVersion:1,league,season:Number(date.slice(0,4)),date,observedAt:games.map(g=>g.source.observedAt).sort().at(-1)||'',games};
}
export function pregameMissing(snapshot:PregameData){
 const teams=snapshot.games.flatMap(g=>[g.away,g.home]);
 return {games:snapshot.games.length,teams:teams.length,starters:teams.filter(t=>t.starter.name).length,era:teams.filter(t=>/^\d+(\.\d+)?$/.test(displayPitcherStat(t,'era'))).length,whip:teams.filter(t=>/^\d+(\.\d+)?$/.test(displayPitcherStat(t,'whip'))).length,bullpens:teams.filter(t=>t.gameLogs?.bullpen||t.bullpen).length,lineups:teams.filter(t=>t.lineup?.length===9).length,review:teams.filter(t=>!t.gameLogs?.starter&&t.starter.quality==='needs_review').map(t=>`${t.team} ${t.starter.name}`)};
}
