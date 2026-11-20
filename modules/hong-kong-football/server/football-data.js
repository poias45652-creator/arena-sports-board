import {otherCompetitions,archiveSheets,players,playerHistory,pastSeasons,matchData,moreFixtures} from './records.js';
import calibrationAudit from './calibration-audit.json' with {type:'json'};
import {mergeSeason,selectMatchweek} from './season-sync.js';
import {teams, fixtures, results, tableOrder} from '../../../public/hk-football/league.js';
import {hongKongDay} from '../../../public/hk-football/match-days.js';

const league='hkg.1', currentSeason=2026, fetchedAt='2026-11-19T23:00:00+08:00';
const columns=[['APP','出場'],['G','進球'],['A','助攻'],['MIN','上陣分鐘'],['YC','黃牌'],['RC','紅牌']];
const positions={'門將':'G','後衛':'D','中場':'M','前鋒':'F'};
const positionLabel={G:'門將',GK:'門將',D:'後衛',DF:'後衛',CB:'後衛',LB:'後衛',RB:'後衛',M:'中場',CM:'中場',MF:'中場',F:'前鋒',FW:'前鋒'};
const roleOf=p=>positionLabel[p.position]||p.position||positionLabel[p.officialPosition]||'';
const athleteKey=(team,id)=>team+'-'+id;
const athleteIndex=new Map(players.map(p=>[athleteKey(p.team,p.id),p]));
const seasonTeams = season=>season===currentSeason?teams:pastSeasons[season]?.teams||{};
const allNames=Object.assign({},...Object.values(pastSeasons).map(s=>s.teams),teams);
function teamInfo(id,season) {
  const names=seasonTeams(season)[id]||allNames[id];
  return names?{id,name:names[0],englishName:names[1]}:null;
}
function gameOf(row,season,done){
  const day=row.dateISO || (row.date.includes('/')?'2026-'+row.date.replace('/','-'):row.date);
  const id=done?day+'-'+row.home+'-'+row.away:row.id;
  const sheetKey=season===currentSeason?row.date+'-'+row.home+'-'+row.away:id;
  const source=done?(season===currentSeason?matchData[sheetKey]:archiveSheets[sheetKey]):null;
  const start=day+'T'+(row.time||'12:00')+':00+08:00';
  return {id,league,season,start,day,timeConfirmed:!!row.time,home:teamInfo(row.home,season),away:teamInfo(row.away,season),
    homeScore:done?row.hg:null,awayScore:done?row.ag:null,state:done?'final':'scheduled',statusName:done?'STATUS_FULL_TIME':'STATUS_SCHEDULED',
    statusLabel:done?(row.awarded?'完場・裁定':'已完場'):'未開賽',neutral:false,venue:row.venue||source?.venue||'',
    sourceUrl:'/?league=FOOTBALL&competition=hkg.1&view=live&date='+day+'&game='+encodeURIComponent(id),sourceKey:source?sheetKey:null,awarded:!!row.awarded};
}
const seasonCache=new Map();
function seasonGames(season){
  if(seasonCache.has(season))return seasonCache.get(season);
  const done=season===currentSeason?results:pastSeasons[season]?.results||[];
  const games=done.map(r=>gameOf(r,season,true));
  if(season===currentSeason) for(const row of [...fixtures,...moreFixtures])games.push(gameOf(row,season,false));
  games.sort((a,b)=>a.start.localeCompare(b.start));
  seasonCache.set(season,games);return games;
}
function recentMeetings(upcoming,season,currentGames,asOf){
  const scheduled=upcoming.filter(g=>g.state==='scheduled');
  if(!scheduled.length)return {};
  const matches=[...Object.keys(pastSeasons).filter(y=>Number(y)<season).flatMap(y=>seasonGames(Number(y))),...currentGames]
    .filter(g=>g.state==='final'&&!g.awarded&&Number.isInteger(g.homeScore)&&Number.isInteger(g.awayScore))
    .sort((a,b)=>b.start.localeCompare(a.start));
  return Object.fromEntries(scheduled.map(g=>{
    const before=Math.min(asOf,Date.parse(g.start));
    const previous=matches.filter(m=>Date.parse(m.start)<before&&
      ((m.home.id===g.home.id&&m.away.id===g.away.id)||(m.home.id===g.away.id&&m.away.id===g.home.id))).slice(0,5);
    return [g.id,previous.map(m=>({day:m.day,home:m.home.id,away:m.away.id,homeName:m.home.name,awayName:m.away.name,
      homeScore:m.homeScore,awayScore:m.awayScore,href:m.sourceUrl}))];
  }));
}
function teamRows(season,games){
  const rows={};
  for(const id of Object.keys(seasonTeams(season)))rows[id]={team:teamInfo(id,season),games:0,wins:0,draws:0,losses:0,scored:0,conceded:0,form:[]};
  for(const g of games.filter(g=>g.state==='final'))for(const home of [true,false]){
    const r=rows[(home?g.home:g.away).id],s=home?g.homeScore:g.awayScore,c=home?g.awayScore:g.homeScore;
    r.games++;r.scored+=s;r.conceded+=c;
    if(s>c)r.wins++;else if(s===c)r.draws++;else r.losses++;
    r.form.push(s>c?'W':s<c?'L':'D');
  }
  return rows;
}
function table(season,games,updatedAt){
  const rows=teamRows(season,games),archive=pastSeasons[season];
  const order=season===currentSeason?tableOrder:archive?.archiveOrder||[];
  const points=id=>3*rows[id].wins+rows[id].draws;
  const changed=season===currentSeason&&games.some(g=>g.state==='final'&&(!g.sourceKey));
  const ids=changed?[...order].sort((a,b)=>points(b)-points(a)):order.length?order:Object.keys(rows).sort((a,b)=>points(b)-points(a));
  return {seasonLabel:season+'／'+String(season+1).slice(-2),fetchedAt:updatedAt,note:changed?'依已公布賽果計分，同分球隊暫列並列。':archive?.note,
    groups:[{id:'hk',name:season===2021?'中止前戰績':'香港超級聯賽',rows:ids.map((id,i)=>{
      const r=rows[id];return {...r,rank:changed?ids.findIndex(other=>points(id)===points(other))+1:order.length?i+1:null,points:3*r.wins+r.draws,difference:r.scored-r.conceded,form:r.form.slice(-5)};
    })}]};
}
function benchmark(season,games){
  const rows=teamRows(season,games),list=Object.values(rows);
  const sum=key=>list.reduce((n,r)=>n+r[key],0),played=sum('games'),rate=x=>played?x/played:null;
  return {league,season,records:rows,winRate:rate(sum('wins')),drawRate:rate(sum('draws')),unbeatenRate:rate(sum('wins')+sum('draws')),scoredPerGame:rate(sum('scored')),concededPerGame:rate(sum('conceded')),pointsPerGame:rate(3*sum('wins')+sum('draws'))};
}
const playerYears = new Map();
for(const row of [...players.map(p=>({...p,season:currentSeason})),...playerHistory]){
  const id=String(row.id);
  if(!playerYears.has(id))playerYears.set(id,[]);
  playerYears.get(id).push({...row,id,season:Number(row.season)});
}
for(const rows of playerYears.values())rows.sort((a,b)=>b.season-a.season);
const rosterLink=(p)=>'/players/football/hkg.1/'+encodeURIComponent(p.id)+'?team='+encodeURIComponent(p.team)+'&season='+(p.season||currentSeason);
function groupPlayers(season){return season===currentSeason?players:playerHistory.filter(p=>Number(p.season)===season);}
export function registeredPlayer(id,team){
  return athleteIndex.get(athleteKey(team,id))||(!team?playerYears.get(String(id))?.find(p=>p.season===currentSeason):null);
}
function roster(season,id,club,photos){
  const group=new Map(groupPlayers(season).filter(p=>p.team===id).map(p=>[String(p.id),p]));
  if(club?.team===id&&club.season===season){
    for(const entry of club.players){
      const key=String(entry.id),base=group.get(key)||{};
      const updated={...base,...entry,id:key,team:id,season};
      // A club leaderboard is partial. Old totals cannot be carried across new appearances.
      for(const stat of ['goals','assists'])updated[stat]=entry[stat]??(entry.appearances===base.appearances&&entry.minutes===base.minutes?base[stat]:null);
      group.set(key,updated);
    }
  }
  return [...group.values()].map(p=>({id:String(p.id),name:p.name,englishName:p.en||'',number:p.number,position:positions[roleOf(p)]||roleOf(p),
    country:p.sportingCountry||p.country||'',height:p.height?p.height+' 公分':'',photo:p.photo||photos?.[p.id]||playerYears.get(String(p.id))?.find(r=>r.photo)?.photo,href:rosterLink(p),appearances:p.appearances,goals:p.goals,assists:p.assists}));
}
function playerTotals(p){
 return {APP:p.appearances,G:p.goals,A:p.assists,MIN:p.minutes,YC:p.yellow,RC:p.red,STRT:p.startCount,CS:roleOf(p)==='門將'?p.cleanSheets:null};
}
function playerInfo(p,history,updatedAt=fetchedAt,seasonFeed=null){
  const year=p.season,team=teamInfo(p.team,year),label=year+'／'+String(year+1).slice(-2)+' 港超聯賽';
  const summary=playerTotals(p),available=Object.values(summary).some(v=>v!=null),played=p.games||[];
  const identity=history.find(r=>r.season===currentSeason)||p;
  const photoPeriod=identity.photoYear;
  const seasonFixtures=year===currentSeason&&seasonFeed?mergeSeason(seasonGames(year),seasonFeed,Date.now()):seasonGames(year);
  const matchLinks=new Map(seasonFixtures.filter(g=>g.home.id===p.team||g.away.id===p.team).map(g=>{
    const home=g.home.id===p.team,opponent=home?g.away.name:g.home.name;
    return [[g.day,home?'主場':'客場',opponent].join('|'),g.sourceUrl];
  }));
  const availableColumns=[...columns,['STRT','正選'],['CS','零失球']].filter(([k])=>history.some(s=>playerTotals(s)[k]!=null));
  return {id:p.id,league,season:year,seasons:[...new Set(history.map(r=>r.season))],team:{...team,href:'/teams/football/hkg.1/'+encodeURIComponent(p.team)+'?tab=players&season='+year},
    name:p.name||identity.name,number:p.number,photo:p.photo||identity.photo,position:roleOf(p)||roleOf(identity),
    summaryLabel:label,columns:availableColumns,summary:available?summary:{},
    bio:[['姓名',p.name||identity.name],['英文姓名',identity.en],['位置',roleOf(p)||roleOf(identity)],['背號',p.number],['身高',identity.height?identity.height+' 公分':null],['出生日期',identity.birthDate],['國家或地區',identity.country],['足球代表地區',identity.sportingCountry],['球隊',team.name],['照片年份',photoPeriod]].filter(([,v])=>v!=null&&v!==''),
    history:history.map(r=>({label:r.season+'／'+String(r.season+1).slice(-2),season:r.season,team:teamInfo(r.team,r.season)?.name||r.team,href:rosterLink(r),values:playerTotals(r)})),
    gameColumns:[['role','上陣方式','started'],['MIN','上陣分鐘','minutes'],['G','進球','goals'],['A','助攻','assists'],['YC','黃牌','yellow'],['RC','紅牌','red'],['CS','零失球','cleanSheet']].filter(([,label,field])=>played.some(g=>g[field]!=null)).map(([key,label])=>[key,label]),
    otherCompetitions:year===currentSeason?(otherCompetitions[p.id]||[]):[],
    games:played.map(g=>({date:g.date+'T12:00:00+08:00',href:matchLinks.get([g.date,g.venue,g.opponent].join('|')),label:g.opponent+(g.venue?'（'+g.venue+'）':''),result:[g.result,g.score].filter(Boolean).join(' '),values:{role:g.started==null?null:g.started?'正選':'後備入替',MIN:g.minutes,G:g.goals,A:g.assists,YC:g.yellow,RC:g.red,CS:g.cleanSheet==null?null:g.cleanSheet?'是':'否'}})),
    warnings:[...(p.minutesMethod==='sheet90'?['上陣分鐘依正選、換人及紅牌紀錄推算，以 90 分鐘計。']:[]),...(p.coverageNote?[p.coverageNote]:[])],fetchedAt:updatedAt};
}
function eventClock(raw){
  const value=String(raw);
  const phase={BM:['開賽前',-1],HT:['半場',4599],AM:['完場後',30000],EHT:['加時中場',10599],BET:['加時前',9999],EAM:['加時後',29999]}[value];
  if(phase)return {clock:phase[0],order:phase[1]};
  const [min,added='0']=value.split('+');
  return {clock:value+'′',order:Number(min)*100+Number(added)};
}
function detail(game,updatedAt,liveSource,pitchFeed){
  const official=liveSource?.match;
  if(official && (game.state!=='final'||official.state==='final')){
    const pair=official.homeScore!=null&&official.awayScore!=null;
    game={...game,state:official.state,statusName:official.state==='final'?'STATUS_FULL_TIME':'STATUS_IN_PROGRESS',
      statusLabel:official.status,homeScore:pair?official.homeScore:game.homeScore,awayScore:pair?official.awayScore:game.awayScore};
  }
  if(game.state==='final' && pitchFeed?.state!=='final')pitchFeed=null;
  if(pitchFeed && !pitchFeed.delayed && ['pending','unknown','scheduled','live'].includes(game.state)){
    const final=pitchFeed.state==='final';
    const hasPair=pitchFeed.homeScore!=null&&pitchFeed.awayScore!=null;
    const advanced=hasPair && pitchFeed.homeScore>=game.homeScore && pitchFeed.awayScore>=game.awayScore &&
      (pitchFeed.homeScore>game.homeScore||pitchFeed.awayScore>game.awayScore);
    const usePair=hasPair&&(final||advanced||game.homeScore==null||game.awayScore==null||Date.parse(pitchFeed.sourceStamp)>Date.parse(liveSource?.checkedAt||updatedAt));
    game={...game,state:pitchFeed.state,statusName:final?'STATUS_FULL_TIME':'STATUS_IN_PROGRESS',
      statusLabel:final?'已完場':pitchFeed.clock==='中場休息'?pitchFeed.clock:'進行中',
      homeScore:usePair?pitchFeed.homeScore:game.homeScore,awayScore:usePair?pitchFeed.awayScore:game.awayScore};
  }
  const source=(!liveSource||game.state==='final')&&game.sourceKey?(game.season===currentSeason?matchData[game.sourceKey]:archiveSheets[game.sourceKey]):liveSource;
  function player(id,name,team,extra={}){
    const p=game.season===currentSeason?athleteIndex.get(athleteKey(team,id)):playerYears.get(String(id))?.find(p=>p.season===game.season&&p.team===team);
    const identity=playerYears.get(String(id))?.find(r=>r.season===currentSeason);
    return {id:String(id||name),name,position:p?roleOf(p):'',photo:p?.photo||identity?.photo||'',href:p?rosterLink(p):'',...extra};
  }
  const events=[];
  for(const [key,type,label] of [['goals','goal','進球'],['cards','card','牌'],['substitutions','substitution','換人']]){
    for(const e of source?.[key]||[]){
      const title=type==='card'?(e.type==='red'?'紅牌':e.type==='secondYellow'?'兩黃一紅':'黃牌'):type==='goal'?(e.type==='ownGoal'||e.ownGoal?'烏龍球':e.penalty?'十二碼進球':'進球'):label;
      const involved=type==='substitution'?[player(e.inId,e.in+'（入）',e.team),player(e.outId,e.out+'（出）',e.team)]:[player(e.hkfaId,e.name,e.playerTeam||e.team)];
      if(type==='goal'&&e.assistId&&e.assistName)involved.push(player(e.assistId,e.assistName+'（助攻）',e.team));
      events.push({id:[key,e.team,e.minute,e.type,e.hkfaId||e.inId||e.name,e.outId||''].join(':'),teamId:e.team,...eventClock(e.minute),type,label:title,players:involved});
    }
  }
  events.sort((a,b)=>b.order-a.order);
  const commentary=events.map(e=>{
    const side=e.teamId===game.home.id?game.home.name:game.away.name;
    const who=e.players.map(p=>p.name);
    const text=e.type==='substitution'
      ? side+'換人，'+who[0].replace('（入）','')+'入替'+who[1].replace('（出）','')+'。'
      : e.type==='card' ? side+'的'+who[0]+'領到'+e.label+'。' : e.label==='烏龍球'?who[0]+'誤入自家球門，'+side+'得分。':side+'的'+who[0]+(e.label==='十二碼進球'?'射入十二碼。':'取得入球。');
    return {id:e.id,clock:e.clock,text:text+(e.type==='goal'&&who[1]?'助攻球員為'+who[1].replace('（助攻）','')+'。':'')};
  });
  const expectedStats=['控球率','射門','射正','角球','越位','犯規','黃牌','紅牌','撲救','成功傳球','傳球','封阻射門','攔截',...['界外球','預期進球（xG）'].filter(label=>source?.stats?.some(s=>s.label===label))];
  const provided=new Map((source?.stats||[]).map(s=>[s.label,s]));
  if (Array.isArray(source?.cards)) for (const [type,label] of [['red','紅牌'],['yellow','黃牌']]) {
    const total=team=>source.cards.filter(c=>(c.type===type||type==='red'&&c.type==='secondYellow')&&c.team===team.id).length;
    const recorded=provided.get(label);
    provided.set(label,{label,home:recorded?.home??total(game.home),away:recorded?.away??total(game.away)});
  }
  for(const stat of pitchFeed?.stats||[]){
    const official=provided.get(stat.label);
    if(!official||(!pitchFeed.delayed&&game.state!=='final'))provided.set(stat.label,stat);
    if(!expectedStats.includes(stat.label))expectedStats.push(stat.label);
  }
  const stats=source||provided.size?expectedStats.map(label=>({key:label,label,home:provided.get(label)?.home??'—',away:provided.get(label)?.away??'—'})):[];
  const officialActions=events.map(e=>({id:e.id,type:e.type,label:e.label,clock:e.clock,teamId:e.teamId,order:e.order}));
  const extras=(pitchFeed?.events||[]).filter(item=>!officialActions.some(e=>e.clock===item.clock&&e.teamId===item.teamId&&e.label===item.label));
  const actions=[...officialActions,...extras].sort((a,b)=>b.order-a.order);
  const pitch={delayed:pitchFeed?.delayed||false,clock:pitchFeed?.clock||'',actions:actions.slice(0,10),updatedAt:pitchFeed?.sourceStamp||liveSource?.checkedAt||null,notice:pitchFeed?.notice||null};
  const eventOrder=new Map(events.map(e=>[e.id,e.order]));
  for(const item of extras){
    eventOrder.set('pitch-'+item.id,item.order);
    const team=item.teamId===game.home.id?game.home:game.away;
    commentary.push({id:'pitch-'+item.id,clock:item.clock,text:team.name+'・'+item.label});
  }
  if(extras.length)commentary.sort((a,b)=>eventOrder.get(b.id)-eventOrder.get(a.id));
  return {game,pitch,fetchedAt:[updatedAt,liveSource?.checkedAt,pitchFeed?.sourceStamp].filter(t=>Number.isFinite(Date.parse(t))).sort((a,b)=>Date.parse(b)-Date.parse(a))[0]||updatedAt,attendance:source?.attendance??null,stats,events,commentary,
    lineups:[game.away,game.home].map(team=>({team,formation:source?.formations?.[team.id]||null,players:(source?.lineups?.[team.id]||[]).map(p=>player(p.hkfaId,p.name,team.id,{
      number:p.number,starter:p.starter,goals:(source?.goals||[]).filter(e=>e.team===team.id&&e.hkfaId===p.hkfaId&&!e.ownGoal&&e.type!=='ownGoal').length,
      subbedIn:(source?.substitutions||[]).some(e=>e.team===team.id&&e.inId===p.hkfaId),subbedOut:(source?.substitutions||[]).some(e=>e.team===team.id&&e.outId===p.hkfaId)}))}))};
}
const catalog={active:'recent',calibrationAudit,models:[['recent','近期進失球'],['calibrated','賽果校準'],['elo','進球與 Elo'],['score','比分校準']].map(([id,name])=>({id,name,available:id==='recent',enabled:id==='recent'?[true,true,false,false,false]:[false,false,false,false,false],defaults:id==='recent'?[50,50,0,0,0]:[0,0,0,0,0]}))};
export function matchingPlayerGame(player,record,feed,now){
  const schedule=mergeSeason(seasonGames(currentSeason),feed,now);
  return schedule.find(g=>{
    if(g.day!==record.date||g.state!=='final')return false;
    const home=g.home.id===player.team,away=g.away.id===player.team;
    if(!home&&!away)return false;
    const gf=home?g.homeScore:g.awayScore,ga=home?g.awayScore:g.homeScore;
    return record.venue===(home?'主場':'客場')&&record.opponent===(home?g.away.name:g.home.name)&&record.score===gf+'–'+ga;
  });
}
export function recordedMatchSheet(game){
  return game?.sourceKey?matchData[game.sourceKey]:null;
}
export function incomingDetailGame(id,feed,now){
  return mergeSeason(seasonGames(currentSeason),feed,now).find(g=>g.id===id);
}
export function dataResponse(url,feed=null,now=Date.now(),liveSource=null,playerFeed=null,pitchFeed=null){
  const q=url.searchParams,kind=q.get('kind'),id=q.get('team'),year=Number(q.get('season')||currentSeason);
  if(url.pathname==='/api/sport-player'){
    let history=playerYears.get(q.get('id'))||[];
    const updated=playerFeed?.player;
    if(updated&&updated.season===year&&String(updated.id)===q.get('id')&&(!id||updated.team===id)){
      history=[updated,...history.filter(r=>r.season!==year||r.team!==updated.team)].sort((a,b)=>b.season-a.season);
    }
    const rows=history.filter(r=>r.season===year);
    const p=rows.find(r=>r.team===id)||[...rows].sort((a,b)=>(b.appearances??-1)-(a.appearances??-1))[0];
    if(!p)return Response.json({error:'找不到這位球員的賽季資料'},{status:404});
    const profile=playerInfo(p,history,updated?.checkedAt||p.checkedAt||fetchedAt,feed);
    if(!profile.photo&&playerFeed?.photos?.[p.id])profile.photo=playerFeed.photos[p.id];
    return Response.json(profile);
  }
  if(year!==currentSeason && !Object.hasOwn(pastSeasons,year))return Response.json({error:'尚未收錄該球季'},{status:404});
  const schedule=season=>season===currentSeason?mergeSeason(seasonGames(season),feed,now):seasonGames(season);
  const timeFor=season=>season===currentSeason?feed?.checkedAt||fetchedAt:fetchedAt;
  if(url.pathname==='/api/football-team'){
    const team=teamInfo(id,year);
    if(!team)return Response.json({error:'找不到球隊'},{status:404});
    if(q.get('action')==='benchmark')return Response.json(benchmark(year,schedule(year)));
    if(q.get('action')==='roster')return Response.json({league,season:year,team,fetchedAt:playerFeed?.club?.checkedAt||fetchedAt,players:roster(year,id,playerFeed?.club,playerFeed?.photos),coverage:year===currentSeason?(playerFeed?.club?'註冊名單及更新後的出場紀錄':'註冊名單及已收錄出場紀錄'):'已核實的歷季球員'});
    const games=schedule(year).filter(g=>g.home.id===id||g.away.id===id);
    return Response.json({league,season:year,team,games,results:games.filter(g=>g.state==='final'&&!g.awarded),upcoming:games.filter(g=>g.state==='scheduled'),fetchedAt:timeFor(year)});
  }
  if(kind==='models')return Response.json(catalog);
  if(kind==='standings')return Response.json(table(year,schedule(year),timeFor(year)));
  const defaultToToday=kind==='board' && q.get('range')!=='round';
  const date=q.get('date') || (defaultToToday?hongKongDay(new Date(now)):null);
  const season=date?(Number(date.slice(0,4))-(Number(date.slice(5,7))<7?1:0)):currentSeason;
  const games=schedule(season),byDay=date?games.filter(g=>g.day===date):selectMatchweek(games,now);
  if(kind==='detail'){
    const g=byDay.find(g=>g.id===q.get('game'))||games.find(g=>g.id===q.get('game'));return g?Response.json(detail(g,timeFor(season),liveSource,pitchFeed)):Response.json({error:'找不到這場賽事'},{status:404});
  }
  if(kind==='board'){
    const history=q.get('training')==='1'?[...(pastSeasons[season-1]?seasonGames(season-1):[]),...games].filter(g=>g.state==='final'&&!g.awarded).map(({id,season,league,start,state,statusName,neutral,home,away,homeScore,awayScore})=>({id,season,league,start,state,statusName,neutral,home:{id:home.id},away:{id:away.id},homeScore,awayScore})):undefined;
    const meetings=history?recentMeetings(byDay,season,games,Math.min(now,Date.parse(timeFor(season)))):undefined;
    return Response.json({games:byDay,history,meetings,fetchedAt:timeFor(season),sync:season===currentSeason?feed?.source||'snapshot':'archive'});
  }
  return Response.json({error:'查詢不存在'},{status:404});
}
