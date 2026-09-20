// Team codes and official emblems from koreabaseball.com.
export const kboTeamCodes:Record<string,string>={
 'KT 巫師':'KT','LG 雙子':'LG','NC 恐龍':'NC','SSG 登陸者':'SK',
 '三星獅':'SS','起亞虎':'HT','斗山熊':'OB','韓華鷹':'HH','樂天巨人':'LT','培證英雄':'WO',
};
export const kboRecord=(value:string)=>value.replace(/승/g,'勝').replace(/무/g,'和').replace(/패/g,'敗');
