import {cleanTeamName,teamNameResolver} from './team-name-identity';
export const MLB_TEAM_NAMES: Record<number, string> = {
  108:'洛杉磯天使',109:'亞利桑那響尾蛇',110:'巴爾的摩金鶯',111:'波士頓紅襪',112:'芝加哥小熊',113:'辛辛那提紅人',114:'克里夫蘭守護者',115:'科羅拉多洛磯',116:'底特律老虎',117:'休士頓太空人',118:'堪薩斯皇家',119:'洛杉磯道奇',120:'華盛頓國民',121:'紐約大都會',133:'運動家',134:'匹茲堡海盜',135:'聖地牙哥教士',136:'西雅圖水手',137:'舊金山巨人',138:'聖路易紅雀',139:'坦帕灣光芒',140:'德州遊騎兵',141:'多倫多藍鳥',142:'明尼蘇達雙城',143:'費城費城人',144:'亞特蘭大勇士',145:'芝加哥白襪',146:'邁阿密馬林魚',147:'紐約洋基',158:'密爾瓦基釀酒人'
};

const resolve=teamNameResolver([...Object.values(MLB_TEAM_NAMES).map(name=>[name,name] as const),...Object.entries({'聖路易斯紅雀':'聖路易紅雀','奧克蘭運動家':'運動家','科羅拉多落磯山':'科羅拉多洛磯','科羅拉多洛磯山':'科羅拉多洛磯','科羅拉多落磯':'科羅拉多洛磯'})]);
export const mlbTeamName=(name:string)=>resolve(name)??cleanTeamName(name).replace(/\s/g,'');
