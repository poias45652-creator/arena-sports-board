import {plain,type SourceTable} from './international';
import type {PregameData,PregameGame,PregameSide,PregamePitchingStats} from './international-pregame';

const alliances:Record<string,string>={NPB:'2',KBO:'9',CPBL:'6'};
// Source identifiers are league-specific: Rakuten and Lions are not global aliases.
const teams:Record<string,Record<string,[string,string,string]>>={
 NPB:{Swallows:['s','東京養樂多燕子','養樂多'],Giants:['g','讀賣巨人','巨人'],Orix:['b','歐力士猛牛','歐力士'],Fighters:['f','北海道日本火腿鬥士','火腿'],Hawks:['h','福岡軟銀鷹','軟銀'],Rakuten:['e','東北樂天金鷲','樂天'],Carp:['c','廣島東洋鯉魚','廣島'],Dragons:['d','中日龍','中日'],DeNA:['db','橫濱 DeNA 海灣之星','橫濱'],Tigers:['t','阪神虎','阪神'],Lions:['l','埼玉西武獅','西武'],Marines:['m','千葉羅德海洋','羅德']},
 KBO:{NC:['NC','NC 恐龍','恐龍'],SAMSUNG:['SS','三星獅','三星獅'],KT:['KT','KT 巫師','巫師'],SSG:['SK','SSG 登陸者','登陸者'],LOTTE:['LT','樂天巨人','樂天'],HANWHA:['HH','韓華鷹','華老鷹'],DOOSAN:['OB','斗山熊','斗山熊'],NEXEN:['WO','培證英雄','培證'],LG:['LG','LG 雙子','雙子'],KIA:['HT','起亞虎','起亞虎']},
 CPBL:{DRAGONS:['AAA','味全龍','味全'],BRO:['ACN','中信兄弟','兄弟'],FUBON:['AEO','富邦悍將','富邦'],UNI:['ADD','統一獅','統一'],'13342':['AKP','台鋼雄鷹','台鋼'],RAKUTEN:['AJL','樂天桃猿','樂天']},
};
const fields=['wins','losses','era','opponentAverage','innings','strikeouts','walks','whip'] as const;
const emptyTable=(title:string):SourceTable=>({title,headers:[],rows:[]});
const outs=(s:string)=>{const m=s.match(/^(\d+)(?:\.([012]))?$/);return m?Number(m[1])*3+Number(m[2]||0):null};
const sourceURL=(raw:string)=>{const u=new URL(raw,'https://www.playsport.cc');if(u.origin!=='https://www.playsport.cc'||u.pathname!=='/gamesData/battle')throw Error('賽前網址不符');return u};
export function playsportFixture(raw:string,league:string,date:string){
 const u=sourceURL(raw),id=u.searchParams.get('gameid')||'',oid=u.searchParams.get('officialId')||'';
 const m=oid.match(/^(NPB|KBO|CPBL)_(\d{8})_([A-Za-z0-9]+)@([A-Za-z0-9]+)_(\d{2})(\d{2})$/);
 if(!m||m[1]!==league||m[2]!==date.replaceAll('-','')||u.searchParams.get('allianceid')!==alliances[league]||!id.startsWith(m[2])||!/^\d{11,16}$/.test(id)||Number(m[5])>23||Number(m[6])>59)throw Error('賽前日期或聯盟不符');
 const away=teams[league]?.[m[3]],home=teams[league]?.[m[4]];if(!away||!home||away[0]===home[0])throw Error('賽前球隊無法核對');
 u.hash='';return {id,oid,url:u.href,league,date,start:`${date} ${m[5]}:${m[6]}:00`,away,home};
}
export function playsportLinks(html:string,league:string,date:string){
 const found=new Map<string,string>();
 for(const m of html.matchAll(/\bhref\s*=\s*["']([^"']+)["']/gi))try{const f=playsportFixture(plain(m[1]),league,date);found.set(f.oid,f.url)}catch{}
 return [...found.values()].slice(0,12);
}
// Supports source HTML and saved, normalized captures without executing scripts.
export function playsportTables(html:string):string[][][]{
 const all:{rows:string[][];cell:boolean}[]=[],stack:typeof all=[];
 for(const m of html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').matchAll(/<\/?(?:table|tr|row|td|th|cell)\b[^>]*>|[^<]+|<[^>]*>/gi)){
  const token=m[0],tag=token.match(/^<(\/)?(table|tr|row|td|th|cell)\b/i),name=tag?.[2].toLowerCase();
  if(name==='table'){if(tag![1])stack.pop();else{const table={rows:[],cell:false};all.push(table);stack.push(table)}continue}
  const t=stack.at(-1);if(!t)continue;
  if(tag){if(tag[1])t.cell=false;else if(name==='tr'||name==='row'){t.rows.push([]);t.cell=false}else if(t.rows.length){t.rows.at(-1)!.push('');t.cell=true}}
  else if(t.cell&&!token.startsWith('<')){const row=t.rows.at(-1)!;row[row.length-1]+=token}
 }
 return all.map(t=>t.rows.map(r=>r.map(plain)).filter(r=>r.some(Boolean)));
}
export function parsePlaysportPregame(html:string,url:string,league:string,date:string,observedAt:string,capturedTitle?:string):PregameGame|null{
 const f=playsportFixture(url,league,date),captured=Date.parse(observedAt),start=Date.parse(f.start.replace(' ','T')+'+08:00');
 if(!Number.isFinite(captured)||!Number.isFinite(start)||captured>=start)return null;
 if(/cf-chl-|challenge-platform|<title>Just a moment/i.test(html))throw Error('賽前來源要求驗證');
 const title=capturedTitle||plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
 const dm=title.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/),match=title.match(/(?:日本職棒|韓國職棒|中華職棒)\s+(.+?)\s+vs\.\s+(.+?)\s+對戰資訊/);
 if(!dm||`${dm[1]}-${dm[2].padStart(2,'0')}-${dm[3].padStart(2,'0')}`!==date||!match||match[1]!==f.away[2]||match[2]!==f.home[2])throw Error('賽前頁標題與場次不符');
 const ts=playsportTables(html),source={name:'玩運彩',url:f.url,observedAt,publishedAt:null,sourceTitle:title,contentSha256:''};
 const pit=ts.map((rows,i)=>({rows,i})).filter(t=>t.rows[0]?.includes('防禦率')&&t.rows[0]?.some(h=>h.toLowerCase()==='whip'));
 const bats=ts.filter(t=>t[0]?.[0]==='團隊打擊(排名)');
 const side=(identity:[string,string,string],index:number):PregameSide=>{
  const starter:PregameSide['starter']={name:'',throws:null,season:Object.fromEntries(fields.map(k=>[k,''])) as PregamePitchingStats,splits:emptyTable('投手分項成績'),recent:emptyTable('逐場出賽紀錄'),quality:'unavailable',warnings:[]};
  let bullpen:PregamePitchingStats|null=null;
  // Identify by heading, never attach another team's pitcher by row position.
  const candidates=pit.filter(t=>ts[t.i-1]?.[0]?.[0]===identity[2]||ts[t.i-1]?.[0]?.[0]?.startsWith(identity[2]+' '));
  if(candidates.length===1){const {rows,i}=candidates[0],heading=ts[i-1][0][0],name=heading.slice(identity[2].length).trim();
   const stats=(label:string)=>{const r=rows.find(r=>r[0]===label);return r?.length===9?Object.fromEntries(fields.map((k,j)=>[k,r[j+1]])) as PregamePitchingStats:null};
   bullpen=stats('球隊牛棚');const season=stats('本季');
   if(name&&!/尚未|未定|未公布|待定/.test(name)){starter.name=name;starter.source=source;if(season){starter.season=season;starter.quality='source_reported';starter.splits={title:'投手分項成績',headers:['分類',...rows[0].filter(Boolean)],rows:rows.slice(1).filter(r=>r.length===9&&r[0]!=='球隊牛棚')};}
    const recent=ts[i+1];if(recent?.[0]?.[0]==='日期'){
     const rr=recent.slice(1).map(r=>{r=[...r];if(r.length===11&&/^\d+$/.test(r[3]))r.splice(3,0,'');if(/^\d{2}\/\d{2}$/.test(r[0]))r[0]=date.slice(0,4)+'-'+r[0].replace('/','-');return r});
     if(rr.every(r=>r.length===12&&/^\d{4}-\d{2}-\d{2}$/.test(r[0])&&r[0]<date&&outs(r[5])!==null)){
      starter.recent={title:'逐場出賽紀錄',headers:recent[0],rows:rr};
      if(season&&outs(season.innings)!==null&&rr.reduce((n,r)=>n+outs(r[5])!,0)>outs(season.innings)!){starter.quality='needs_review';starter.warnings.push('本季局數少於逐場紀錄合計，等待核對。')}
     }else starter.warnings.push('逐場日期或欄位不符，未匯入近況。');
    }
   }
  }
  const bat=bats[index];return {team:identity[1],teamCode:identity[0],sourceTeam:identity[2],starter,bullpen,batting:bat?{title:'團隊打擊',headers:bat[0],rows:bat.slice(1).filter(r=>r.length===bat[0].length)}:emptyTable('團隊打擊')};
 };
 const game:PregameGame={id:f.id,league,date,start:f.start,kind:'pregame_snapshot',liveVerified:false,source,away:side(f.away,0),home:side(f.home,1)};
 const comparison=ts.find(t=>t[0]?.includes('客場得/失分'));
 if(comparison){let category='',sideIndex=0;const rows:string[][]=[];
  for(const raw of comparison.slice(1)){const r=[...raw];if(['對戰','本季','近十場'].includes(r[0])){category=r.shift()!;sideIndex=0}
   // Team logos/empty placeholders may occupy the source's team column.
   if(r.length===7&&(!r[0]||r[0]===f.away[2]||r[0]===f.home[2]))r.shift();
   if(!category)continue;if(r.length!==6||sideIndex>1)throw Error('戰績欄位未能核對');
   const t=sideIndex++===0?game.away:game.home;rows.push([category,t.team,...r]);if(category==='本季')t.record=r[0];
  }
  game.comparison={title:'球隊戰績與得失分',headers:['類別','球隊','勝敗','主場勝率','客場勝率','得/失分','主場得/失分','客場得/失分'],rows};
 }
 if(!game.comparison?.rows.length&&!game.away.starter.name&&!game.home.starter.name)throw Error('賽前頁未取得可辨識資料');
 return game;
}

