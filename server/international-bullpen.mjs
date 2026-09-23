import {plain,tableData,dayInTaipei,fetchPublic,parseKbo} from './baseball-live-providers.mjs';
import {pitchingOuts} from './baseball-season-pitching.mjs';
const NPB={巨人:['讀賣巨人','Central/G'],阪神:['阪神虎','Central/T'],DeNA:['橫濱 DeNA 海灣之星','Central/DB'],中日:['中日龍','Central/D'],広島:['廣島東洋鯉魚','Central/C'],ヤクルト:['東京養樂多燕子','Central/S'],ソフトバンク:['福岡軟銀鷹','Pacific/H'],日本ハム:['北海道日本火腿鬥士','Pacific/F'],オリックス:['歐力士猛牛','Pacific/B'],楽天:['東北樂天金鷲','Pacific/E'],西武:['埼玉西武獅','Pacific/L'],ロッテ:['千葉羅德海洋','Pacific/M']};
const KBO={HT:'起亞虎',OB:'斗山熊',HH:'韓華鷹',LT:'樂天巨人',NC:'NC 恐龍',KT:'KT 巫師',LG:'LG 雙子',SS:'三星獅',SK:'SSG 登陸者',WO:'培證英雄'};
const n=s=>/^\d+$/.test(String(s??''))?Number(s):null;
const ip=o=>`${Math.floor(o/3)}${o%3?'.'+o%3:''}`;
const stats=(o,er,k,w='',l='',bb='',h=null)=>({era:(er*27/o).toFixed(2),innings:ip(o),strikeouts:String(k),wins:String(w),losses:String(l),walks:String(bb),whip:h===null?'':((h+Number(bb))*3/o).toFixed(2),opponentAverage:''});
const shift=(date,days)=>new Date(Date.parse(date+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
export function parseNpbTeamTotals(html,date,kind){
 const title=plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
 if(!title.includes(date.slice(0,4)+'年度')||!title.includes(kind==='pitching'?'チーム投手成績':'チーム打撃成績'))throw Error('NPB 團隊表年度或類別不符');
 const stamp=plain(html).match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s*現在/),throughDate=stamp?`${stamp[1]}-${stamp[2].padStart(2,'0')}-${stamp[3].padStart(2,'0')}`:'';
 if(!throughDate||throughDate>=date||shift(date,-4)>throughDate||throughDate.slice(0,4)!==date.slice(0,4))throw Error('NPB 團隊表截止日不符');
 const required=kind==='pitching'?['チーム','試合','勝利','敗北','投球回','自責点','失点','安打','三振','四球','死球']:['チーム','試合','得点'];
 const t=tableData(html).find(t=>required.every(h=>t.rows[0]?.includes(h)));if(!t)throw Error('NPB 團隊表欄位變更');
 const [h,...rows]=t.rows;
 return rows.flatMap(r=>{const key=r[h.indexOf('チーム')]?.normalize('NFKC'),identity=NPB[key];if(!identity)return [];const get=k=>n(r[h.indexOf(k)]),games=get('試合');if(games===null||games<20)throw Error('NPB 團隊場數不足');
  const values=kind==='pitching'?{wins:get('勝利'),losses:get('敗北'),outs:pitchingOuts(r[h.indexOf('投球回')]),er:get('自責点'),allowed:get('失点'),hits:get('安打'),k:get('三振'),bb:get('四球'),hbp:get('死球')}:{scored:get('得点')};
  if(Object.values(values).some(v=>v===null))throw Error('NPB 團隊表缺值');return [{team:identity[0],path:identity[1],games,throughDate,...values}];
 });
}
export function parseNpbRelief(html,total,date,observedAt,url){
 const title=plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').normalize('NFKC');
 const short=Object.keys(NPB).find(k=>NPB[k][0]===total.team);if(!short||!title.includes(date.slice(0,4)+'年度版')||!title.includes(short)||!title.includes('チームデータ'))throw Error('NPB 牛棚來源球隊／球季不符');
 const rows=tableData(html).flatMap(t=>t.rows),starters=rows.filter(r=>r[0]==='先発合計'),relievers=rows.filter(r=>r[0]==='救援合計');
 if(starters.length!==1||relievers.length!==1||[starters[0],relievers[0]].some(r=>r.length!==20))throw Error('NPB 先發／後援合計缺漏');
 const a=starters[0],b=relievers[0],ao=pitchingOuts(a[11]),bo=pitchingOuts(b[11]);
 if(ao===null||bo===null||bo<=0||n(a[2])!==total.games||ao+bo!==total.outs)throw Error('NPB 牛棚局數／場數與官方不符');
 for(const [i,key] of [[12,'hits'],[14,'k'],[16,'allowed'],[17,'er']])if(n(a[i])===null||n(b[i])===null||n(a[i])+n(b[i])!==total[key])throw Error('NPB 牛棚合計與官方不符：'+key);
 if(n(a[15])===null||n(b[15])===null||n(a[15])+n(b[15])!==total.bb+total.hbp)throw Error('NPB 四死球合計與官方不符');
 for(const [r,o] of [[a,ao],[b,bo]])if(!/^\d+(\.\d+)?$/.test(r[1])||Math.abs(Number(r[1])-Number(r[17])*27/o)>.025)throw Error('NPB 分項 ERA 不符');
 return {team:total.team,stats:stats(bo,n(b[17]),n(b[14]),n(b[3]),n(b[4])),source:{name:'NF3 本季後援分項（NPB 官方合計核對）',url,observedAt,throughDate:total.throughDate,scope:'season',games:total.games,note:'先發＋後援的場數、局數、責失、安打、三振、失分與四死球皆與官方核對。來源只有四死球合計，未冒充四壞或 WHIP。'}};
}
export function kboReliefGame(raw,relay,page,date){
 const g=parseKbo(raw,page,relay);if(g.status!=='final'||g.date>=date||g.date.slice(0,4)!==date.slice(0,4))throw Error('僅接受當日以前的韓職完賽紀錄');
 const teams=[];
 for(const side of ['away','home']){
  const other=side==='away'?'home':'away',listed=relay?.[side+'Lineup']?.pitcher||[],rows=g.pitching[side];
  if(!listed.length||listed.length!==rows.length||new Set(listed.map(p=>String(p.pcode))).size!==listed.length||listed.filter(p=>Number(p.seqno)===1).length!==1)throw Error('韓職先發登板序位未核對');
  const first=listed.find(p=>Number(p.seqno)===1);if(raw[side+'StarterName']!==first.name)throw Error('韓職先發名與逐場紀錄不符');
  if(rows.some((p,i)=>!Number.isInteger(Number(listed[i].seqno))||Number(listed[i].seqno)<1||p.outsRecorded===null||p.outsRecorded<0||['HITS_ALLOWED','EARNED_RUNS','RUNS_ALLOWED','WALKS_ALLOWED','STRIKEOUTS_THROWN'].some(k=>!Number.isInteger(p.stats[k])||p.stats[k]<0)||p.stats.EARNED_RUNS>p.stats.RUNS_ALLOWED))throw Error('韓職逐場投手欄位缺漏');
  const all=(key)=>rows.reduce((s,p)=>s+p.stats[key],0),outs=rows.reduce((s,p)=>s+p.outsRecorded,0);
  if(outs<15||outs>36||all('RUNS_ALLOWED')!==g[other].score||(g[other].hits!==null&&all('HITS_ALLOWED')!==g[other].hits))throw Error('韓職逐場投手與終場比分不符');
  const relief=rows.filter((p,i)=>Number(listed[i].seqno)>1),sum=k=>relief.reduce((s,p)=>s+p.stats[k],0);
  teams.push({team:KBO[raw[side+'TeamCode']],outs:relief.reduce((s,p)=>s+p.outsRecorded,0),er:sum('EARNED_RUNS'),hits:sum('HITS_ALLOWED'),bb:sum('WALKS_ALLOWED'),k:sum('STRIKEOUTS_THROWN')});
 }
 return {id:g.id,date:g.date,teams,url:page.url,observedAt:page.fetchedAt};
}
export function createBullpenCollector({fetcher=fetch,now=Date.now}={}){
 const cache=new Map(),pending=new Map(),gameCache=new Map();
 return async function collect(league,date,teams=[]){
  const empty={rows:[],teamRuns:[],sources:[],errors:[]};if(!['NPB','KBO'].includes(league)||date!==dayInTaipei(new Date(now()))||!teams.length)return empty;
  const key=league+date+[...new Set(teams)].sort().join('|'),old=cache.get(key);if(old?.until>now())return old.value;if(pending.has(key))return pending.get(key);
  const task=(async()=>{const result={...empty,rows:[],teamRuns:[],sources:[],errors:[]},deadline=AbortSignal.timeout(35000);
   const get=async url=>{
    const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||!['npb.jp','nf3.sakura.ne.jp','api-gw.sports.naver.com'].includes(u.hostname))throw Error('不支援的公開來源');
    if(u.hostname==='api-gw.sports.naver.com')return fetchPublic(url,(u,init)=>fetcher(u,{...init,signal:AbortSignal.any([init.signal,deadline])}));
    const r=await fetcher(url,{redirect:'manual',cache:'no-store',headers:{'User-Agent':'YJBaseballStats/1.0',Accept:'text/html'},signal:AbortSignal.any([deadline,AbortSignal.timeout(9000)])});if(!r.ok){await r.body?.cancel();throw Error('HTTP '+r.status);}
    const chunks=[];let bytes=0;for await(const chunk of r.body){bytes+=chunk.byteLength;if(bytes>4_000_000)throw Error('來源內容超出上限');chunks.push(chunk);}const buffer=Buffer.concat(chunks),encoding=((r.headers.get('content-type')||'')+' '+buffer.subarray(0,1500).toString('ascii')).match(/charset\s*=\s*["']?([\w-]+)/i)?.[1]||'utf-8',text=new TextDecoder(encoding).decode(buffer);
    if(/challenge-platform|<title>Just a moment/i.test(text))throw Error('來源要求瀏覽器驗證');return {url,text,fetchedAt:new Date(now()).toISOString()};
   };
   // All requests remain public and stop on access denials. Never retry challenges.
   if(league==='NPB'){
    const official=[];
    for(const division of ['c','p'])try{const [p,b]=await Promise.all(['tmp','tmb'].map(k=>get(`https://npb.jp/bis/${date.slice(0,4)}/stats/${k}_${division}.html`))),pit=parseNpbTeamTotals(p.text,date,'pitching'),bat=parseNpbTeamTotals(b.text,date,'batting');
     for(const t of pit){const offense=bat.find(r=>r.team===t.team);if(!offense||offense.games!==t.games||offense.throughDate!==t.throughDate)throw Error('NPB 攻守表截止日不一致');const row={...t,scored:offense.scored,source:{name:'NPB 官方團隊攻守成績',url:p.url,observedAt:p.fetchedAt,throughDate:t.throughDate}};official.push(row);if(teams.includes(t.team))result.teamRuns.push(row);}
    }catch(e){result.errors.push('NPB '+division+'：'+e.message);}
    const selected=official.filter(t=>teams.includes(t.team));for(let i=0;i<selected.length;i+=4)await Promise.all(selected.slice(i,i+4).map(async t=>{const url=`https://nf3.sakura.ne.jp/${t.path}/t/teamdata.htm`;try{const p=await get(url);result.rows.push(parseNpbRelief(p.text,t,date,p.fetchedAt,url));}catch(e){result.errors.push(t.team+'：'+e.message);}}));
   }else{
    const rawGames=new Map();let scheduleOk=true;const root='https://api-gw.sports.naver.com';
    // This public schedule endpoint returns a single day even for a date range.
    // Query each dated page, then select each team's actual latest ten finals.
    const dates=Array.from({length:28},(_,i)=>shift(date,-i-1));
    for(let offset=0;offset<dates.length;offset+=6)await Promise.all(dates.slice(offset,offset+6).map(async from=>{const to=from,url=root+'/schedule/games?'+new URLSearchParams({upperCategoryId:'kbaseball',fromDate:from,toDate:to,page:'1',pageSize:'100'});try{const p=await get(url),j=JSON.parse(p.text);if(j.success!==true||!Array.isArray(j.result?.games)||j.result.games.length>=100)throw Error('韓職歷史賽程不完整');for(const g of j.result.games)if(g.categoryId==='kbo'&&g.statusCode==='RESULT'&&!g.cancel&&!g.suspended&&g.gameDate>=from&&g.gameDate<=to&&KBO[g.awayTeamCode]&&KBO[g.homeTeamCode])rawGames.set(g.gameId,g);}catch(e){scheduleOk=false;result.errors.push('KBO 日誌賽程：'+e.message);}}));
    if(scheduleOk){const byTeam=new Map(teams.map(team=>[team,[...rawGames.values()].filter(g=>[KBO[g.awayTeamCode],KBO[g.homeTeamCode]].includes(team)).sort((a,b)=>b.gameId.localeCompare(a.gameId)).slice(0,10)])),chosen=new Map([...byTeam.values()].flat().map(g=>[g.gameId,g]));
     const games=[...chosen.values()];for(let i=0;i<games.length;i+=6)await Promise.all(games.slice(i,i+6).map(async g=>{if(gameCache.has(g.gameId)&&now()-Date.parse(gameCache.get(g.gameId).observedAt)<12*3600000)return;try{if(!/^\d{8}[A-Z0-9]{4,20}$/.test(g.gameId))throw Error('場次 ID 不符');const p=await get(root+'/schedule/games/'+g.gameId+'/game-polling'),j=JSON.parse(p.text);if(j.success!==true||j.result?.game?.gameId!==g.gameId)throw Error('韓職日誌場次不符');const row=kboReliefGame(j.result.game,j.result.textRelayData,p,date);if(gameCache.size>350)gameCache.delete(gameCache.keys().next().value);gameCache.set(g.gameId,row);}catch(e){result.errors.push(g.gameId+'：'+e.message);}}));
     for(const [team,selected] of byTeam){const candidates=selected.map(g=>gameCache.get(g.gameId)),window=[10,5].find(n=>candidates.length>=n&&candidates.slice(0,n).every(g=>g?.teams.some(t=>t.team===team)));if(!window){result.errors.push(team+'：最近 5 場後援日誌尚未完整');continue;}const logs=candidates.slice(0,window);const rows=logs.map(g=>g.teams.find(t=>t.team===team));if(rows.some(r=>!r))continue;const sum=k=>rows.reduce((s,r)=>s+r[k],0),outs=sum('outs');if(outs<=0)continue;
      const source={name:'Naver 韓職逐場後援紀錄彙算',url:logs[0].url,observedAt:logs.map(g=>g.observedAt).sort()[0],throughDate:logs[0].date,scope:'recent',games:logs.length,note:`最近 ${logs.length} 場已完賽紀錄，排除先發；先合計出局數與責失再算 ERA。`,gameIds:logs.map(g=>g.id)};result.rows.push({team,stats:stats(outs,sum('er'),sum('k'),'','',sum('bb'),sum('hits')),source});
     }
    }
   }
   result.sources=result.rows.map(r=>r.source);return result;
  })().catch(e=>({...empty,errors:[league+' 牛棚來源：'+e.message]})).then(value=>{if(cache.size>12)cache.clear();cache.set(key,{value,until:now()+(value.errors.length?60000:900000)});return value;}).finally(()=>pending.delete(key));pending.set(key,task);return task;
 };
}
export const collectBullpens=createBullpenCollector();
