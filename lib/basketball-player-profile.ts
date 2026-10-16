import {officialPlayerProfile} from './nba-official';
import {officialWnbaDirectory} from './wnba-official';
import {NBA_TEAMS,nbaTeam} from './nba';
import {WNBA_TEAMS,wnbaTeam} from './wnba';
import {playerSource} from './sport-player-fetch';
import {BASKETBALL_COLUMNS,BASKETBALL_GAME_COLUMNS,namedValues,playerNameKey,playerPosition,playerCountry,type SportPlayerData,type PlayerRow} from './sport-player-profile';
const label=(league:string,year:number)=>league==='NBA'?`${year-1}–${String(year).slice(-2)}`:String(year);
const phaseName=(phase:string)=>phase==='1'?'熱身賽':phase==='3'?'季後賽':'例行賽';
const team=(league:string,id:string)=>league==='NBA'?nbaTeam(id):wnbaTeam(id);
export function verifiedBasketballIdentity(source:any,expected:{name:string;birthDate:string}){
 return !!source?.id&&playerNameKey(String(source.displayName||''))===playerNameKey(expected.name)&&!!expected.birthDate&&String(source.dateOfBirth||'').slice(0,10)===expected.birthDate;
}
export function basketballPlayerHistory(raw:any,league:string,phase:string):PlayerRow[]{
 if(raw.filters?.find((f:any)=>f.name==='league')?.value!==league.toLowerCase()||String(raw.filters?.find((f:any)=>f.name==='seasontype')?.value)!==phase)throw Error('球員成績聯盟或賽事不符');
 const category=raw.categories?.find((c:any)=>c.name==='averages');if(!category||!Array.isArray(category.statistics))throw Error('歷年成績尚未提供');
 return category.statistics.flatMap((r:any)=>{const year=Number(r.season?.year);if(!Number.isInteger(year)||year<1947)return [];return [{season:year,label:label(league,year),team:team(league,String(r.teamId))?.name||(r.teamId==='0'?'合計':'球季合計'),values:namedValues(category.names,r.stats)}];}).sort((a:PlayerRow,b:PlayerRow)=>b.season!-a.season!);
}
export function basketballPlayerGames(raw:any,league:string,season:number,phase:string):PlayerRow[]{
 if(Number(raw.filters?.find((f:any)=>f.name==='season')?.value)!==season||!Array.isArray(raw.names)||!Array.isArray(raw.seasonTypes))throw Error('逐場紀錄年度不符');
 const seen=new Set<string>(),rows:PlayerRow[]=[];
 for(const group of raw.seasonTypes){const name=String(group.displayName||''),type=/Preseason/i.test(name)?'1':/Postseason/i.test(name)?'3':/Regular Season/i.test(name)&&!/Play In/i.test(name)?'2':'';if(type!==phase)continue;
 for(const c of group.categories||[])for(const r of c.events||[]){const e=raw.events?.[r.eventId];if(!e||seen.has(String(r.eventId))||!Number.isFinite(Date.parse(e.gameDate))||!['W','L'].includes(e.gameResult))continue;seen.add(String(r.eventId));const values=namedValues(raw.names,r.stats);values.rebounds=values.totalRebounds||'—';values.threePointFieldGoalPct=values.threePointPct||'—';rows.push({season,label:team(league,String(e.opponent?.id))?.name||e.opponent?.displayName||'—',date:e.gameDate,result:(e.gameResult==='W'?'勝':'負')+' '+String(e.score||''),competition:phaseName(phase),values});}}
 return rows.sort((a,b)=>Date.parse(b.date!)-Date.parse(a.date!));
}
export async function basketballPlayerProfile(id:string,league:'NBA'|'WNBA',requestedSeason?:number,phase='2',provider='official'):Promise<SportPlayerData>{
 let name='',birthDate='',photo='',number='',position='',height='',weight='',country='',school='',teamId='',sourceUrl='',officialStats:any=null,officialSeason=0,officialGames:any[]=[],espnId=provider==='espn'?id:'';
 const lower=league.toLowerCase(),espnRoot=`https://site.web.api.espn.com/apis/common/v3/sports/basketball/${lower}/athletes`;
 if(provider==='espn'){
  const p=(await playerSource(`${espnRoot}/${id}`)).athlete;if(String(p?.id)!==id||!p.displayName)throw Error('球員身分不符');name=p.displayName;birthDate=String(p.dateOfBirth||'').slice(0,10);photo=p.headshot?.href||'';number=String(p.jersey||'');position=p.position?.displayName||'';height=p.displayHeight||'';weight=String(p.displayWeight||'').replace('lbs','磅');country=p.citizenship||p.birthPlace?.country||'';school=p.college?.name||'';teamId=String(p.team?.id||'');sourceUrl=`https://www.espn.com/${lower}/player/_/id/${id}`;
 }else if(league==='NBA'){
  const p=await officialPlayerProfile(Number(id));if(!p)throw Error('找不到這位球員');({name,birthDate,photo,number,position,height,country,school}=p);weight=p.weight?`${p.weight} 磅`:'';teamId=p.team?.id||'';sourceUrl=p.sourceUrl;officialStats=p.stats;officialSeason=/^\d{4}/.test(p.stats.season)?Number(p.stats.season.slice(0,4))+1:0;officialGames=p.games;
 }else{
  const directory=await officialWnbaDirectory(),entry=directory.players.find(p=>p.id===Number(id));if(!entry)throw Error('找不到這位球員');
  const html=await playerSource(entry.href,true),json=html.match(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/)?.[1];if(!json)throw Error('球員資料暫時無法讀取');const p=JSON.parse(json).props?.pageProps?.player,i=p?.info;
  if(Number(p?.pid)!==Number(id)||Number(i?.PERSON_ID)!==Number(id)||playerNameKey(i.DISPLAY_FIRST_LAST)!==playerNameKey(entry.name))throw Error('球員身分不符');
  name=i.DISPLAY_FIRST_LAST;birthDate=String(i.BIRTHDATE||'').slice(0,10);photo=entry.photo;number=String(i.JERSEY||'');position=i.POSITION||'';height=i.HEIGHT||entry.height;weight=i.WEIGHT?`${i.WEIGHT} 磅`:'';country=i.COUNTRY||'';school=i.SCHOOL||'';sourceUrl=entry.href;
  const code=({LAS:'LA',LVA:'LV',NYL:'NY',WAS:'WSH',GSV:'GS'} as Record<string,string>)[p.teamAbbr]||p.teamAbbr;teamId=WNBA_TEAMS.find(t=>t.code===code)?.id||'';
  officialStats={points:p.stats?.PTS,rebounds:p.stats?.REB,assists:p.stats?.AST};officialSeason=Number(p.stats?.TimeFrame);officialGames=(p.latestGames||[]).filter((g:any)=>Number(g.Player_ID)===Number(id)&&g.GAME_STATUS===3).map((g:any)=>({id:g.Game_ID,season:g.SEASON_ID,date:g.GAME_DATE,matchup:g.MATCHUP,result:g.WL,minutes:g.MIN,points:g.PTS,rebounds:g.REB,assists:g.AST,steals:g.STL,blocks:g.BLK,turnovers:g.TOV,fieldGoals:g.FG_PCT,threes:g.FG3_PCT,freeThrows:g.FT_PCT}));
 }
 const warnings:string[]=[],sources=[{label:`${league} 球員資料`,url:sourceUrl}];let history:PlayerRow[]=[],games:PlayerRow[]=[];
 if(!espnId&&teamId)try{const roster=await playerSource(`https://site.api.espn.com/apis/site/v2/sports/basketball/${lower}/teams/${teamId}/roster`);if(String(roster.team?.id)!==teamId)throw Error();const matches=(roster.athletes||[]).filter((p:any)=>verifiedBasketballIdentity(p,{name,birthDate}));if(matches.length===1)espnId=String(matches[0].id);}catch{}
 if(espnId)try{const raw=await playerSource(`${espnRoot}/${espnId}/stats?seasontype=${phase}`);history=basketballPlayerHistory(raw,league,phase);sources.push({label:'ESPN 歷年與逐場成績',url:`https://www.espn.com/${lower}/player/stats/_/id/${espnId}`});}catch{warnings.push('歷年成績暫時無法取得。');}
 else warnings.push('歷年成績尚未完成球員身分核對。');
 const season=requestedSeason||history[0]?.season||officialSeason||new Date().getUTCFullYear();
 if(espnId)try{games=basketballPlayerGames(await playerSource(`${espnRoot}/${espnId}/gamelog?season=${season}&seasontype=${phase}`),league,season,phase);}catch{warnings.push('完整逐場紀錄暫時無法取得。');}
 if(!games.length&&officialGames.length){const prefix=phase==='3'?'4':phase==='1'?'1':'2';games=officialGames.filter(g=>g.season===prefix+String(league==='NBA'?season-1:season)).map(g=>({season,label:String(g.matchup).replace(/\b[A-Z]{2,3}\b/g,(code:string)=>{const aliases:Record<string,string>={GSW:'GS',NOP:'NO',NYK:'NY',SAS:'SA',UTA:'UTAH',WAS:'WSH',LAS:'LA',LVA:'LV',NYL:'NY'};return (league==='NBA'?NBA_TEAMS:WNBA_TEAMS).find(t=>t.code===(aliases[code]||code))?.name||code;}).replace(' vs. ',' 主場對 ').replace(' @ ',' 客場對 '),date:new Date(g.date+' 12:00:00 GMT').toISOString(),competition:phaseName(phase),result:g.result==='W'?'勝':'負',values:Object.fromEntries(['minutes','points','rebounds','assists','steals','blocks','turnovers'].map(k=>[k,g[k]===null||g[k]===undefined?'—':String(g[k])]))}));if(games.length)warnings.push('目前顯示官方近期逐場紀錄。');}
 const rows=history.filter(r=>r.season===season),selected=rows.find(r=>r.team==='合計')||rows.find(r=>r.team===team(league,teamId)?.name)||rows[0],summary=selected?.values||{};
 if(!selected&&officialStats&&officialSeason===season&&phase==='2')for(const [k,v] of [['avgPoints',officialStats.points],['avgRebounds',officialStats.rebounds],['avgAssists',officialStats.assists]])if(typeof v==='number')summary[k]=String(v);
 return {id,sport:'basketball',league,name,photo,number,position:playerPosition(position),team:teamId&&team(league,teamId)?{name:team(league,teamId)!.name,href:`/teams/${lower}/${teamId}`}:null,bio:[['出生日期',birthDate||'—'],['國籍',playerCountry(country)],['身高',height||'—'],['體重',weight||'—'],['學校',school||'—']],season,phase,seasons:[...new Set([season,...history.map(r=>r.season!),...officialGames.map(g=>Number(g.season.slice(1))+(league==='NBA'?1:0))])].filter(y=>Number.isInteger(y)&&y>=1947&&y<=new Date().getUTCFullYear()+1).sort((a,b)=>b-a),summary,summaryLabel:`${label(league,season)} · ${phaseName(phase)}${selected?.team?' · '+selected.team:''}`,columns:BASKETBALL_COLUMNS,gameColumns:BASKETBALL_GAME_COLUMNS,history,games,warnings,sources,fetchedAt:new Date().toISOString()};
}