export async function fetchPlaysportPregame(league:string,date:string,fetcher:typeof fetch=fetch){
 const errors:string[]=[],games:PregameGame[]=[];
 const read=async(url:string)=>{const r=await fetcher(url,{redirect:'manual',cache:'no-store',headers:{Accept:'text/html','User-Agent':'ArenaSportsBoard/1.0'},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error(`玩運彩 HTTP ${r.status}`);const html=await r.text();if(html.length>4_000_000)throw Error('賽前頁超出上限');return html};
 try{
  if(!alliances[league])throw Error('不支援的聯盟');
  const index=await read(`https://www.playsport.cc/livescore/${alliances[league]}?gamedate=${date.replaceAll('-','')}&mode=2`),links=playsportLinks(index,league,date);
  if(!links.length)throw Error('來源沒有該日可核對的賽前連結');
  // At most six concurrent requests, with a deadline per page. No date/ID guessing.
  for(let i=0;i<links.length;i+=6)await Promise.all(links.slice(i,i+6).map(async url=>{try{const html=await read(url),g=parsePlaysportPregame(html,url,league,date,new Date().toISOString());if(g)games.push(g)}catch(e){errors.push(e instanceof Error?e.message:'賽前讀取失敗')}}));
 }catch(e){errors.push(e instanceof Error?e.message:'賽前讀取失敗')}
 const snapshot:PregameData={schemaVersion:1,league,season:Number(date.slice(0,4)),date,observedAt:games.map(g=>g.source.observedAt).sort().at(-1)||'',games};
 return {snapshot,errors};
}
