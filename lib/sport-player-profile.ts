import {footballCompetitionName} from './football-team-profile';
export type PlayerColumn=[string,string];
export type PlayerRow={season?:number;label:string;team?:string;date?:string;competition?:string;result?:string;values:Record<string,string>};
export type SportPlayerData={id:string;sport:'football'|'basketball';league:string;name:string;photo:string;number:string;position:string;team:{name:string;href:string}|null;bio:[string,string][];season:number;phase:string;seasons:number[];summary:Record<string,string>;summaryLabel:string;columns:PlayerColumn[];gameColumns:PlayerColumn[];history:PlayerRow[];games:PlayerRow[];warnings:string[];sources:{label:string;url:string}[];fetchedAt:string};
export const BASKETBALL_COLUMNS:PlayerColumn[]=[['gamesPlayed','出賽'],['avgMinutes','場均分鐘'],['avgPoints','場均得分'],['avgRebounds','場均籃板'],['avgAssists','場均助攻'],['avgSteals','場均抄截'],['avgBlocks','場均阻攻'],['fieldGoalPct','投籃命中率'],['threePointFieldGoalPct','三分命中率'],['freeThrowPct','罰球命中率'],['avgTurnovers','場均失誤']];
export const BASKETBALL_GAME_COLUMNS:PlayerColumn[]=[['minutes','分鐘'],['points','得分'],['rebounds','籃板'],['assists','助攻'],['steals','抄截'],['blocks','阻攻'],['turnovers','失誤'],['fieldGoalPct','投籃命中率'],['threePointFieldGoalPct','三分命中率'],['freeThrowPct','罰球命中率']];
export const FOOTBALL_LABELS:Record<string,string>={STRT:'先發',APP:'出賽',G:'進球',A:'助攻',SHOT:'射門',SOG:'射正',FC:'犯規',FA:'遭犯規',YC:'黃牌',RC:'紅牌',OF:'越位',SV:'撲救',GA:'失球',CS:'零封',MIN:'分鐘'};
export const FOOTBALL_GAME_COLUMNS:PlayerColumn[]=[['totalGoals','進球'],['goalAssists','助攻'],['totalShots','射門'],['shotsOnTarget','射正'],['saves','撲救'],['goalsConceded','失球'],['yellowCards','黃牌'],['redCards','紅牌']];
export const playerNameKey=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const playerPosition=(s:string)=>s.split(/[-/]/).map(p=>({G:'後衛',F:'前鋒',C:'中鋒',M:'中場',D:'後衛',GK:'守門員',MF:'中場',FW:'前鋒',DF:'後衛',Guard:'後衛',Forward:'前鋒',Center:'中鋒',Midfielder:'中場',Defender:'後衛',Goalkeeper:'守門員',Attacker:'前鋒'} as Record<string,string>)[p.trim()]||p.trim()).join('／');
export const playerCountry=(s:string)=>({USA:'美國','United States':'美國',England:'英格蘭',France:'法國',Argentina:'阿根廷',Portugal:'葡萄牙',Morocco:'摩洛哥',Spain:'西班牙',Brazil:'巴西',Germany:'德國',Italy:'義大利',Canada:'加拿大',Australia:'澳洲',Japan:'日本',China:'中國',Taiwan:'台灣',Serbia:'塞爾維亞',Slovenia:'斯洛維尼亞',Greece:'希臘',Cameroon:'喀麥隆',Nigeria:'奈及利亞',Belgium:'比利時',Netherlands:'荷蘭',Norway:'挪威',Sweden:'瑞典',Denmark:'丹麥',Poland:'波蘭',Croatia:'克羅埃西亞',Turkey:'土耳其','South Korea':'南韓',Uruguay:'烏拉圭',Colombia:'哥倫比亞',Mexico:'墨西哥',Senegal:'塞內加爾',Switzerland:'瑞士',Scotland:'蘇格蘭',Wales:'威爾斯',Ireland:'愛爾蘭'} as Record<string,string>)[s]||s||'—';
export const statValue=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?String(v):typeof v==='string'&&/^-?\d+(?:\.\d+)?(?:%|:\d+)?$/.test(v.trim())?v.trim():'—';
export function namedValues(names:unknown,stats:unknown){if(!Array.isArray(names)||!Array.isArray(stats)||names.length!==stats.length)return {};return Object.fromEntries(names.map((k,i)=>[String(k),statValue(stats[i])]));}
export function playerCompetition(code:string){return footballCompetitionName(code);}
export function basketballPlayerHref(league:string,p:{id:number;href?:string;officialId?:number}){
 if(league==='NBA')return `/players/nba/${p.id}`;
 const official=p.officialId||p.href?.match(/^https:\/\/www\.wnba\.com\/player\/(\d+)\//)?.[1];
 return `/players/wnba/${official||p.id}${official?'':'?provider=espn'}`;
}
