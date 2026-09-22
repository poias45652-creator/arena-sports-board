import {cpblYahooGames,cpblUpcoming,npbCalendar,kboMonth,uniqueGames,npbPlayers,profileTeams,profileTeamId,type ProfileLeague,type ProfileGame} from './international-profile';
import {parseInternational,plain} from './international';
import {npbScheduleIds,parseNpb} from '../server/baseball-live-providers.mjs';
type Page={html:string;cookie:string};
const pageCache=new Map<string,{until:number;page:Page}>(),pagePending=new Map<string,Promise<Page>>();
async function fetchPage(url:string,body?:URLSearchParams,cookie?:string):Promise<Page>{
 if(/(^|\.)cpbl\.com\.tw$/i.test(new URL(url).hostname))throw Error('已停用中職官網抓取');
 try{
 const r=await fetch(url,{method:body?'POST':'GET',body,headers:{'User-Agent':'YJBaseballStats/1.0',Accept:'text/html,application/json',...(cookie?{Cookie:cookie}:{})},signal:AbortSignal.timeout(20000),redirect:'manual'});
 if(!r.ok)throw Error(`來源回覆 HTTP ${r.status}`);const html=await r.text();if(html.length>8_000_000||/challenge-platform|<title>Just a moment/i.test(html))throw Error('來源暫時無法讀取');
 const headers=r.headers as Headers&{getAll?:(name:string)=>string[]};
 const cookies=typeof headers.getSetCookie==='function'?headers.getSetCookie():typeof headers.getAll==='function'?headers.getAll('Set-Cookie'):(headers.get('set-cookie')||'').split(/,(?=\s*[^;,=\s]+=)/);
 return {html,cookie:cookies.filter(Boolean).map(c=>c.split(';')[0].trim()).join('; ')};
 }catch(error){console.error('International profile source failed',new URL(url).hostname,error instanceof Error?error.message.slice(0,180):'unknown');throw error;}
}
async function getPage(url:string,body?:URLSearchParams,cookie?:string):Promise<Page>{
 if(body)return fetchPage(url,body,cookie);const old=pageCache.get(url);if(old&&old.until>Date.now())return old.page;
 if(!pagePending.has(url))pagePending.set(url,fetchPage(url).then(page=>{if(pageCache.size>90)pageCache.delete(pageCache.keys().next().value!);pageCache.set(url,{page,until:Date.now()+240000});return page;}).finally(()=>pagePending.delete(url)));
 return pagePending.get(url)!;
}
function hidden(html:string){const p=new URLSearchParams();for(const m of html.matchAll(/<input\b[^>]*type="hidden"[^>]*>/gi)){const n=m[0].match(/name="([^"]+)"/)?.[1],v=m[0].match(/value="([^"]*)"/)?.[1];if(n)p.set(n,plain(v||''));}return p;}
async function kboStep(page:Page,direction:'Before'|'Next'){
 const p=hidden(page.html),name=page.html.match(new RegExp(`name="([^"]*\\$btn${direction})"`))?.[1];if(!name)throw Error('韓職月份控制欄位缺漏');p.set(name+'.x','1');p.set(name+'.y','1');const next=await getPage('https://eng.koreabaseball.com/Schedule/DailySchedule.aspx',p,page.cookie);return {...next,cookie:next.cookie||page.cookie};
}

