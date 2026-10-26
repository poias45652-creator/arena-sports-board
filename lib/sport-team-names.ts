import {NBA_TEAMS} from './nba';
import {WNBA_TEAMS} from './wnba';
import {FOOTBALL_TEAM_NAMES,footballTeamName} from './football';
import {cleanTeamName,teamNameResolver} from './team-name-identity';
export type MarketSport='NBA'|'WNBA'|'FOOTBALL';
const aliases:Record<string,string>={'聖馬力諾':'聖馬利諾','意大利':'義大利','格魯吉亞':'喬治亞','克羅地亞':'克羅埃西亞','斯洛文尼亞':'斯洛維尼亞','北馬其頓共和國':'北馬其頓','波黑':'波士尼亞與赫塞哥維納','黑山':'蒙特內哥羅','塞浦路斯':'賽普勒斯','法羅群島':'法羅群島','多蒙特':'多特蒙德','利華古遜':'勒沃庫森','阿仙奴':'阿森納','車路士':'切爾西','愛華頓':'艾佛頓','紐卡素':'紐卡索聯','阿士東維拉':'阿斯頓維拉','白禮頓':'布萊頓','富咸':'富勒姆','賓福特':'布倫特福德','韋斯咸':'西漢姆聯','列斯聯':'里茲聯','般尼':'伯恩利','新特蘭':'桑德蘭','巴塞羅那':'巴塞隆納','皇家貝蒂斯':'皇家貝提斯','維拉利爾':'比利亞雷亞爾','切爾達':'塞爾塔','祖雲達斯':'尤文圖斯','拿玻里':'拿坡里','費倫天拿':'佛羅倫斯','博洛尼亞':'波隆那','烏甸尼斯':'烏迪內斯','萊比錫':'RB萊比錫','慕遜加柏':'門興','弗賴堡':'弗萊堡','巴黎聖日門':'巴黎聖日耳曼'};
// Whole-name identities observed in the supplied October 2/3 SUPER responses.
// These additions apply only to football, never youth/women suffixes or basketball.
const footballAliases:Record<string,string>={
 '阿美尼亞':'亞美尼亞','波斯尼亞和黑塞哥維那':'波士尼亞與赫塞哥維納','哈薩克斯坦':'哈薩克',
 // Exact senior-club names captured in the 2026-10-09 SUPER audit and
 // checked against ESPN fixtures. Never strip women, reserves or U21 suffixes.
 '般尼茅夫':'伯恩茅斯','托特納姆熱刺':'熱刺','雲達不萊梅':'不來梅',
 '奧斯堡':'奧格斯堡','美因茨05':'美因茨','愛斯賓奴':'西班牙人',
 '畢爾巴鄂競技':'畢爾包','艾拉維斯':'阿拉維斯','馬德里體育會':'馬德里競技',
 '巴塞隆拿':'巴塞隆納','基達菲':'赫塔費','利爾':'里爾','圖魯茲':'圖盧茲',
 '巴黎':'巴黎FC','利文斯':'勒芒',
 // Exact spellings in the October 12 source audit, verified against official fixtures.
 '利雲特':'萊萬特','紐卡素聯':'紐卡索聯','拖連奴':'都靈',
 // October 13 production source spellings, checked against both full fixtures.
 'PSV埃因霍溫':'PSV恩荷芬','科木':'科莫','AS羅馬':'羅馬',
 '皇家貝迪斯':'皇家貝提斯','波杜基林特':'博多格林特',
 // October 15 authenticated Europa coverage, verified against ESPN fixtures.
 '採列':'采列','薩爾茨堡紅牛':'薩爾斯堡紅牛',
 // Remaining identities in the full 18-fixture capture at 12:33:44Z.
 '聖吉羅斯':'聖吉羅斯聯','皇家蘇斯達':'皇家社會','圖倫斯':'托倫斯',
 '波茲南萊希':'波茲南萊克','凱爾特人':'塞爾提克','薩格勒布戴拿模':'札格瑞布迪納摩',
 'OFI克雷迪':'OFI克里特','皮爾森':'比爾森勝利','索菲亞利夫斯基':'索菲亞列夫斯基',
 '喬治羅尼亞':'雅蓋隆尼亞','阿拉特阿美尼亞':'阿拉拉特亞美尼亞',
 // October 16 screenshots: Fulham versus Hull City, October 17 at 22:00 Taipei.
 '侯城':'赫爾城',
 // Lazio's full-name regional spellings: HKJC uses 拉素, the club's Chinese
 // site uses 拉齐奥. Keep exact senior-team aliases; never strip squad suffixes.
 '拉素':'拉齊奧','拉齐奥':'拉齊奧',
 // October 23 source event 25125177 matches ESPN fixture 401879253.
 '諾定咸森林':'諾丁漢森林',
 // October 24 production source audit, verified against ESPN fixtures
 // 401882827 (Valencia–Villarreal) and 401884759 (Freiburg–Bayern).
 '華倫西亞':'瓦倫西亞','費雷堡':'弗萊堡',
 // Full source identities independently verified in the October 23/26 audits.
 // These aliases are team-wide and have no date or fixture restriction.
 '奈斯':'尼斯','艾爾切':'埃爾切','薩斯索羅':'薩索洛',
 '史浩克04':'沙爾克04','桑坦德':'桑坦德競技',
};
// Exact full-team spelling observed in SUPER; keep aliases scoped to NBA.
const nbaAliases:Record<string,string>={'費城76人':'費城七六人','曼斐斯灰熊':'曼菲斯灰熊','波士頓塞爾蒂克':'波士頓塞爾提克'};
// SUPER appends (女) to WNBA names. Map only registered full team names in
// this league; never strip women/youth qualifiers from other competitions.
const wnbaAliases=new Map(WNBA_TEAMS.map(team=>[`${team.name}(女)`,team.name]));
export const registeredNames:Record<MarketSport,ReadonlySet<string>>={NBA:new Set(NBA_TEAMS.map(t=>t.name)),WNBA:new Set(WNBA_TEAMS.map(t=>t.name)),FOOTBALL:new Set(FOOTBALL_TEAM_NAMES)};
const sportResolvers={
 NBA:teamNameResolver([...NBA_TEAMS.map(t=>[t.name,t.name] as const),...Object.entries(nbaAliases)]),
 WNBA:teamNameResolver([...WNBA_TEAMS.map(t=>[t.name,t.name] as const),...wnbaAliases.entries()]),
 FOOTBALL:teamNameResolver([...FOOTBALL_TEAM_NAMES.map(name=>[name,name] as const),...Object.entries(aliases),...Object.entries(footballAliases)]),
};
export function sportTeamKey(name:string,sport?:MarketSport){
 const clean=cleanTeamName(name),official=sport==='FOOTBALL'?footballTeamName(clean):clean;
 return (sport?sportResolvers[sport](official):aliases[official])??official.replace(/\s/g,'');
}
