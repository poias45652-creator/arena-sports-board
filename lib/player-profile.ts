export const PLAYER_GAME_TYPES=[['R','例行賽'],['S','春訓熱身賽'],['F','外卡系列賽'],['D','分區系列賽'],['L','聯盟冠軍賽'],['W','世界大賽']] as const;
export type PlayerGroup='pitching'|'hitting';
export type PlayerStat=Record<string,number|string|null>;
export type PlayerStatLine={season:number;team:{id:number;name:string}|null;opponent:{id:number;name:string}|null;date:string|null;gameId:number|null;home:boolean|null;stat:PlayerStat};
export type PlayerBio={id:number;name:string;number:string|null;position:string;birthDate:string|null;age:number|null;birthPlace:string;height:string|null;weight:number|null;batSide:string;pitchHand:string;debut:string|null;active:boolean|null;team:{id:number;name:string}|null};
export type PlayerGroupData={season:PlayerStat|null;career:PlayerStat|null;history:PlayerStatLine[];games:PlayerStatLine[]};
export type PlayerProfileData={player:PlayerBio;season:number;gameType:string;groups:Record<PlayerGroup,PlayerGroupData>;fetchedAt:string;warnings:string[];source:string};
export const PLAYER_COLUMNS:Record<PlayerGroup,readonly (readonly [string,string])[]>={
  pitching:[['gamesPlayed','出賽'],['gamesStarted','先發'],['wins','勝'],['losses','敗'],['saves','救援'],['inningsPitched','局數'],['hits','被安打'],['earnedRuns','自責分'],['baseOnBalls','保送'],['strikeOuts','三振'],['era','ERA'],['whip','WHIP']],
  hitting:[['gamesPlayed','出賽'],['plateAppearances','打席'],['atBats','打數'],['hits','安打'],['doubles','二壘打'],['triples','三壘打'],['homeRuns','全壘打'],['rbi','打點'],['runs','得分'],['stolenBases','盜壘'],['baseOnBalls','保送'],['strikeOuts','三振'],['avg','AVG'],['obp','OBP'],['slg','SLG'],['ops','OPS']],
};
export const playerPosition=(code:string)=>({P:'投手',C:'捕手','1B':'一壘手','2B':'二壘手','3B':'三壘手',SS:'游擊手',LF:'左外野手',CF:'中外野手',RF:'右外野手',OF:'外野手',DH:'指定打擊',TWP:'投打二刀流'}[code]||code||'尚未提供');
export const playerHand=(code:string)=>({L:'左',R:'右',S:'左右開弓'}[code]||'尚未提供');
export function playerHeight(height:string|null){
  const match=height?.trim().match(/^([1-9])\s*['′’]\s*(\d{1,2})\s*["″”]$/);
  if(!match||Number(match[2])>11)return '尚未提供';
  return `${Math.round((Number(match[1])*12+Number(match[2]))*2.54)} 公分`;
}
export function playerLink(id:number|null|undefined,season?:number|string,gameType?:string){
  if(!Number.isSafeInteger(id)||!id||id<1||id>999999999)return null;
  const query=new URLSearchParams();
  if(season!==undefined&&/^\d{4}$/.test(String(season)))query.set('season',String(season));
  if(PLAYER_GAME_TYPES.some(([key])=>key===gameType))query.set('type',gameType!);
  return `/players/${id}${query.size?'?'+query.toString():''}`;
}
export function parsePlayerQuery(id:string|null,season:string|null,gameType:string|null,current=new Date().getUTCFullYear()){
  const year=season===null?current:Number(season),type=gameType||'R';
  if(!id||!/^[1-9]\d{0,8}$/.test(id)||season!==null&&!/^\d{4}$/.test(season)||!Number.isInteger(year)||year<1876||year>current||!PLAYER_GAME_TYPES.some(([key])=>key===type))return null;
  return {id:Number(id),season:year,gameType:type};
}
const text=(value:unknown)=>typeof value==='string'&&value.trim()?value.trim():null;
const team=(value:any)=>Number.isInteger(value?.id)&&value.id>0?{id:value.id,name:text(value.name)||''}:null;
export function parsePlayerBio(json:any,id:number):PlayerBio|null{
  const person=Array.isArray(json?.people)?json.people.find((p:any)=>p.id===id):null;
  if(!person||!text(person.fullName))return null;
  return {id,name:person.fullName,number:text(person.primaryNumber),position:text(person.primaryPosition?.abbreviation)||'',birthDate:text(person.birthDate),age:Number.isInteger(person.currentAge)?person.currentAge:null,
    birthPlace:[person.birthCity,person.birthStateProvince,person.birthCountry].map(text).filter(Boolean).join('，'),height:text(person.height),weight:typeof person.weight==='number'?person.weight:null,
    batSide:text(person.batSide?.code)||'',pitchHand:text(person.pitchHand?.code)||'',debut:text(person.mlbDebutDate),active:typeof person.active==='boolean'?person.active:null,team:team(person.currentTeam)};
}
function cleanStat(value:any):PlayerStat{
  const result:PlayerStat={};
  for(const [key] of [...PLAYER_COLUMNS.pitching,...PLAYER_COLUMNS.hitting]){
    const v=value?.[key];result[key]=typeof v==='number'&&Number.isFinite(v)&&v>=0?v:typeof v==='string'&&/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(v.trim())?v.trim():null;
  }
  return result;
}
export function playerStatLines(json:any,id:number,group:PlayerGroup,type:'season'|'career'|'yearByYear'|'gameLog',gameType:string,season?:number):PlayerStatLine[]{
  if(!Array.isArray(json?.stats))throw new Error('球員成績格式不符');
  const rows=json.stats.filter((s:any)=>s.group?.displayName===group&&s.type?.displayName===type).flatMap((s:any)=>Array.isArray(s.splits)?s.splits:[]);
  const result=rows.filter((s:any)=>s.stat&&(!s.player?.id||s.player.id===id)&&(!s.sport?.id||s.sport.id===1)&&(!s.gameType||s.gameType===gameType)&&(season===undefined||Number(s.season)===season))
    .map((s:any)=>({season:Number(s.season)||0,team:team(s.team),opponent:team(s.opponent),date:text(s.date),gameId:Number.isInteger(s.game?.gamePk)?s.game.gamePk:null,home:typeof s.isHome==='boolean'?s.isHome:null,stat:cleanStat(s.stat)}));
  const seen=new Set<string>();
  return result.filter((r:PlayerStatLine)=>{const key=JSON.stringify(r);if(seen.has(key))return false;seen.add(key);return true;})
    .sort((a:PlayerStatLine,b:PlayerStatLine)=>b.season-a.season||(b.date||'').localeCompare(a.date||'')||(b.gameId||0)-(a.gameId||0)||(a.team?1:0)-(b.team?1:0));
}
export function playerTotal(rows:PlayerStatLine[]):PlayerStat|null{
  // Prefer the MLB all-team total after a trade; never average team ratios or
  // add baseball innings as decimal fractions.
  const totals=rows.filter(row=>!row.team);
  return totals.length===1?totals[0].stat:rows.length===1?rows[0].stat:null;
}
