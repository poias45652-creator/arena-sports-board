import {plain,tableData,dayInTaipei} from './baseball-live-providers.mjs';
import {createKboSeasonPages} from './kbo-season-pages.mjs';
const NPB={g:['讀賣巨人','読売ジャイアンツ'],t:['阪神虎','阪神タイガース'],db:['橫濱 DeNA 海灣之星','横浜DeNAベイスターズ'],d:['中日龍','中日ドラゴンズ'],c:['廣島東洋鯉魚','広島東洋カープ'],s:['東京養樂多燕子','東京ヤクルトスワローズ'],h:['福岡軟銀鷹','福岡ソフトバンクホークス'],f:['北海道日本火腿鬥士','北海道日本ハムファイターズ'],b:['歐力士猛牛','オリックス・バファローズ'],e:['東北樂天金鷲','東北楽天ゴールデンイーグルス'],l:['埼玉西武獅','埼玉西武ライオンズ'],m:['千葉羅德海洋','千葉ロッテマリーンズ']};
const KBO={'두산':'斗山熊','한화':'韓華鷹','삼성':'三星獅','롯데':'樂天巨人','키움':'培證英雄',KT:'KT 巫師',SSG:'SSG 登陸者',KIA:'起亞虎',NC:'NC 恐龍',LG:'LG 雙子'};
const integer=v=>/^\d+$/.test(String(v??''))?Number(v):null;
const numeric=v=>/^\d+(?:\.\d+)?$/.test(String(v??''))?Number(v):null;
export function pitchingOuts(v){
 const s=String(v??'').normalize('NFKC').trim(),fraction=s.match(/^(?:(\d+)\s+)?([12])\s*\/\s*3$/);
 if(fraction)return Number(fraction[1]||0)*3+Number(fraction[2]);
 const m=s.replace(/\s/g,'').match(/^(\d+)(?:\.([012]))?$/);return m?Number(m[1])*3+Number(m[2]||0):null;
}
const innings=outs=>`${Math.floor(outs/3)}${outs%3?'.'+outs%3:''}`;
export function pitcherStats(row,headers,labels){
 const value=k=>row[headers.indexOf(labels[k])];
 const outs=pitchingOuts(value('innings')),era=numeric(value('era')),hits=integer(value('hits')),walks=integer(value('walks')),earned=integer(value('earnedRuns'));
 if(outs===null||outs<=0||era===null||hits===null||walks===null||earned===null||Math.abs(earned*27/outs-era)>.025)return null;
 const reported=labels.whip?numeric(value('whip')):null,whip=(hits+walks)*3/outs;
 if(reported!==null&&Math.abs(reported-whip)>.025)return null;
 const stats={era:era.toFixed(2),whip:(reported??whip).toFixed(2),innings:innings(outs),walks:String(walks),wins:'',losses:'',strikeouts:'',opponentAverage:''};
 for(const k of ['wins','losses','strikeouts']){const n=integer(value(k));if(n!==null)stats[k]=String(n);}
 return stats;
}
function pageSource(name,url,observedAt,throughDate=null){return {name,url,observedAt,publishedAt:null,throughDate};}
export function parseNpbSeasonPitching(html,code,date,observedAt,url){
 const identity=NPB[code],title=plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
 if(!identity||!title.includes(date.slice(0,4)+'年度')||!title.includes(identity[1])||!title.includes('個人投手成績'))throw Error('日職投手頁年度或球隊不符');
 const stamp=plain(html).match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s*現在/),through=stamp?`${stamp[1]}-${stamp[2].padStart(2,'0')}-${stamp[3].padStart(2,'0')}`:null;
 if(!through||!Number.isFinite(Date.parse(through))||through>=date||Number(date.slice(0,4))!==Number(through.slice(0,4))||Date.parse(date)-Date.parse(through)>4*86400000)throw Error('日職統計截止日未核對、已過期或含當日紀錄');
 const table=tableData(html).find(t=>t.rows[0]?.includes('選手')&&t.rows[0].includes('防御率')&&t.rows[0].includes('自責点'));
 if(!table)throw Error('日職投手表尚未取得');
 const [headers,...rows]=table.rows,source=pageSource('NPB 官方投手紀錄',url,observedAt,through);
 const labels={innings:'投球回',era:'防御率',hits:'安打',walks:'四球',earnedRuns:'自責点',wins:'勝利',losses:'敗北',strikeouts:'三振'};
 return rows.flatMap(raw=>{const row=raw.length===headers.length+1&&/^[*＊]?$/.test(raw[0])?raw.slice(1):raw;if(row.length!==headers.length)return [];const name=(row[headers.indexOf('選手')]||'').replace(/^[*＊]\s*/,''),stats=pitcherStats(row,headers,labels);return name&&stats?[{team:identity[0],name,stats,source,notes:['WHIP 由官方被安打、四球與投球出局數重算；未把觸身球加入。']}]:[];});
}
function selectedOption(html,suffix){
 for(const m of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)){
  if(!new RegExp(`(?:name|id)=["'][^"']*${suffix}["']`,'i').test(m[1]))continue;
  const options=[...m[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)];
  const selected=options.find(x=>/\bselected(?:\s|=|$)/i.test(x[1]))||options[0];return selected?plain(selected[2]):null;
 }return null;
}
export function parseKboSeasonPitching(html,date,observedAt,url){
 if(selectedOption(html,'ddlSeason')!==date.slice(0,4)||!/정규/.test(selectedOption(html,'ddlSeries')||''))throw Error('韓職投手表球季或例行賽篩選尚未核對');
 const table=tableData(html).find(t=>['선수명','팀명','ERA','IP','H','BB','ER','WHIP'].every(h=>t.rows[0]?.includes(h)));
 if(!table)throw Error('韓職投手表尚未取得');
 const [headers,...rows]=table.rows,source=pageSource('KBO 官方投手紀錄',url,observedAt);
 const labels={innings:'IP',era:'ERA',hits:'H',walks:'BB',earnedRuns:'ER',wins:'W',losses:'L',strikeouts:'SO',whip:'WHIP'};
 return rows.flatMap(row=>{if(row.length!==headers.length)return [];const team=KBO[row[headers.indexOf('팀명')]],name=row[headers.indexOf('선수명')],stats=pitcherStats(row,headers,labels);return team&&name&&stats?[{team,name,stats,source,notes:['僅補入官方本頁實際列出的投手；未把未列出者當成零。']}]:[];});
}
export function createSeasonPitchingCollector({fetcher=fetch,now=Date.now}={}){
 const cache=new Map(),pending=new Map();
 const kboPages=createKboSeasonPages({fetcher,now,parse:parseKboSeasonPitching});
 async function read(url,parse,deadline){
  const old=cache.get(url);if(old&&old.until>now())return old.value;if(pending.has(url))return pending.get(url);
  const task=(async()=>{try{
   const response=await fetcher(url,{redirect:'manual',cache:'no-store',headers:{'User-Agent':'YJBaseballStats/1.0',Accept:'text/html'},signal:AbortSignal.any([deadline,AbortSignal.timeout(9000)])});
   if(!response.ok){await response.body?.cancel();throw Error(`HTTP ${response.status}`);}
   let size=0;const chunks=[];for await(const part of response.body){size+=part.byteLength;if(size>4_000_000)throw Error('來源內容超出上限');chunks.push(part);}
   const html=Buffer.concat(chunks).toString('utf8');if(/challenge-platform|<title>Just a moment/i.test(html))throw Error('來源要求瀏覽器驗證');
   const observedAt=new Date(now()).toISOString(),rows=parse(html,observedAt);if(!rows.length)throw Error('沒有通過欄位核對的投手成績');
   const value={rows,error:null,url,observedAt};if(cache.size>=32)cache.delete(cache.keys().next().value);cache.set(url,{value,until:now()+900000});return value;
  }catch(e){const value={rows:[],error:`${new URL(url).hostname}: ${e.name==='TimeoutError'||e.name==='AbortError'?'讀取逾時':e.message}`,url,observedAt:null};cache.set(url,{value,until:now()+60000});return value;}})().finally(()=>pending.delete(url));
  pending.set(url,task);return task;
 }
 return async function collect(league,date,teams=[]){
  if(!['NPB','KBO'].includes(league)||date!==dayInTaipei(new Date(now())))return {rows:[],sources:[],errors:[],scope:'僅補入當日賽前成績，不回填歷史預測'};
  if(league==='KBO')return kboPages(date,teams);
  const deadline=AbortSignal.timeout(9000);
  const jobs=league==='NPB'?Object.entries(NPB).filter(([,v])=>teams.includes(v[0])).map(([code])=>{const url=`https://npb.jp/bis/${date.slice(0,4)}/stats/idp1_${code}.html`;return ()=>read(url,(html,at)=>parseNpbSeasonPitching(html,code,date,at,url),deadline);}):[()=>{const url='https://www.koreabaseball.com/Record/Player/PitcherBasic/Basic1.aspx';return read(url,(html,at)=>parseKboSeasonPitching(html,date,at,url),deadline);}];
  const results=[];for(let i=0;i<jobs.length;i+=4)results.push(...await Promise.all(jobs.slice(i,i+4).map(job=>job())));
  return {rows:results.flatMap(r=>r.rows),sources:results.map(r=>({url:r.url,observedAt:r.observedAt,rows:r.rows.length,error:r.error})),errors:results.flatMap(r=>r.error?[r.error]:[]),scope:'公開投手成績備援；牛棚未以全隊投手總數冒充'};
 };
}
export const collectSeasonPitching=createSeasonPitchingCollector();
