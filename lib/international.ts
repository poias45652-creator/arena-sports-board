import {internationalTeam} from './international-teams';
export type SourceTable={title:string;headers:string[];rows:string[][]};
export function plain(html:string){return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return c>0&&c<=0x10ffff?String.fromCodePoint(c):'';}).replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();}
export function tables(html:string):SourceTable[]{
 return [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)].map(m=>{
  const rows=[...m[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(r=>[...r[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(c=>plain(c[1]))).filter(r=>r.length>2);
  const headers=rows.shift()||[];const nearby=html.slice(Math.max(0,(m.index||0)-500),m.index);const title=plain([...nearby.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)].at(-1)?.[1]||'');return {title,headers,rows:rows.filter(r=>r.join('|')!==headers.join('|'))};
 }).filter(t=>t.rows.length>0);
}
export function yahooObjects(html:string):any[]{
 const chunks:string[]=[];
 for(const m of html.matchAll(/self\.__next_f\.push\((\[.*?\])\)\s*(?:<\/script>|;)/gs)){
  try{const x=JSON.parse(m[1]);if(x[0]===1&&typeof x[1]==='string')chunks.push(x[1]);}catch{}
 }
 const roots=new Map<string,any>();
 for(const line of chunks.join('').split('\n')){const i=line.indexOf(':');if(i<0)continue;try{roots.set(line.slice(0,i),JSON.parse(line.slice(i+1)));}catch{}}
 const resolve=(x:any,depth=0):any=>{
  if(depth>30)return null;
  if(typeof x==='string'&&/^\$[0-9a-f]+:/.test(x)){const [id,...path]=x.slice(1).split(':');let v=roots.get(id);for(const p of path){v=resolve(v,depth+1);v=Array.isArray(v)&&v[0]==='$'&&p==='props'?v[3]:v?.[p];}return resolve(v,depth+1);}
  return x;
 };
 const objects:any[]=[];const seen=new Set<any>();
 function walk(raw:any){const x=resolve(raw);if(!x||typeof x!=='object'||seen.has(x))return;seen.add(x);if(!Array.isArray(x))objects.push(x);for(const v of Object.values(x))walk(v);}
 for(const root of roots.values())walk(root);
 // Resolve only the sports record requested by the parser; never execute page scripts.
 const proxies=new WeakMap<object,any>();
 const wrap=(raw:any):any=>{const x=resolve(raw);if(!x||typeof x!=='object')return x;if(proxies.has(x))return proxies.get(x);const p=new Proxy(x,{get:(target,key)=>wrap(target[key as any])});proxies.set(x,p);return p;};
 return objects.map(wrap);
}
const cpblNames:Record<string,string>={'cpbl.t.1':'中信兄弟','cpbl.t.2':'統一獅','cpbl.t.5':'富邦悍將','cpbl.t.6':'樂天桃猿','cpbl.t.7':'味全龍','cpbl.t.8':'台鋼雄鷹'};
function cpblTime(s:string){const d=new Date(s);if(!Number.isFinite(d.getTime()))throw new Error('中職日期無效');return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);}
function cpblGame(g:any,year:number){
 if(!/^cpbl\.g\.\d{9}$/.test(g.gameId)||!cpblNames[g.homeTeamId]||!cpblNames[g.awayTeamId]||g.homeTeamId===g.awayTeamId||g.seasonPhase!=='REGULAR_SEASON'||!g.startTime?.startsWith(`${year}-`))return null;
 const url=g.alias?.url;if(typeof url!=='string'||!url.startsWith('https://tw.sports.yahoo.com/cpbl/')||!url.endsWith(`${g.gameId.slice(7)}/`))return null;
 const status:Record<string,string>={FINAL:'已完賽',PREGAME:'未開賽',POSTPONED:'延賽',IN_PROGRESS:'進行中',CANCELLED:'取消',SUSPENDED:'暫停'};
 if(!status[g.status])return null;
 const score=['FINAL','IN_PROGRESS','SUSPENDED'].includes(g.status);
 if(score&&(!Number.isInteger(g.awayScore)||!Number.isInteger(g.homeScore)||g.awayScore<0||g.homeScore<0))return null;
 const time=cpblTime(g.startTime),away=cpblNames[g.awayTeamId],home=cpblNames[g.homeTeamId];
 return {id:g.gameId.slice(7),url,date:time.slice(0,10),label:`${time} · ${away}（客） ${score?`${g.awayScore}：${g.homeScore}`:'vs'} ${home}（主） · ${status[g.status]}`};
}

export function parseInternational(html:string,kind:string,year:number){
 if(/cf-chl-|challenge-platform|<title>Just a moment/i.test(html))throw new Error('來源要求瀏覽器驗證，未取得資料');
 if(kind==='npb-preview'){
  const title=plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
  if(!title.startsWith(`${year}年`))throw new Error('日職先發近況球季未能確認');
  const start=html.indexOf('id="async-starter"'),end=html.indexOf('id="async-preview"',start);
  if(start<0||end<0)throw new Error('來源尚未提供預告先發近況');
  const body=html.slice(start,end),pitchers=[...body.matchAll(/<section class="bb-splits__item">([\s\S]*?)<\/section>/g)].map(m=>{
   const team=plain(m[1].match(/<h1>(.*?)<\/h1>/)?.[1]||'');const ts=tables(m[1]);const row=ts.find(t=>t.headers.includes('選手名'))?.rows[0];if(!team||!row?.[2])throw new Error('預告先發姓名缺漏');return {name:`${internationalTeam(team,'NPB')} · ${row[2]}`,tables:ts};
  });
  if(pitchers.length!==2)throw new Error('預告先發兩隊資料不完整');
  const recent=tables(body).filter(t=>t.headers[0]==='最近の成績');
  if(recent.length!==2)throw new Error('兩名先發近期成績未能配對');
  const labels:Record<string,string>={'背番号':'背號','投':'投球慣用手','選手名':'投手','防御率':'防禦率','登板':'出賽','勝利':'勝','敗戦':'敗','最近の成績':'日期／對手','結果':'結果','投球回':'局數','投球数':'用球數','被安打':'被安打','奪三振':'三振','失点':'失分'};
  const output:SourceTable[]=[];
  pitchers.forEach((p,i)=>{for(const t of [...p.tables,recent[i]])output.push({...t,title:`${p.name} · ${t.headers[0]==='最近の成績'?'近期登板':'預告先發'}`,headers:t.headers.map(h=>labels[h.replace(/\s+/g,'')]||h),rows:t.rows.map(r=>r.map(v=>v==='今季'?'本季':v==='対戦'?'對戰':v))});});
  return {games:[],tables:output,scope:`${title}；預告先發可能異動，近況日期依來源，失分不等於責失分`};
 }
 if(kind==='cpbl-schedule'){
  const games=new Map<string,any>();for(const x of yahooObjects(html)){const g=cpblGame(x,year);if(g)games.set(g.id,g);}
  if(!games.size)throw new Error('中職球隊頁未取得本季賽事');
  return {games:[...games.values()].sort((a,b)=>a.label.localeCompare(b.label)),tables:[],scope:`${year} Yahoo 球隊頁例行賽；時間已轉台灣時間，資料以來源更新為準`};
 }
 if(kind==='cpbl-game'){
  const objects=yahooObjects(html),game=objects.find(g=>/^cpbl\.g\.\d{9}$/.test(g.gameId)&&cpblNames[g.homeTeamId]&&cpblNames[g.awayTeamId]&&g.playerStats&&g.season===year&&g.seasonPhase==='REGULAR_SEASON');
  if(!game)throw new Error('單場中職資料或球季未能確認');
  const score=tables(html).find(t=>t.headers.includes('R')&&t.headers.includes('H')&&t.headers.includes('E')&&t.rows.length===2&&t.rows.every(r=>/富邦|台鋼|味全|統一|中信|樂天/.test(r[0])));
  if(!score)throw new Error('本場尚無逐局比分，請稍後更新');
  const output:SourceTable[]=[{...score,title:'逐局比分'}];
  const fields:Record<string,string>={AT_BATS:'打數',RUNS:'得分',HITS:'安打',RBIS:'打點',HOME_RUNS:'全壘打',STOLEN_BASES:'盜壘',WALKS:'保送',STRIKEOUTS:'三振',LEFT_ON_BASE:'殘壘',INNINGS_PITCHED:'局數',HITS_ALLOWED:'被安打',RUNS_ALLOWED:'失分',EARNED_RUNS:'責失',WALKS_ALLOWED:'保送',STRIKEOUTS_THROWN:'三振',PITCHES_THROWN:'用球數',HOME_RUNS_ALLOWED:'被全壘打'};
  for(const side of ['away','home']){
   for(const t of game.playerStats[`${side}Tables`]||[]){
    if(!['batting','pitching'].includes(t.tableId)||!Array.isArray(t.tableStats)||!t.tableStats.length)continue;
    const keys=Object.keys(fields).filter(k=>t.tableStats.some((r:any)=>Array.isArray(r.stats)&&r.stats.some((v:any)=>v.statId===k&&v.value!==null&&v.value!==undefined)));
    if(!keys.length)continue;
    const rows=t.tableStats.map((r:any)=>{if(!/^cpbl\.p\.\d+$/.test(r.player?.playerId)||!r.player?.displayName||!Array.isArray(r.stats))throw new Error('單場球員欄位不完整');return [r.player.displayName,...keys.map(k=>{const value=r.stats.find((v:any)=>v.statId===k)?.value;if(value===null||value===undefined)return '—';if(!/^\d+(?:\.\d+)?$/.test(String(value)))throw new Error('單場球員數值無法辨識');return String(value);})];});
    output.push({title:`${cpblNames[game[`${side}TeamId`]]}（${side==='home'?'主':'客'}） · ${t.tableId==='pitching'?'投手':'打擊'}紀錄`,headers:['球員',...keys.map(k=>fields[k])],rows});
   }
  }
  return {games:[],tables:output,scope:`${cpblTime(game.startTime)} ${cpblNames[game.awayTeamId]}（客）對 ${cpblNames[game.homeTeamId]}（主）；Yahoo 單場紀錄；主客隊分開列示，缺漏數值不補零`};
 }
 if(kind==='cpbl-standings'){
  const title=plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
  if(!new RegExp(`CPBL\\s+${year}\\s+排名`).test(title))throw new Error('中職排名球季未能確認');
  const selected=tables(html).filter(t=>t.headers.join('|')==='排名|ALL|勝|敗|勝率|勝差|和');
  if(selected.length!==1||selected[0].rows.length!==6)throw new Error('中職排名球隊數不完整');
  const names:Record<string,string>={'龍':'味全龍','獅':'統一獅','悍將':'富邦悍將','雄鷹':'台鋼雄鷹','桃猿':'樂天桃猿','兄弟':'中信兄弟'};
  const seen=new Set<string>();
  const rows=selected[0].rows.map((r,i)=>{
   if(r.length!==7||Number(r[0])!==i+1||!names[r[1]]||seen.has(r[1])||[r[2],r[3],r[6]].some(v=>!/^\d+$/.test(v))||! /^(?:0)?\.\d{3}$/.test(r[4])||!/^\d+(?:\.\d+)?$/.test(r[5]))throw new Error('中職排名欄位未能核對');
   seen.add(r[1]);return [r[0],names[r[1]],String(Number(r[2])+Number(r[3])+Number(r[6])),r[2],r[3],r[6],r[4],r[5]];
  });
  return {games:[],tables:[{title:'CPBL 全年戰績 · Yahoo 運動',headers:['排名','球隊','出賽','勝','敗','和','勝率','勝差'],rows}],scope:`${year} Yahoo 運動全年排名；非上下半季排名，勝率依來源原值，來源發布時間未提供`};
 }
 if(kind==='kbo-schedule'){
  const month=html.match(/id="[^"]*lblGameMonth"[^>]*>\s*(\d{4})\.(\d{2})/);
  if(!month||Number(month[1])!==year)throw new Error('韓職賽程月份未能確認');
  let date='',type='';const rows:string[][]=[];
  for(const tr of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){
   const cells=[...tr[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)];
   const field=(name:string)=>plain(cells.find(c=>new RegExp(`(?:title|class)="${name}"`).test(c[1]))?.[2]||'');
   if(field('DATE')){const d=field('DATE').match(/^(\d{2})\.(\d{2})/);if(!d||d[1]!==month[2])throw new Error('韓職賽程日期不符');date=`${year}-${d[1]}-${d[2]}`;}
   if(field('TYPE'))type=field('TYPE');
   const time=field('TIME'),teams=cells.filter(c=>/title="GAME"/.test(c[1])).map(c=>plain(c[2]));
   if(!time||teams.length!==3)continue;
   if(!date||!/^\d{2}:\d{2}$/.test(time)||!/^\d*:\d*$/.test(teams[1]))throw new Error('韓職賽程欄位不完整');
   const tip=new Date(`${date}T${time}:00+09:00`);if(!Number.isFinite(tip.getTime()))throw new Error('韓職時間無效');
   const taiwan=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(tip);
   const note=field('ETC');
   rows.push([taiwan,type==='REGULAR'?'例行賽':type,internationalTeam(teams[0],'KBO'),teams[1]===':'?'—':teams[1],internationalTeam(teams[2],'KBO'),field('LOCATION'),note==='POSTPONED'?'延賽':note==='-'?'':note]);
  }
  if(!rows.length)throw new Error('韓職來源沒有可辨識的賽程，不能判定無賽事');
  return {games:[],tables:[{title:'KBO 本月賽程與比分',headers:['台灣時間','賽別','客隊','比分','主隊','球場','備註'],rows}],scope:`${month[1]}-${month[2]} 官方月賽程；已轉台灣時間，非逐球即時資料`};
 }
 if(kind==='npb-starters'){
  const heading=html.match(/<h4[^>]*>\s*(\d{1,2})月(\d{1,2})日の予告先発投手\s*<\/h4>/);
  if(!heading||!html.includes(`/announcement/${year}/`))throw new Error('日職先發公告日期未能確認');
  const date=`${year}-${heading[1].padStart(2,'0')}-${heading[2].padStart(2,'0')}`;
  const rows:string[][]=[];
  for(const match of html.matchAll(/<div class="unit [^"]+">([\s\S]*?)<div class="info">([\s\S]*?)<\/div>/g)){
   const sides=[...match[1].matchAll(/<div class="team_(left|right)">([\s\S]*?)<\/div>/g)];
   const info=plain(match[2]),time=info.match(/(\d{1,2}:\d{2})/);
   if(sides.length!==2||!time)throw new Error('日職先發對戰欄位不完整');
   const tip=new Date(`${date}T${time[1].padStart(5,'0')}:00+09:00`);
   if(!Number.isFinite(tip.getTime()))throw new Error('日職先發日期無效');
   const tw=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(tip);
   const parsed=sides.map(m=>{const team=m[2].match(/alt="([^"]+)"/)?.[1],name=plain(m[2].match(/<span>([\s\S]*?)<\/span>/)?.[1]||'');if(!team||!name)throw new Error('先發姓名或球隊缺漏');return [internationalTeam(team,'NPB'),name];});
   rows.push([tw,...parsed[0],...parsed[1],info.replace(time[1],'').trim()]);
  }
  if(!rows.length)throw new Error('目前尚無可辨識的預告先發');
  return {games:[],tables:[{title:'NPB 官方預告先發',headers:['台灣時間','主隊','主隊先發','客隊','客隊先發','球場'],rows}],scope:`${date} 官方預告先發；可能異動，以公告日期為準`};
 }
 if(kind==='npb-roster'){
  const heading=html.match(/<h4[^>]*>(\d{4})年(\d{1,2})月(\d{1,2})日の出場選手登録、登録抹消<\/h4>/);
  if(!heading||Number(heading[1])!==year)throw new Error('日職登錄異動日期未能確認');
  const date=`${year}-${heading[2].padStart(2,'0')}-${heading[3].padStart(2,'0')}`,rows:string[][]=[];
  const body=html.slice(heading.index!);
  for(const part of body.matchAll(/<h5>(出場選手登録(?:抹消)?)<\/h5>[\s\S]*?<table>([\s\S]*?)<\/table>/g)){
   for(const tr of part[2].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)){
    const cells=[...tr[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c=>plain(c[1]));
    if(cells.length===1&&cells[0]==='なし')continue;
    if(cells.length!==4||!cells[0]||!cells[3])throw new Error('登錄異動欄位缺漏');
    rows.push([date,internationalTeam(cells[0],'NPB'),cells[3],cells[1],cells[2],part[1].includes('抹消')?'取消登錄':'登錄']);
   }
  }
  if(!rows.length)throw new Error('目前沒有可辨識的登錄異動');
  return {games:[],tables:[{title:'NPB 登錄異動',headers:['公告日期','球隊','球員','守位','背號','異動'],rows}],scope:`${date} 官方登錄異動；取消登錄不等於受傷，也不代表當日先發打線`};
 }
 if(kind==='npb-standings'||kind==='kbo-standings'){
  const npb=kind.startsWith('npb'),league=npb?'NPB':'KBO';
  if(!new RegExp(npb?`${year}/\\d{1,2}/\\d{1,2}`:`${year}년`).test(plain(html)))throw new Error('排名球季未能確認');
  const selected=tables(html).filter(t=>t.headers.includes(npb?'勝利':'승')&&t.headers.includes(npb?'チーム名':'팀명')).slice(0,npb?2:1);
  if(selected.length!==(npb?2:1)||selected.some(t=>t.rows.length!==(npb?6:10)))throw new Error('排名球隊數不完整');
  const labels:Record<string,string>={'順位':'排名','チーム名':'球隊','試合':'出賽','勝利':'勝','敗戦':'敗','引分':'和','勝率':'勝率','勝差':'與前一名勝差／魔術數字','残試合':'剩餘賽事','得点':'得分','失点':'失分','本塁打':'全壘打','盗塁':'盜壘','打率':'打擊率','防御率':'防禦率','失策':'失誤','순위':'排名','팀명':'球隊','경기':'出賽','승':'勝','패':'敗','무':'和','승률':'勝率','게임차':'勝差','최근10경기':'近十場','연속':'連勝敗','홈':'主場勝和敗','방문':'客場勝和敗'};
  return {games:[],scope:`${year} 球季排名；以來源更新時間為準`,tables:selected.map((t,i)=>{const headers=t.headers.map(h=>labels[h]||h),team=headers.indexOf('球隊');const rows=t.rows.map(r=>r.map((v,k)=>k===team?internationalTeam(v,league):v));for(const r of rows){const counts=['出賽','勝','敗','和'].map(k=>Number(r[headers.indexOf(k)]));if(counts.some(n=>!Number.isInteger(n)||n<0)||counts[0]!==counts[1]+counts[2]+counts[3])throw new Error('排名勝敗加總異常');}return {title:npb?(i?'太平洋聯盟':'中央聯盟'):'KBO 球隊排名',headers,rows}})};
 }
 if(kind==='npb-schedule'){
  const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const links=new Map<string,{id:string;label:string;url:string}>();
  const farm=html.indexOf('ファーム・リーグ');const scheduleHtml=farm>=0?html.slice(0,farm):html;
  for(const m of scheduleHtml.matchAll(/<a\b[^>]*href=["']([^"']*\/npb\/game\/(\d+)\/(?:index|score|stats))[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)){
   const label=plain(m[3]);if(label.length>4)links.set(m[2],{id:m[2],label,url:`https://baseball.yahoo.co.jp/npb/game/${m[2]}/stats`});
  }
  if(!links.size)throw new Error('賽程頁未提供可辨識的比賽資料，不能判定今日無賽事');
  return {games:[...links.values()],tables:[],scope:'來源首頁列出的日職賽事；日期以各場來源標示為準',date};
 }
 const parsed=tables(html);
 if(kind==='npb-game'){
  const selected=parsed.filter(t=>t.headers.some(h=>/投球数|投球回|打数/.test(h))).map(t=>({...t,title:(t.title?t.title+' · ':'')+(t.headers.some(h=>/投球数/.test(h))?'投手成績':'打擊成績')}));
  const score=parsed.find(t=>t.headers.includes('計')&&t.headers.includes('安'));
  const batting=selected.filter(t=>t.headers.includes('打数'));if(score?.rows.length===2&&batting.length===2)batting.forEach((t,i)=>{t.title=score.rows[i][0]+' · 打擊成績';});
  if(!selected.length)throw new Error('單場頁未讀到投打表格，可能尚未公布或來源格式改變');
  return {tables:score?[{...score,title:'逐局比分'},...selected]:selected,games:[],scope:plain(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'日職单場成績')};
 }
 const embedded=html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
 if(!embedded)throw new Error('FanGraphs 未提供結構化球員資料');
 const [league,stats]=kind.split('-');
 const queries=JSON.parse(embedded)?.props?.pageProps?.dehydratedState?.queries;
 const query=queries?.find((q:any)=>q.queryKey?.[0]===`leaders/international/${league}/data`);
 const params=query?.queryKey?.[1];const raw=query?.state?.data;
 if(Number(params?.season)!==year||Number(params?.season1)!==year||params?.stats!==stats||!Array.isArray(raw)||raw.some((r:any)=>Number(r.Season)!==year))throw new Error('來源球季或統計類型不符，停止顯示');
 const keys=stats==='pit'?['PlayerName','Team','G','GS','IP','Pitches','W','L','SV','HLD','H','ER','BB','SO','ERA','WHIP','FIP']:['PlayerName','Team','G','PA','AB','H','HR','R','RBI','BB','SO','SB','AVG','OBP','SLG','OPS','wRC+'];
 const labels:Record<string,string>={PlayerName:'球員',Team:'球隊',G:'出賽',GS:'先發場次',IP:'局數',Pitches:'球季用球數',W:'勝',L:'敗',SV:'救援',HLD:'中繼',H:'安打',ER:'責失',BB:'保送',SO:'三振',ERA:'防禦率',WHIP:'WHIP',FIP:'FIP',PA:'打席',AB:'打數',HR:'全壘打',R:'得分',RBI:'打點',SB:'盜壘',AVG:'打擊率',OBP:'上壘率',SLG:'長打率',OPS:'OPS','wRC+':'wRC+'};
 const active=raw.filter((r:any)=>stats==='pit'?r.G>0:r.PA>0).sort((a:any,b:any)=>Number(b[stats==='pit'?'IP':'PA'])-Number(a[stats==='pit'?'IP':'PA']));
 const format=(v:any,key:string)=>v===null||v===undefined?'—':typeof v==='number'?['AVG','OBP','SLG','OPS'].includes(key)?v.toFixed(3):['ERA','WHIP','FIP'].includes(key)?v.toFixed(2):key==='wRC+'?v.toFixed(1):String(v):plain(String(v));
 return {tables:[{title:stats==='pit'?'投手球季成績':'打者球季成績',headers:keys.map(k=>labels[k]),rows:active.map((r:any)=>keys.map(k=>k==='Team'?internationalTeam(format(r[k],k),league.toUpperCase()):format(r[k],k)))}],games:[],scope:`${year} 球季已核對；来源 ${raw.length} 筆，本表顯示 ${active.length} 筆有出賽或打席紀錄。球季用球數不代表單場用球數。`};
}
export const sourceLinks=[
 {name:'Yahoo 中職賽事紀錄',url:'https://tw.sports.yahoo.com/cpbl/teams/台鋼/',state:'live',note:'六隊例行賽頁彙整、單場逐局比分與主客隊投打紀錄；非逐球即時來源'},
 {name:'Yahoo 中職全年排名',url:'https://tw.sports.yahoo.com/cpbl/standings/',state:'live',note:'六隊全年勝敗和、勝率與勝差；不等於即時比分或球員成績'},
 {name:'NPB 官方預告先發',url:'https://npb.jp/announcement/starter/',state:'live',note:'公告日期、兩隊先發與球場；時間轉為台灣時間'},
 {name:'NPB 官方登錄異動',url:'https://npb.jp/announcement/roster/',state:'live',note:'登錄與取消登錄，不當成傷兵或先發打線'},
 {name:'KBO 官方英文賽程',url:'https://eng.koreabaseball.com/Schedule/DailySchedule.aspx',state:'live',note:'本月賽程與比分；非逐球即時資料'},
 {name:'Yahoo 中職',url:'https://tw.sports.yahoo.com/cpbl/',state:'partial',note:'中職僅使用非官網來源；完整球員成績仍有缺漏'},
 {name:'FanGraphs 日職',url:'https://www.fangraphs.com/leaders/international/npb',state:'live',note:'打者、投手球季表格；連線結果以下方實測為準'},
 {name:'FanGraphs 韓職',url:'https://www.fangraphs.com/leaders/international/kbo',state:'live',note:'打者、投手球季表格；不等於先發打線或逐場用球数'},
 {name:'Yahoo Sportsnavi',url:'https://baseball.yahoo.co.jp/npb/',state:'live',note:'日職首頁賽事與單場投打表格'},
 {name:'Goalserve',url:'https://www.goalserve.com/en/sport-data-feeds/MLB-api/coverage',state:'blocked',note:'尚無試用憑證；三聯盟詳細欄位需供應商樣本確認'},
 {name:'BetsAPI',url:'https://betsapi.com/',state:'blocked',note:'尚無 API 憑證；投手用球數與完整球員資料未確認'},
 {name:'LSports',url:'https://www.lsports.eu/baseball-data-api/',state:'blocked',note:'尚無試用憑證；球員資料深度未確認'},
 {name:'Baseball-Reference',url:'https://www.baseball-reference.com/register/',state:'blocked',note:'詳細頁讀取未成功，尚未建立可用資料接口'},
 {name:'MyKBO',url:'https://mykbostats.com/tos',state:'blocked',note:'條款限制協助投注用途，此站未接入'},
 {name:'API-Sports',url:'https://api-sports.io/sports/baseball',state:'blocked',note:'目前免費方案測試僅允許 2022–2024 球季；未作為 2026 資料來源'},
];
