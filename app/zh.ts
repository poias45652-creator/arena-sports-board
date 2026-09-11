// Display names only: source identifiers and numeric values stay unchanged.
const teams: Record<number, string> = {
  108:'洛杉磯天使',109:'亞利桑那響尾蛇',110:'巴爾的摩金鶯',111:'波士頓紅襪',112:'芝加哥小熊',113:'辛辛那提紅人',114:'克里夫蘭守護者',115:'科羅拉多洛磯',116:'底特律老虎',117:'休士頓太空人',118:'堪薩斯皇家',119:'洛杉磯道奇',120:'華盛頓國民',121:'紐約大都會',133:'運動家',134:'匹茲堡海盜',135:'聖地牙哥教士',136:'西雅圖水手',137:'舊金山巨人',138:'聖路易紅雀',139:'坦帕灣光芒',140:'德州遊騎兵',141:'多倫多藍鳥',142:'明尼蘇達雙城',143:'費城費城人',144:'亞特蘭大勇士',145:'芝加哥白襪',146:'邁阿密馬林魚',147:'紐約洋基',158:'密爾瓦基釀酒人'
};
export function teamZh(team: {id?:number;name?:string}|undefined){return teams[team?.id??0] || team?.name || '球隊待確認';}
export function gameDetailZh(game:any){
  const state=game.status?.detailedState || '', line=game.linescore;
  const special:Record<string,string>={Postponed:'延期',Cancelled:'取消',Suspended:'暫停',Delayed:'延遲開賽','Delayed Start':'延遲開賽','Warmup':'賽前熱身','Game Over':'比賽結束',Final:'比賽結束',Completed:'比賽結束'};
  if(/rain/i.test(state))return '因雨延遲';
  if(special[state])return special[state];
  if(game.status?.abstractGameState==='Final')return '比賽結束';
  if(game.status?.abstractGameState==='Live'){
    const half:Record<string,string>={Top:'上',Bottom:'下',Middle:'上半局結束',End:'下半局結束'};
    return line?.currentInning ? `${line.currentInning} 局${half[line.inningState]||'進行中'}` : '比賽進行中';
  }
  return new Date(game.gameDate).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Taipei'})+' 開賽';
}
