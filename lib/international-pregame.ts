import type {SourceTable} from './international';
import type {CpblLogMetrics} from './cpbl-game-logs';
export type PitchingImportSource={name:string;url:string;receivedAt:string;capturedAt:string|null;contentSha256:string;sourceTitle:string};

export type PregamePitchingStats = Record<'wins'|'losses'|'era'|'opponentAverage'|'innings'|'strikeouts'|'walks'|'whip',string>;
export type PregameSide = {
 team:string;teamCode:string;sourceTeam:string;record?:string;
 starter:{review?:{reviewedAt:string;note:string;sources:{name:string;url:string;observedAt:string}[]};name:string;throws:string|null;season:PregamePitchingStats;splits:SourceTable;recent:SourceTable;quality:string;warnings:string[];source?:{name:string;url:string;observedAt:string;publishedAt:string|null};statSources?:Partial<Record<keyof PregamePitchingStats,{name:string;url:string;observedAt:string;publishedAt:string|null}>>};
 bullpen:PregamePitchingStats|null;batting:SourceTable;battingWarnings?:string[];
 pitchingSource?:PitchingImportSource;
 gameLogs?:CpblLogMetrics;
 retainedSource?:PregameGame['source'];
 lineup?:{name:string;order:number|null;position:string|null}[];
};
export type PregameGame = {
 id:string;league:string;date:string;start:string;away:PregameSide;home:PregameSide;
 source:{name:string;url:string;observedAt:string;publishedAt:string|null;sourceTitle:string;contentSha256:string};
 kind:string;liveVerified:boolean;comparison?:SourceTable;
 comparisonSource?:{name:string;url:string;observedAt:string;throughDate:string;games:number};
 rules?:{league:'KBO';season:number;phase:'regular';maxInnings:11;sourceUrl:string;fixtureObservedAt:string};
};
export type PregameData = {schemaVersion:number;league:string;season:number;date:string;observedAt:string;games:PregameGame[]};
export type PregameFixture = {id:string;start:string;home:string;away:string;live:boolean;displayMarkets:unknown[];starters?:{home?:string;away?:string};pregame?:PregameGame};
const normalizedStart=(s:string)=>s.replaceAll('/','-');
const key=(g:PregameFixture)=>`${normalizedStart(g.start)}|${g.away}|${g.home}`;
const pairing=(g:PregameFixture)=>`${normalizedStart(g.start).slice(0,10)}|${g.away}|${g.home}`;

// Each import belongs only to its original dated fixture. Preserve newer schedules and imports.
export function mergePregameFixtures(fixtures:PregameFixture[],snapshot:PregameData|undefined,league:string,knownSchedule:PregameFixture[]=[]):PregameFixture[]{
 const result=fixtures.map(g=>({...g}));
 if(!snapshot||snapshot.league!==league||!['CPBL','NPB','KBO'].includes(league))return result;
 const knownPairs=new Set(knownSchedule.map(pairing));
 for(const data of snapshot.games){
  if(data.league!==league||data.kind!=='pregame_snapshot'||data.date!==snapshot.date||!data.start.startsWith(data.date+' ')||Number(data.date.slice(0,4))!==snapshot.season)continue;
  const startTime=Date.parse(data.start.replace(' ','T')+'+08:00'),captured=Date.parse(data.source.observedAt);
  if(!Number.isFinite(startTime)||!Number.isFinite(captured)||captured>=startTime)continue;
  const imported:PregameFixture={id:`playsport-${league}-${data.id}`,start:data.start,away:data.away.team,home:data.home.team,live:false,displayMarkets:[]};
  const index=result.findIndex(g=>key(g)===key(imported));
  if(index<0&&knownPairs.has(pairing(imported)))continue;
  const previous=index>=0?result[index]:imported;
  if(previous.live||previous.pregame&&Date.parse(previous.pregame.source.observedAt)>captured)continue;
  if(previous.starters&&(['away','home'] as const).some(side=>previous.starters?.[side]&&data[side].starter.name&&previous.starters[side]!.replace(/\s/g,'')!==data[side].starter.name.replace(/\s/g,'')))continue;
  const enriched={...previous,pregame:data,starters:{away:previous.starters?.away||data.away.starter.name,home:previous.starters?.home||data.home.starter.name}};
  if(index>=0)result[index]=enriched;else result.push(enriched);
 }
 return result;
}

export function displayPitcherStat(side:PregameSide|undefined,field:'era'|'whip'){
 const derived=side?.gameLogs?.starter;
 if(derived&&derived.name===side?.starter.name&&Number.isFinite(derived[field]))return derived[field].toFixed(2);
 return side?.starter.quality==='source_reported'?(side.starter.season[field]||'—'):'—';
}

export function summarizePregameImport(snapshot:PregameData){
 const teams=snapshot.games.flatMap(g=>[g.away,g.home]);
 return {league:snapshot.league,date:snapshot.date,games:snapshot.games.length,teams:teams.length,
  pitchers:teams.filter(t=>t.starter.name).length,usablePitchers:teams.filter(t=>t.gameLogs?.starter||t.starter.quality==='source_reported').length,
  reviewPitchers:teams.filter(t=>!t.gameLogs?.starter&&t.starter.quality==='needs_review').map(t=>`${t.team} ${t.starter.name}`),
  reviewBatting:teams.filter(t=>t.battingWarnings?.length).map(t=>t.team),
  bullpens:teams.filter(t=>t.gameLogs?.bullpen||t.bullpen).length,completeBullpens:teams.filter(t=>t.gameLogs?.bullpenScope==='season'||t.bullpen&&['era','innings','whip','strikeouts','walks'].every(k=>/^\d+(?:\.\d+)?$/.test(t.bullpen![k as keyof PregamePitchingStats]))&&Number(t.bullpen.innings)>0).length,batting:teams.filter(t=>t.batting.rows.length).length,
  appearances:teams.reduce((sum,t)=>sum+(t.gameLogs?.starter?.games??t.starter.recent.rows.length),0),observedAt:snapshot.observedAt};
}
