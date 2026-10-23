import finalTotals from '../data/npb-2026-final-pitching.json' with {type:'json'};
import {plain,tableData} from './baseball-live-providers.mjs';
import {pitcherStats,pitchingOuts} from './baseball-season-pitching.mjs';
import {parseNpbRelief} from './international-bullpen.mjs';
import {npbUpcomingDate} from '../lib/npb-stats-date.mjs';
// Public independent providers; a denial is never retried through another path.
const TEAMS={g:['讀賣巨人','読売ジャイアンツ','1','Central/G'],t:['阪神虎','阪神タイガース','5','Central/T'],db:['橫濱 DeNA 海灣之星','横浜DeNAベイスターズ','3','Central/DB'],d:['中日龍','中日ドラゴンズ','4','Central/D'],c:['廣島東洋鯉魚','広島東洋カープ','6','Central/C'],s:['東京養樂多燕子','東京ヤクルトスワローズ','2','Central/S'],h:['福岡軟銀鷹','福岡ソフトバンクホークス','12','Pacific/H'],f:['北海道日本火腿鬥士','北海道日本ハムファイターズ','8','Pacific/F'],b:['歐力士猛牛','オリックス・バファローズ','11','Pacific/B'],e:['東北樂天金鷲','東北楽天ゴールデンイーグルス','376','Pacific/E'],l:['埼玉西武獅','埼玉西武ライオンズ','7','Pacific/L'],m:['千葉羅德海洋','千葉ロッテマリーンズ','9','Pacific/M']};
const norm=s=>plain(String(s)).normalize('NFKC').replace(/\s/g,'');
const title=html=>norm(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
const integer=v=>/^\d+$/.test(String(v))?Number(v):null;
const urls=code=>{const t=TEAMS[code];return {team:`https://nf3.sakura.ne.jp/${t[3]}/t/teamdata.htm`,pitch:`https://nf3.sakura.ne.jp/php/stat_disp/stat_disp.php?y=0&leg=${t[3].startsWith('Central')?'0':'1'}&tm=${code.toUpperCase()}&fp=1&dn=1&dk=0`,yahoo:`https://baseball.yahoo.co.jp/npb/teams/${t[2]}/pitchingstats`};};
export function parseNpbSeasonBackup(code,pages,date,observedAt){
 const identity=TEAMS[code],anchor=finalTotals.teams[code];
 if(!identity||!anchor||date.slice(0,4)!==String(finalTotals.season)||date<finalTotals.verifiedOn||!npbUpcomingDate(date,observedAt))throw Error('備援球季或賽前日期未核對');
 const u=urls(code),[team,japanese]=identity;
 if(!title(pages.pitch).includes('2026年度版')||!title(pages.pitch).includes(norm(japanese))||!title(pages.pitch).includes('投手成績一覧'))throw Error('備援投手表球隊或球季不符');
 if(!title(pages.yahoo).includes(norm(japanese))||pages.yahoo.match(/property=["']og:url["']\s+content=["']([^"']+)/)?.[1]!==u.yahoo)throw Error('Sportsnavi 球隊識別不符');
 const [wins,losses,ip,hits,bb,hbp,k,allowed,er]=anchor;
 const total={team,path:identity[3],games:143,wins,losses,outs:pitchingOuts(ip),hits,bb,hbp,k,allowed,er,throughDate:null,seasonComplete:true,seasonYear:2026};
 // NF3's individual rows must add up to the independently verified official totals.
 const pit=tableData(pages.pitch).find(t=>['名前','回数','自責','四球','死球','先発'].every(h=>t.rows[0]?.includes(h)));
 if(!pit)throw Error('備援投手欄位變更');
 const [headers,...raw]=pit.rows,players=raw.filter(r=>r.length===headers.length&&integer(r[0])!==null),read=(r,key)=>r[headers.indexOf(key)];
 if(!players.length||new Set(players.map(r=>norm(read(r,'名前')))).size!==players.length)throw Error('備援投手名單重複或缺漏');
 for(const [field,label] of Object.entries({games:'先発',wins:'勝利',losses:'敗戦',hits:'被安',bb:'四球',hbp:'死球',k:'三振',allowed:'失点',er:'自責'})){
  const values=players.map(r=>integer(read(r,label)));if(values.some(n=>n===null)||values.reduce((a,b)=>a+b,0)!==total[field])throw Error('備援投手合計與官方不符：'+label);
 }
 const outs=players.map(r=>pitchingOuts(read(r,'回数')));if(outs.some(n=>n===null)||outs.reduce((a,b)=>a+b,0)!==total.outs)throw Error('備援投球局數與官方不符');
 const teamTotals=tableData(pages.team).flatMap(t=>t.rows).filter(r=>r[0]==='総計'&&r.length===23);
 if(!teamTotals.length||teamTotals.some(r=>JSON.stringify(r)!==JSON.stringify(teamTotals[0])))throw Error('備援團隊各分項總計不一致');
 const tr=teamTotals[0];
 for(const [i,value] of [[1,143],[2,wins],[3,losses],[4,143-wins-losses],[7,allowed],[19,hits],[21,bb+hbp],[22,er]])if(integer(tr[i])!==value)throw Error('備援團隊總計與官方不符');
 if(pitchingOuts(tr[18])!==total.outs||integer(tr[6])===null)throw Error('備援團隊得分或局數缺漏');
 const scoring=tableData(pages.team).flatMap(t=>t.rows).filter(r=>r[0]==='合計'&&r[1]==='得点');
 if(scoring.length!==1||integer(scoring[0].at(-1))!==integer(tr[6])||scoring[0].slice(2,-1).some(v=>integer(v)===null)||scoring[0].slice(2,-1).reduce((n,v)=>n+Number(v),0)!==integer(tr[6]))throw Error('備援逐局得分與團隊合計不符');
 const relief=parseNpbRelief(pages.team,total,date,observedAt,u.team);
 relief.source.name='NF3 本季後援分項（官方季末合計核對）';
 const source={name:'Sportsnavi／NF3 本季投手交叉核對',url:u.yahoo,observedAt,publishedAt:null,throughDate:null,seasonComplete:true,seasonYear:2026};
 const yt=tableData(pages.yahoo).find(t=>t.attrs.includes('js-playerTable'));
 if(!yt)throw Error('Sportsnavi 投手表缺漏');
 const yh=yt.rows[0].map(norm),yr=yt.rows.slice(1).filter(r=>r.length===yh.length&&integer(r[0])!==null);
 const labels={innings:'回数',era:'防御率',hits:'被安',walks:'四球',earnedRuns:'自責',wins:'勝利',losses:'敗戦',strikeouts:'三振'};
 const yahooLabels={innings:'投球回',era:'防御率',hits:'被安打',walks:'与四球',earnedRuns:'自責点',wins:'勝利',losses:'敗戦',strikeouts:'奪三振',whip:'WHIP'};
 const rows=players.flatMap(r=>{
  const name=read(r,'名前'),stats=pitcherStats(r,headers,labels),matches=yr.filter(y=>norm(y[yh.indexOf('選手名')])===norm(name));
  if(!stats||matches.length!==1)return [];
  const other=pitcherStats(matches[0],yh,yahooLabels);if(!other||Object.keys(stats).some(key=>stats[key]!==other[key]))return [];
  return [{team,name,stats,source,notes:['本季 ERA、局數、安打、四球、自責分與 WHIP 已交叉核對；團隊合計另與 NPB 官方季末紀錄核對。']}];
 });
 if(!rows.length)throw Error('備援投手沒有通過交叉核對');
 const teamSource={...source,name:'NF3 本季團隊攻守（官方季末投手合計核對）',url:u.team};
 return {rows,bullpens:[relief],teamRuns:[{...total,scored:integer(tr[6]),source:teamSource}]};
}
export function createNpbSeasonBackup({fetcher=fetch,now=Date.now}={}){
 const cache=new Map(),pending=new Map();
 return async(date,teams)=>{
  /** @type {ReturnType<typeof parseNpbSeasonBackup> & {errors:string[]}} */
  const empty={rows:[],bullpens:[],teamRuns:[],errors:[]};
  if(date.slice(0,4)!==String(finalTotals.season)||!npbUpcomingDate(date,new Date(now()).toISOString()))return empty;
  const selected=Object.keys(TEAMS).filter(code=>teams.includes(TEAMS[code][0]));
  /** @type {ReturnType<typeof parseNpbSeasonBackup> & {errors:string[]}} */
  const result={...empty,rows:[],bullpens:[],teamRuns:[],errors:[]};
  const deadline=AbortSignal.timeout(30000);
  for(let i=0;i<selected.length;i+=2)await Promise.all(selected.slice(i,i+2).map(async code=>{
   const key=code+date,old=cache.get(key);let value=old?.until>now()?old.value:null;
   if(!value){
    if(!pending.has(key))pending.set(key,(async()=>{try{
     const pages=Object.fromEntries(await Promise.all(Object.entries(urls(code)).map(async([kind,url])=>{
      const response=await fetcher(url,{redirect:'manual',cache:'no-store',headers:{'User-Agent':'YJBaseballStats/1.0',Accept:'text/html'},signal:AbortSignal.any([deadline,AbortSignal.timeout(15000)])});
      if(!response.ok){await response.body?.cancel();throw Error('HTTP '+response.status);}
      const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.byteLength;if(size>4000000)throw Error('來源超出上限');chunks.push(chunk);}
      const html=Buffer.concat(chunks).toString('utf8');if(/challenge-platform|<title>Just a moment/i.test(html))throw Error('來源要求瀏覽器驗證');return [kind,html];
     })));
     return {...parseNpbSeasonBackup(code,pages,date,new Date(now()).toISOString()),errors:[]};
    }catch(e){return {...empty,errors:[TEAMS[code][0]+' 備援：'+e.message]};}})().then(value=>{if(cache.size>24)cache.clear();cache.set(key,{value,until:now()+(value.errors.length?60000:900000)});return value;}).finally(()=>pending.delete(key)));
    value=await pending.get(key);
   }
   for(const field of Object.keys(result))result[field].push(...value[field]);
  }));return result;
 };
}
export const collectNpbSeasonBackup=createNpbSeasonBackup();