const photoKey=(name:string)=>String(name||'').normalize('NFKC').replace(/^\s*[*＊]\s*/,'').replace(/[.,'’·・]/g,' ').replace(/\s+/g,' ').trim().toLowerCase().split(' ').filter(Boolean).sort().join('|');
async function parallelMap<T,R>(items:T[],fn:(item:T)=>Promise<R>,limit=8){let cursor=0;const out:R[]=[];await Promise.all(Array.from({length:Math.min(limit,items.length)},async()=>{while(cursor<items.length){const i=cursor++;out[i]=await fn(items[i]);}}));return out;}
function npbPlayerLinks(html:string){const seen=new Map<string,{name:string;url:string}>();for(const m of html.matchAll(/<a\b[^>]*href=["'](\/bis\/players\/(\d+)\.html)["'][^>]*>([\s\S]*?)<\/a>/gi)){const name=plain(m[3]);if(name)seen.set(m[2],{name,url:'https://npb.jp'+m[1]});}return [...seen.values()];}
async function npbPhotos(pages:string[]){const links=new Map<string,{name:string;url:string}>();for(const html of pages)for(const row of npbPlayerLinks(html))links.set(row.url,row);const photos=new Map<string,string>();await parallelMap([...links.values()].slice(0,80),async row=>{try{const html=(await getPage(row.url)).html;const src=html.match(/(?:https?:)?\/\/p\.npb\.jp\/players_photo\/[^"'<>\s]+\.jpg/i)?.[0];if(src)photos.set(photoKey(row.name),src.startsWith('//')?'https:'+src:src);}catch{}return null;},8);return photos;}
const SPORTS_NAV_ID:Record<string,string>={g:'1',s:'2',db:'3',d:'4',t:'5',c:'6',l:'7',f:'8',m:'9',b:'11',h:'12',e:'376'};
async function sportsnaviNpbPhotos(code:string){const teamId=SPORTS_NAV_ID[code];if(!teamId)return new Map<string,string>();const html=(await getPage(`https://baseball.yahoo.co.jp/npb/teams/${teamId}/players`)).html,photos=new Map<string,string>();for(const row of html.matchAll(/<a\b[^>]*href=["'][^"']*\/npb\/player\/(\d+)\/?[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)){const name=plain(row[2]);if(!name)continue;photos.set(photoKey(name),`https://sports-baseball.west.edge.storage-yahoo.jp/npb/images/player/portrait/${teamId}/${row[1]}.jpg`);}return photos;}
const MYKBO_TEAM:Record<string,string>={OB:'1-Doosan-Bears',HH:'4-Hanwha-Eagles',HT:'5-Kia-Tigers',WO:'23-Kiwoom-Heroes',KT:'22-KT-Wiz',LG:'6-LG-Twins',LT:'2-Lotte-Giants',NC:'9-NC-Dinos',SS:'3-Samsung-Lions',SK:'24-SSG-Landers'};
async function myKboPhotos(code:string,year:number){const slug=MYKBO_TEAM[code];if(!slug)return new Map<string,string>();const pages=await Promise.all([`https://mykbostats.com/teams/${slug}/${year}`,`https://mykbostats.com/teams/${slug}/roster`].map(url=>getPage(url)));const photos=new Map<string,string>();for(const page of pages)for(const tr of page.html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)){const link=tr[1].match(/href=["']\/players\/(\d+)(?:-[^"']*)?["'][^>]*>([\s\S]*?)<\/a>/i);if(!link)continue;const name=plain(link[2]),src=tr[1].match(/https?:\/\/mykbostats\.com\/photos\/player\/${link[1]}\/\d+\.jpg(?:\?[^"'\s<]*)?/i)?.[0];if(name&&src&&!/player_photo_missing/i.test(src))photos.set(photoKey(name),src);}return photos;}
const KBO_SEARCH='https://eng.koreabaseball.com/Teams/PlayerSearch.aspx';
const ymd=(time:number)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(time));
function kboProfileName(html:string){return plain(html.match(/<b>\s*Name\s*<\/b>\s*:\s*([^<]+)/i)?.[1]||'');}
async function kboPhotos(code:string,year:number){
 const end=ymd(Date.now()),start=ymd(Date.now()-30*86400000),scheduleUrl=`https://api-gw.sports.naver.com/schedule/games?categoryId=kbo&fromDate=${start}&toDate=${end}&page=1&size=100`;
 const raw=JSON.parse((await getPage(scheduleUrl)).html),games=(raw.result?.games||[]).filter((g:any)=>g.categoryId==='kbo'&&(g.homeTeamCode===code||g.awayTeamCode===code)).sort((a:any,b:any)=>String(b.gameDateTime||b.gameDate).localeCompare(String(a.gameDateTime||a.gameDate))).slice(0,8);
 if(!games.length)throw Error('韓職近期賽事名單暫缺');
 const people=new Map<string,'bat'|'pit'>();
 await parallelMap(games,async(g:any)=>{try{const page=await getPage(`https://api-gw.sports.naver.com/schedule/games/${g.gameId}/game-polling`),json=JSON.parse(page.html),relay=json.result?.textRelayData,side=g.homeTeamCode===code?'home':'away',lineup=relay?.[side+'Lineup'];for(const p of lineup?.batter||[])if(p.pcode)people.set(String(p.pcode),'bat');for(const p of lineup?.pitcher||[])if(p.pcode)people.set(String(p.pcode),'pit');}catch{}return null;},4);
 if(!people.size)throw Error('韓職球員代碼暫缺');
 const photos=new Map<string,string>();
 await parallelMap([...people],async([pcode,kind])=>{try{const url=`https://eng.koreabaseball.com/Teams/PlayerInfo${kind==='pit'?'Pitcher':'Hitter'}/Summary.aspx?pcode=${pcode}`,html=(await getPage(url)).html,name=kboProfileName(html),src=html.match(/(?:https?:)?\/\/6ptotvmi5753\.edge\.naverncp\.com\/KBO_IMAGE\/person\/middle\/${year}\/${pcode}\.jpg/i)?.[0]||`https://6ptotvmi5753.edge.naverncp.com/KBO_IMAGE/person/middle/${year}/${pcode}.jpg`;if(name)photos.set(photoKey(name),src.startsWith('//')?'https:'+src:src);}catch{}return null;},8);
 return photos;
}
function attachPhotos(result:{bat:any;pit:any},photos:Map<string,string>){const out:Record<string,string>={};for(const table of [result.bat,result.pit])for(const row of table?.rows||[]){const src=photos.get(photoKey(row[0]));if(src)out[row[0]]=src;}return out;}
export async function collectProfileGames(league:ProfileLeague,year:number){
 let games:ProfileGame[]=[];const warnings:string[]=[],sources:{label:string;url:string}[]=[];
 if(league==='CPBL'){
  const urls=['中信','統一','富邦','樂天','味全','台鋼'].map(name=>`https://tw.sports.yahoo.com/cpbl/teams/${encodeURIComponent(name)}/`);
  const results=await Promise.allSettled(urls.map(async url=>cpblYahooGames((await getPage(url)).html,year)));
  results.forEach((r,i)=>{if(r.status==='fulfilled')games.push(...r.value);else warnings.push(`${profileTeams.CPBL[Object.keys(profileTeams.CPBL)[i]]}逐場紀錄暫缺`);});sources.push({label:'Yahoo 中職賽程與賽果',url:urls[0]});
 }else if(league==='NPB'){
  const urls=Array.from({length:7},(_,i)=>`https://npb.jp/bis/eng/${year}/calendar/index_${String(i+4).padStart(2,'0')}.html`);
  const results=await Promise.allSettled(urls.map(async url=>npbCalendar((await getPage(url)).html,year)));
  results.forEach((r,i)=>{if(r.status==='fulfilled')games.push(...r.value);else warnings.push(`${i+4===4?'3、4':i+4} 月賽程暫缺`);});sources.push({label:'NPB 官方全年賽果',url:`https://npb.jp/bis/eng/${year}/calendar/index_04.html`});
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei'}).format(new Date());
  try{const url='https://baseball.yahoo.co.jp/npb/schedule/?date='+today,schedule=(await getPage(url)).html,ids=npbScheduleIds(schedule),aliases:Record<string,string>={'1':'g','2':'s','3':'db','4':'d','5':'t','6':'c','7':'l','8':'f','9':'m','11':'b','12':'h','376':'e'};
   const anchors=[...schedule.matchAll(/<a\b[^>]*href=["'][^"']*\/npb\/game\/(\d+)\/(?:index|score)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)];
   const updated=await Promise.allSettled(ids.map(async (id:string)=>{const card=anchors.find(m=>m[1]===id&&/bb-score__homeLogo/.test(m[2]));if(!card)throw Error();const scoreUrl=`https://baseball.yahoo.co.jp/npb/game/${id}/score`,html=(await getPage(scoreUrl)).html,g=parseNpb(html+'\n'+card[0],'',id,{url:scoreUrl,fetchedAt:new Date().toISOString()});if(g.date!==today||!aliases[g.home.id]||!aliases[g.away.id])throw Error();return g;}));
   for(const r of updated){if(r.status!=='fulfilled'){warnings.push('部分今日賽事更新暫缺');continue;}const g=r.value,homeId=profileTeamId('NPB',aliases[g.home.id]),awayId=profileTeamId('NPB',aliases[g.away.id]);const matches=games.filter(x=>x.date===today&&x.homeId===homeId&&x.awayId===awayId);if(matches.length!==1)continue;Object.assign(matches[0],{homeScore:g.home.score,awayScore:g.away.score,completed:g.status==='final',state:g.status==='final'?'Final':g.status==='live'?'Live':'Preview',status:({final:'已完賽',live:'進行中',pregame:'未開賽',cancelled:'取消',suspended:'暫停'} as Record<string,string>)[g.status]||'待確認',url:g.source.url,...(g.startTime?{start:g.startTime,timeKnown:true}:{})});}
   if(updated.length)sources.push({label:'Sportsnavi 今日本隊賽事狀態',url});
  }catch{warnings.push('今日賽事更新暫缺，保留官方月賽程');}
 }else{
  const first=await getPage('https://eng.koreabaseball.com/Schedule/DailySchedule.aspx');
  const marker=(p:Page)=>p.html.match(/lblGameMonth[^>]*>\s*(\d{4})\.(\d{2})/);
  const current=marker(first);if(!current||+current[1]!==year)throw Error('韓職來源球季不符');
  const visited=new Set<string>();const add=(p:Page)=>{const m=marker(p);if(!m||+m[1]!==year||visited.has(m[0]))throw Error('韓職賽程月份重複或年度不符');visited.add(m[0]);games.push(...kboMonth(p.html,year));return +m[2];};add(first);
  await Promise.all([ (async()=>{let page=first;for(let month=+current[2];month>3;month--){try{page=await kboStep(page,'Before');if(add(page)!==month-1)throw Error();}catch{warnings.push(`${month-1} 月以前賽程暫缺`);break;}}})(),(async()=>{let page=first;for(let month=+current[2];month<10;month++){try{page=await kboStep(page,'Next');if(add(page)!==month+1)throw Error();}catch{warnings.push(`${month+1} 月以後賽程暫缺`);break;}}})() ]);
  sources.push({label:'KBO 官方逐月例行賽紀錄',url:'https://eng.koreabaseball.com/Schedule/DailySchedule.aspx'});
  // Match only today's official regular-season fixtures. This prevents a live score
  // in a daily schedule from being counted as a finished game.
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei'}).format(new Date());
  try{const raw=JSON.parse((await getPage(`https://api-gw.sports.naver.com/schedule/games?categoryId=kbo&fromDate=${today}&toDate=${today}&page=1&size=100`)).html);if(raw.success!==true||!Array.isArray(raw.result?.games))throw Error();
   for(const g of games.filter(g=>g.date===today)){const row=raw.result.games.find((r:any)=>r.categoryId==='kbo'&&profileTeamId('KBO',r.homeTeamCode)===g.homeId&&profileTeamId('KBO',r.awayTeamCode)===g.awayId&&r.gameDateTime&&new Date(r.gameDateTime+'+09:00').getTime()===Date.parse(g.start));if(!row||row.statusCode!=='RESULT'||row.cancel||row.suspended){g.completed=false;g.state=row?.statusCode==='BEFORE'?'Preview':'Live';g.status=row?.cancel?'取消':row?.suspended?'暫停':row?.statusCode==='BEFORE'?'未開賽':'進行中／待官方確認';}}
  }catch{for(const g of games.filter(g=>g.date===today)){g.completed=false;g.status='待完賽確認';g.state='Live';}warnings.push('今日完賽狀態未能確認，暫不納入統計');}
 }
 games=uniqueGames(games);if(!games.length)throw Error('尚未取得可核對的逐場資料');
 return {games,warnings,sources,fetchedAt:new Date().toISOString()};
}
export async function collectProfilePlayers(league:ProfileLeague,code:string,year:number){
 const warnings:string[]=[],sources:{label:string;url:string}[]=[],result:{bat:any;pit:any}={bat:null,pit:null};let photos:Record<string,string>={},photoIndex:Record<string,string>={};
 if(league==='CPBL'){
  // Yahoo's public CPBL stats page currently says No Data Available. Keep any
  // dated archive stale; never fetch the official site as a hidden fallback.
  throw Error('中職官網抓取已停用；非官網完整球員成績來源尚未提供資料');
 }else if(league==='NPB'){
  const pages:string[]=[];await Promise.all((['bat','pit'] as const).map(async kind=>{const url=`https://npb.jp/bis/${year}/stats/id${kind==='bat'?'b':'p'}1_${code}.html`;try{const page=await getPage(url);pages.push(page.html);result[kind]=npbPlayers(page.html,year,kind);sources.push({label:`NPB 官方${kind==='bat'?'打者':'投手'}成績`,url});}catch{warnings.push(`${kind==='bat'?'打者':'投手'}成績暫時無法讀取`);}}));
  try{const official=await npbPhotos(pages),media=await sportsnaviNpbPhotos(code),map=new Map([...media,...official]);photoIndex=Object.fromEntries(map);photos=attachPhotos(result,map);sources.push({label:'NPB 官方球員照片',url:'https://npb.jp/bis/players/'},{label:'Sportsnavi 球員照片備援',url:`https://baseball.yahoo.co.jp/npb/teams/${SPORTS_NAV_ID[code]}/players`});}catch{warnings.push('部分球員照片暫時無法讀取');}
 }else{
  await Promise.all((['bat','pit'] as const).map(async kind=>{const url=`https://www.fangraphs.com/leaders/international/kbo?stats=${kind}&season=${year}&season1=${year}&qual=0&pageitems=2000&pagenum=1`;try{const data=parseInternational((await getPage(url)).html,`kbo-${kind}`,year),table=data.tables[0],index=table.headers.indexOf('球隊');result[kind]={...table,rows:table.rows.filter(r=>r[index]===profileTeams.KBO[code])};sources.push({label:`FanGraphs 韓職${kind==='bat'?'打者':'投手'}成績`,url});}catch{warnings.push(`${kind==='bat'?'打者':'投手'}成績暫時無法讀取`);}}));
  try{const official=await kboPhotos(code,year),foreign=await myKboPhotos(code,year),map=new Map([...foreign,...official]);photoIndex=Object.fromEntries(map);photos=attachPhotos(result,map);sources.push({label:'KBO 官方球員照片',url:KBO_SEARCH},{label:'MyKBO 球員照片備援',url:`https://mykbostats.com/teams/${MYKBO_TEAM[code]}/roster`});}catch{warnings.push('部分球員照片暫時無法讀取');}
 }
 if(!result.bat&&!result.pit&&!Object.keys(photoIndex).length)throw Error('球員資料暫時無法讀取');return {...result,photos,photoIndex,warnings,sources,fetchedAt:new Date().toISOString()};
}
export async function collectUpcoming(code:string,year:number){const names:Record<string,string>={ACN:'中信',ADD:'統一',AEO:'富邦',AJL:'樂天',AAA:'味全',AKP:'台鋼'},url=`https://tw.sports.yahoo.com/cpbl/teams/${encodeURIComponent(names[code])}/`;return {games:cpblUpcoming((await getPage(url)).html,year),sources:[{label:'Yahoo 中職待賽與進行中賽程',url}],fetchedAt:new Date().toISOString(),warnings:[]};}
