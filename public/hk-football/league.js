export const teams = {
  LM: ['理文','LEE MAN','#efd358','#342722'], ND: ['高力北區','NORTH DISTRICT','#77b4e2','#224236'],
  TP: ['大埔','TAI PO','#58ad70','#163a29'], KC: ['傑志','KITCHEE','#72b5e7','#1e346b'],
  SO: ['冠忠南區','SOUTHERN','#e66561','#66282a'], BR: ['標準流浪','BC RANGERS','#87bde1','#25446a'],
  ST: ['至尊沙田','SUPREME SHATIN','#ed9c60','#6c3429'], EA: ['東方','EASTERN','#728fe1','#213360'],
  HK: ['港會','HKFC','#e2e2da','#393d46'], ED: ['東區','EASTERN DISTRICT','#91c6aa','#1d4235'],
  KL: ['和富九龍城','KOWLOON CITY','#bb8ab5','#402341']
};
// League results in chronological order. September cup fixtures are excluded.
const rows = `08/21 20:00 EA ST 1 3
08/22 16:00 SO HK 3 2
08/22 18:30 BR KC 2 3
08/23 16:00 ND TP 2 0
08/23 18:30 LM KL 3 0
08/28 20:00 LM ST 3 0
08/29 16:00 ND KC 0 0
08/29 16:00 SO KL 2 1
08/30 16:00 TP EA 4 1
08/30 18:30 BR ED 1 3
09/05 16:00 TP BR 3 2
09/05 18:30 EA KL 4 0
09/06 16:00 ST ND 0 5
09/06 16:30 HK LM 0 3
09/06 18:30 KC ED 4 1
09/11 20:00 LM ED 2 1
09/12 16:00 TP HK 1 2
09/12 16:00 SO KC 1 3
09/13 16:00 ST KL 2 3
09/13 16:00 ND BR 5 0
09/20 19:00 BR EA 1 0
10/09 20:00 EA ND 1 3
10/10 16:00 TP KL 1 1
10/10 16:00 KC HK 4 0
10/11 16:00 BR LM 0 2
10/11 16:00 SO ED 3 0
10/17 16:00 ED EA 2 2
10/18 16:00 ST HK 2 2
10/18 18:30 BR ND 0 1
10/19 16:00 TP SO 4 2
10/19 18:30 LM KC 1 5
10/30 20:00 KL BR 2 2
10/31 15:00 ED ST 2 1
11/07 15:00 ST BR 1 1
11/07 18:00 LM SO 1 0
11/08 15:00 ND KL 2 1
11/08 16:30 HK EA 2 1
11/08 19:00 ED TP 1 3`;
export const results = rows.split('\n').map(line => {
  const [date, time, home, away, hg, ag] = line.split(' ');
  return {date,time,home,away,hg:Number(hg),ag:Number(ag)};
});
export const fixtures = [
  {id:'lm-nd',home:'LM',away:'ND',date:'11/20',day:'五',time:'20:00',venue:'旺角大球場',headline:'榜首只差一分',note:'高力北區前七場只失兩球，理文則拿下六勝。這場一、二名的直接對決，要看理文主場的進攻能否撬開北區防線。'},
  {id:'tp-kc',home:'TP',away:'KC',date:'11/21',day:'六',time:'15:00',venue:'大埔運動場',headline:'大埔主場迎戰不敗傑志',note:'大埔最近兩場聯賽合共攻入七球。傑志前六場五勝一和，上一次聯賽作客更攻入五球。兩隊都能製造進球，大埔的防守是這場的看點。'},
  {id:'so-br',home:'SO',away:'BR',date:'11/21',day:'六',time:'15:00',venue:'香港仔運動場',headline:'南區回到熟悉的主場',note:'冠忠南區本季三場聯賽勝仗都來自主場。標準流浪最近兩場均踢和，這兩場也都有進球，南區得防對手把比賽拖成拉鋸戰。'},
  {id:'st-ea',home:'ST',away:'EA',date:'11/22',day:'日',time:'15:00',venue:'斧山道運動場',headline:'東方再遇首輪對手',note:'首輪交手，至尊沙田作客以三比一擊敗東方。這次沙田回到主場，兩隊卻都已經連續四場聯賽未贏。東方能否限制沙田的反擊，是這次交手的看點。'}
];
// Official table order at the snapshot, including the competition tie-breaks.
export const tableOrder = ['ND','LM','KC','TP','SO','ED','HK','KL','BR','ST','EA'];
export function record(id, venue='all') {
  return results.filter(r => venue==='home'?r.home===id:venue==='away'?r.away===id:r.home===id || r.away===id)
    .map(r=> {
      const home=r.home===id, gf=home?r.hg:r.ag, ga=home?r.ag:r.hg;
      return {...r,opponent:home?r.away:r.home,side:home?'主':'客',gf,ga,outcome:gf>ga?'勝':gf<ga?'負':'和'};
    });
}
export function totals(matches) {
  return matches.reduce((s,m) => {
    s.n++; s.gf+=m.gf; s.ga+=m.ga;
    if(m.outcome==='勝') s.w++; else if(m.outcome==='和') s.d++; else s.l++;
    return s;
  },{n:0,gf:0,ga:0,w:0,d:0,l:0});
}
