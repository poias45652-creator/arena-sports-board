/** Public baseball feeds. Unknown values stay null; fetching does not prove live latency. */
import {createHash} from 'node:crypto';
const HOSTS=new Set(['api-gw.sports.naver.com','baseball.yahoo.co.jp','tw.sports.yahoo.com']);
export const dayInTaipei=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
export const numberOrNull=value=>value===null||value===undefined||value===''||typeof value==='boolean'||!/^\d+(?:\.\d+)?$/.test(String(value))?null:Number(value);
export const integerOrNull=value=>{const n=numberOrNull(value);return Number.isSafeInteger(n)&&n>=0?n:null;};
export function inningsToOuts(value){const m=String(value??'').match(/^(\d+)(?:\.([012]))?$/);return m?Number(m[1])*3+Number(m[2]||0):null;}
const bounded=(n,max)=>{const v=integerOrNull(n);return v!==null&&v<=max?v:null;};
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const CPBL={'cpbl.t.1':'中信兄弟','cpbl.t.2':'統一獅','cpbl.t.5':'富邦悍將','cpbl.t.6':'樂天桃猿','cpbl.t.7':'味全龍','cpbl.t.8':'台鋼雄鷹'};
const KBO={SK:'SSG登陸者',HT:'起亞虎',HH:'韓華鷹',KT:'KT巫師',LG:'LG雙子',NC:'NC恐龍',LT:'樂天巨人',SS:'三星獅',OB:'斗山熊',WO:'培證英雄'};
const NPB={1:'讀賣巨人',2:'養樂多燕子',3:'橫濱DeNA海灣之星',4:'中日龍',5:'阪神虎',6:'廣島東洋鯉魚',7:'西武獅',8:'日本火腿鬥士',9:'千葉羅德海洋',11:'歐力士猛牛',12:'福岡軟銀鷹',376:'東北樂天金鷲'};
function team(id,name){return {id:String(id),name,score:null,hits:null,errors:null};}
function base(league,id,date,startTime,source){return {key:`${league}:${id}`,id:String(id),league,date,startTime,status:'unknown',rawStatus:null,away:null,home:null,inning:null,half:null,balls:null,strikes:null,outs:null,bases:null,currentPitcher:null,currentBatter:null,starters:{away:null,home:null},lineups:{away:[],home:[]},lineupConfirmation:'not_verified',batting:{away:[],home:[]},pitching:{away:[],home:[]},innings:{away:[],home:[]},source,warnings:[]};}
function provenance(provider,p){return {provider,url:p.url,fetchedAt:p.fetchedAt,httpDate:p.httpDate??null,cacheAgeSeconds:p.cacheAgeSeconds??null,providerUpdatedAt:null};}
export function validateGame(g){
 assert(['NPB','KBO','CPBL'].includes(g.league),'Unknown league');
 assert(g.away?.id&&g.home?.id&&g.away.id!==g.home.id&&g.away.name&&g.home.name,'Missing team identity');
 assert(/^\d{4}-\d{2}-\d{2}$/.test(g.date),'Invalid game date');
 if(g.startTime)assert(Number.isFinite(Date.parse(g.startTime)),'Invalid start time');
 assert(['pregame','live','final','postponed','cancelled','suspended','unknown'].includes(g.status),'Invalid state');
 if(g.status==='pregame')assert(g.away.score===null&&g.home.score===null,'Pregame scores must not be fabricated zeroes');
 if(g.status==='live'||g.status==='final')assert(integerOrNull(g.away.score)!==null&&integerOrNull(g.home.score)!==null,'Active/result scores missing');
 for(const side of ['away','home']){const line=g.innings[side];if(line.length&&line.every(x=>integerOrNull(x.runs)!==null)&&g[side].score!==null&&line.reduce((n,x)=>n+x.runs,0)!==g[side].score)g.warnings.push(`${side}:inning_sum_conflict`);}
 const payload={status:g.status,awayScore:g.away.score,homeScore:g.home.score,inning:g.inning,half:g.half,balls:g.balls,strikes:g.strikes,outs:g.outs,bases:g.bases,currentPitcher:g.currentPitcher,currentBatter:g.currentBatter,pitching:g.pitching};
 g.stateHash=createHash('sha256').update(JSON.stringify(payload)).digest('hex');g.liveStateObserved=g.status==='live'&&g.inning!==null;g.liveChangesVerified=false;return g;
}
export async function fetchPublic(url,fetcher=fetch){
 const u=new URL(url);assert(u.protocol==='https:'&&HOSTS.has(u.hostname)&&!u.username&&!u.password,'Source URL is not allowed');
 const r=await fetcher(u.href,{redirect:'manual',cache:'no-store',headers:{'User-Agent':'YJBaseballSourceCheck/1.0','Accept':'application/json,text/html;q=0.8'},signal:AbortSignal.timeout(20000)});
 if(!r.ok){await r.body?.cancel();throw new Error(`HTTP ${r.status} from ${u.hostname}; no access challenge bypassed`);}
 let length=0;const parts=[];for await(const part of r.body){length+=part.byteLength;if(length>8_000_000)throw new Error('Source response exceeds 8 MB');parts.push(part);}
 const text=Buffer.concat(parts).toString('utf8');if(/challenge-platform|<title>Just a moment/i.test(text))throw new Error('Browser challenge, not sports data');
 return {url:u.href,text,fetchedAt:new Date().toISOString(),httpDate:r.headers.get('date'),cacheAgeSeconds:integerOrNull(r.headers.get('age'))};
}
export function plain(s=''){return s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>{const c=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return c>0&&c<=0x10ffff?String.fromCodePoint(c):'';}).replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();}
function tableData(html){return [...html.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)].map(m=>({attrs:m[1],rows:[...m[2].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(r=>[...r[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(c=>plain(c[1]))).filter(r=>r.length)}));}
function classBlock(html,name){
 const openings=/<([a-z][a-z0-9]*)\b([^>]*)>/gi;let m;
 while((m=openings.exec(html))){const names=(m[2].match(/\bclass=["']([^"']*)["']/i)?.[1]||'').split(/\s+/);if(!names.includes(name))continue;
 const start=m.index,tag=m[1];let depth=1;const tokens=new RegExp(`<\\/?${tag}\\b[^>]*>`,'gi');tokens.lastIndex=openings.lastIndex;let end;
 while((end=tokens.exec(html))){if(end[0].startsWith('</'))depth--;else if(!end[0].endsWith('/>'))depth++;if(depth===0)return html.slice(start,tokens.lastIndex);}throw new Error('Unclosed source component');}return '';
}
function classText(html,name){return plain(classBlock(html,name));}
export function yahooObjects(html){
 const chunks=[];for(const m of html.matchAll(/self\.__next_f\.push\((\[.*?\])\)\s*(?:<\/script>|;)/gs)){try{const x=JSON.parse(m[1]);if(x[0]===1&&typeof x[1]==='string')chunks.push(x[1]);}catch{}}
 const roots=new Map();for(const line of chunks.join('').split('\n')){const i=line.indexOf(':');if(i<0)continue;try{roots.set(line.slice(0,i),JSON.parse(line.slice(i+1)));}catch{}}
 const resolve=(raw,depth=0)=>{if(depth>35)return null;if(typeof raw==='string'&&/^\$[0-9a-f]+(?::|$)/.test(raw)){const [id,...path]=raw.slice(1).split(':');let x=roots.get(id);for(const key of path){x=resolve(x,depth+1);x=Array.isArray(x)&&x[0]==='$'&&key==='props'?x[3]:x?.[key];}return resolve(x,depth+1);}return raw;};
 const objects=[],seen=new Set();function walk(raw,depth=0){if(depth>60)return;const x=resolve(raw);if(!x||typeof x!=='object'||seen.has(x))return;seen.add(x);if(!Array.isArray(x))objects.push(x);for(const v of Object.values(x))walk(v,depth+1);}for(const v of roots.values())walk(v);
 const proxies=new WeakMap();const wrap=raw=>{const x=resolve(raw);if(!x||typeof x!=='object')return x;if(proxies.has(x))return proxies.get(x);const p=new Proxy(x,{get:(target,key)=>wrap(target[key])});proxies.set(x,p);return p;};return objects.map(wrap);
}
export function parseCpbl(raw,page){
 assert(/^cpbl\.g\.\d{9}$/.test(raw.gameId)&&CPBL[raw.homeTeamId]&&CPBL[raw.awayTeamId],'Not a CPBL game');assert(raw.seasonPhase==='REGULAR_SEASON','Not CPBL regular season');
 const time=new Date(raw.startTime);assert(Number.isFinite(time.getTime()),'CPBL start time missing');const date=dayInTaipei(time),id=raw.gameId.slice(7);assert(id.slice(0,6)===date.replaceAll('-','').slice(2),'CPBL ID/date conflict');
 const g=base('CPBL',id,date,time.toISOString(),provenance('yahoo-tw',page));g.home=team(raw.homeTeamId,CPBL[raw.homeTeamId]);g.away=team(raw.awayTeamId,CPBL[raw.awayTeamId]);
 const status={PREGAME:'pregame',IN_PROGRESS:'live',FINAL:'final',POSTPONED:'postponed',CANCELLED:'cancelled',SUSPENDED:'suspended'};g.rawStatus=raw.status;g.status=status[raw.status]||'unknown';const played=['live','final','suspended'].includes(g.status);
 for(const side of ['away','home']){
  if(played){g[side].score=integerOrNull(raw[side+'Score']);g[side].hits=integerOrNull(raw[side+'Hits']);g[side].errors=integerOrNull(raw[side+'Errors']);}
  const line=raw[side+'LineScore'];if(played&&Array.isArray(line))g.innings[side]=line.map(x=>({inning:integerOrNull(x.period?.period),runs:integerOrNull(x.score)})).filter(x=>x.inning!==null);
  const lineup=raw[side+'TeamLineup'];if(Array.isArray(lineup))g.lineups[side]=lineup.filter(x=>/^cpbl\.p\.\d+$/.test(x.player?.playerId)&&x.player?.displayName).map(x=>({id:x.player.playerId,name:x.player.displayName,order:bounded(x.order,9),position:x.positionId??null,battingSide:x.player.battingSide??null,confirmation:'source_listed_not_officially_verified'}));
  for(const table of raw.playerStats?.[side+'Tables']||[]){if(!['batting','pitching'].includes(table.tableId))continue;const target=g[table.tableId][side];for(const row of table.tableStats||[]){if(!/^cpbl\.p\.\d+$/.test(row.player?.playerId)||!row.player?.displayName)continue;
   const stats=Object.fromEntries((Array.isArray(row.stats)?row.stats:[]).filter(x=>/^[A-Z_]+$/.test(x.statId)).map(x=>[x.statId,numberOrNull(���ƭy��ج�V��yr