import {plain,tables,yahooObjects,parseInternational,type SourceTable} from './international';
import type {TeamGame} from './team-profile';
export type ProfileLeague='CPBL'|'NPB'|'KBO';
export const profileTeams:Record<ProfileLeague,Record<string,string>>={
 CPBL:{ACN:'中信兄弟',ADD:'統一獅',AEO:'富邦悍將',AJL:'樂天桃猿',AAA:'味全龍',AKP:'台鋼雄鷹'},
 NPB:{g:'讀賣巨人',t:'阪神虎',db:'橫濱 DeNA 海灣之星',d:'中日龍',c:'廣島東洋鯉魚',s:'東京養樂多燕子',h:'福岡軟銀鷹',f:'北海道日本火腿鬥士',b:'歐力士猛牛',e:'東北樂天金鷲',l:'埼玉西武獅',m:'千葉羅德海洋'},
 KBO:{KT:'KT 巫師',LG:'LG 雙子',NC:'NC 恐龍',SK:'SSG 登陸者',SS:'三星獅',HT:'起亞虎',OB:'斗山熊',HH:'韓華鷹',LT:'樂天巨人',WO:'培證英雄'},
};
export function profileTeamId(league:ProfileLeague,code:string){return Object.keys(profileTeams[league]).indexOf(code)+1;}
export function profileCode(league:ProfileLeague,name:string){const clean=(s:string)=>s.replace(/\s|7-ELEVEn/g,'');return Object.keys(profileTeams[league]).find(c=>clean(profileTeams[league][c])===clean(name));}
export function profileHref(league:ProfileLeague,code:string){return `/teams/international/${league.toLowerCase()}/${code}`;}
export type ProfileGame=TeamGame&{url?:string;venue?:string;timeKnown?:boolean};
const score=(s:unknown)=>s!==null&&s!==undefined&&/^\d+$/.test(String(s))?Number(s):null;
const game=(year:number,id:number,date:string,homeId:number,awayId:number,hs:number|null,as:number|null,status:string,extra:Partial<ProfileGame>={}):ProfileGame=>({id,season:year,date,start:date+'T12:00:00+08:00',homeId,awayId,homeScore:hs,awayScore:as,state:status==='已完賽'?'Final':status==='進行中'?'Live':'Preview',status,completed:status==='已完賽'&&hs!==null&&as!==null,timeKnown:false,...extra});
export function uniqueGames(games:ProfileGame[]){const seen=new Map<number,ProfileGame>();for(const g of games){const old=seen.get(g.id);if(old&&(old.homeId!==g.homeId||old.awayId!==g.awayId||old.date!==g.date))throw Error('來源場次識別衝突');seen.set(g.id,g);}return [...seen.values()].sort((a,b)=>a.start.localeCompare(b.start)||a.id-b.id);}
export function cpblResults(html:string,year:number){
 const out:ProfileGame[]=[];
 for(const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
  const link=tr[1].match(/href="(\/box\?KindCode=A&amp;Year=(\d{4})&amp;GameSno=(\d+))"/);if(!link)continue;if(+link[2]!==year)throw Error('中職來源年度不符');
  const r=[...tr[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(x=>plain(x[1]));
  const away=profileCode('CPBL',r[4]),home=profileCode('CPBL',r[6]);if(!home||!away||!/^\d{4}\/\d{2}\/\d{2}$/.test(r[2])||score(r[5])===null||score(r[7])===null)throw Error('中職逐場欄位無法核對');
  out.push(game(year,+link[3],r[2].replaceAll('/','-'),profileTeamId('CPBL',home),profileTeamId('CPBL',away),score(r[7]),score(r[5]),'已完賽',{url:'https://cpbl.com.tw'+plain(link[1]),venue:r[1]}));
 }if(!out.length)throw Error('未取得中職逐場紀錄');return uniqueGames(out);
}
export function cpblUpcoming(html:string,year:number){const codes:Record<string,string>={'1':'ACN','2':'ADD','5':'AEO','6':'AJL','7':'AAA','8':'AKP'},out:ProfileGame[]=[];for(const g of yahooObjects(html)){
 const h=codes[g.homeTeamId?.split('.').at(-1)],a=codes[g.awayTeamId?.split('.').at(-1)];if(!h||!a||g.seasonPhase!=='REGULAR_SEASON'||!g.startTime?.startsWith(`${year}-`)||!/^cpbl\.g\.\d{9}$/.test(g.gameId)||!['PREGAME','IN_PROGRESS','SUSPENDED'].includes(g.status))continue;
 const start=new Date(g.startTime).toISOString(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei'}).format(new Date(start));
 out.push(game(year,Number(g.gameId.slice(-3)),date,profileTeamId('CPBL',h),profileTeamId('CPBL',a),g.status==='PREGAME'?null:score(g.homeScore),g.status==='PREGAME'?null:score(g.awayScore),g.status==='PREGAME'?'未開賽':g.status==='SUSPENDED'?'暫停':'進行中',{start,timeKnown:true}));
 }return uniqueGames(out);}
export function cpblYahooGames(html:string,year:number){
 const codes:Record<string,string>={'cpbl.t.1':'ACN','cpbl.t.2':'ADD','cpbl.t.5':'AEO','cpbl.t.6':'AJL','cpbl.t.7':'AAA','cpbl.t.8':'AKP'},out:ProfileGame[]=[];
 for(const g of yahooObjects(html)){
  const h=codes[g.homeTeamId],a=codes[g.awayTeamId];if(!h||!a||h===a||g.seasonPhase!=='REGULAR_SEASON'||!g.startTime?.startsWith(`${year}-`)||!/^cpbl\.g\.\d{9}$/.test(g.gameId))continue;
  const time=Date.parse(g.startTime);if(!Number.isFinite(time))continue;
  const start=new Date(time).toISOString(),date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei'}).format(new Date(time));
  if(g.gameId.slice(7,13)!==date.replaceAll('-','').slice(2))continue;
  const labels:Record<string,string>={FINAL:'已完賽',IN_PROGRESS:'進行中',PREGAME:'未開賽',SUSPENDED:'暫停',POSTPONED:'延賽',CANCELLED:'取消'};if(!labels[g.status])continue;
  const played=['FINAL','IN_PROGRESS','SUSPENDED'].includes(g.status),hs=played?score(g.homeScore):null,as=played?score(g.awayScore):null;
  if(g.status==='FINAL'&&(hs===null||as===null))continue;
  out.push(game(year,Number(g.gameId.slice(-3)),date,profileTeamId('CPBL',h),profileTeamId('CPBL',a),hs,as,labels[g.status],{start,timeKnown:true,url:g.alias?.url}));
 }
 if(!out.length)throw Error('Yahoo 尚無可核對的中職逐場紀錄');return uniqueGames(out);
}
export function npbCalendar(html:string,year:number){
 if(!html.includes(` ${year})`))throw Error('日職賽程年度不符');const out:ProfileGame[]=[];
 for(const cell of html.matchAll(/<td class="stschedule"[^>]*>([\s\S]*?)<\/td>/g)){
  const dm=cell[1].match(/games\/gm(\d{4})(\d{2})(\d{2})\.html/);if(!dm||+dm[1]!==year)continue;const date=`${dm[1]}-${dm[2]}-${dm[3]}`;let seq=0;
  for(const row of cell[1].matchAll(/<div>(?:<a href="([^"]+)">)?([A-Z]+)\s+(?:(\d+|\*)\s*-\s*(\d+|\*)|-)\s+([A-Z]+)(?:\s+(\d{1,2}:\d{2}))?(?:<\/a>)?<\/div>/g)){
   const home=profileTeamId('NPB',row[2].toLowerCase()),away=profileTeamId('NPB',row[5].toLowerCase());if(!home||!away)continue;seq++;const hs=score(row[3]),as=score(row[4]),done=hs!==null&&as!==null;
   const id=row[1]?.match(/s(\d+)\.html/)?.[1];out.push(game(year,id?+id:Number(date.replaceAll('-',''))*100+seq,date,home,away,hs,as,done?'已完賽':row[3]==='*'?'延賽／取消':'未開賽',{url:row[1]?'https://npb.jp'+row[1]:`https://npb.jp/bis/eng/${year}/games/gm${date.replaceAll('-','')}.html`,...(row[6]?{start:new Date(`${date}T${row[6].padStart(5,'0')}:00+09:00`).toISOString(),timeKnown:true}:{})}));
  }
 }if(!out.length)throw Error('日職月份未取得可辨識賽事');return uniqueGames(out);
}
export function kboMonth(html:string,year:number){
 const data=parseInternational(html,'kbo-schedule',year),out:ProfileGame[]=[];let seq=0;
 for(const r of data.tables[0].rows){if(r[1]!=='例行賽')continue;const home=profileCode('KBO',r[4]),away=profileCode('KBO',r[2]);if(!home||!away)throw Error('韓職球隊識別不符');const [as,hs]=r[3].split(':').map(score),done=hs!==null&&hs!==undefined&&as!==null&&!/延賽|取消|POSTPONED|CANCEL/i.test(r[6]);seq++;
  out.push(game(year,Number(r[0].slice(0,10).replaceAll('-',''))*1000+seq,r[0].slice(0,10),profileTeamId('KBO',home),profileTeamId('KBO',away),done?hs:null,done?as:null,done?'已完賽':r[6]||'未開賽',{start:new Date(r[0].replace(' ','T')+':00+08:00').toISOString(),timeKnown:true,venue:r[5],url:'https://eng.koreabaseball.com/Schedule/DailySchedule.aspx'}));
 }return out;
}
export function cpblPlayers(html:string,position:'bat'|'pit'):SourceTable{
 const t=tables(html).find(t=>t.headers[0]==='球員'&&t.headers.includes(position==='bat'?'打擊率':'防禦率'));if(!t?.rows.length)throw Error('中職球員成績尚未取得');
 return {...t,title:position==='bat'?'打者球季成績':'投手球季成績',headers:t.headers.map(x=>x==='每局被上壘率'?'WHIP':x==='整體攻擊指數'?'OPS':x),rows:t.rows.filter(r=>r.length===t.headers.length)};
}
export function npbPlayers(html:string,year:number,position:'bat'|'pit'):SourceTable{
 if(!html.includes(`${year}年`))throw Error('日職球員成績年度不符');const t=tables(html).find(t=>t.headers[0]==='選手'&&t.headers.includes(position==='bat'?'打率':'防御率'));if(!t?.rows.length)throw Error('日職球員成績尚未取得');
 const labels:Record<string,string>={選手:'球員',試合:'出賽',打数:'打數',得点:'得分',本塁打:'全壘打',打点:'打點',盗塁:'盜壘',打率:'打擊率',出塁率:'上壘率',防御率:'防禦率',勝利:'勝',敗北:'敗',セーブ:'救援',ホールド:'中繼',投球回:'局數',自責点:'責失',失点:'失分',奪三振:'三振',四球:'保送'};
 return {...t,title:position==='bat'?'打者球季成績':'投手球季成績',headers:t.headers.map(x=>labels[x]||x),rows:t.rows.filter(r=>r.length===t.headers.length&&(position!=='bat'||Number(r[t.headers.indexOf('打席')])>0))};
}
