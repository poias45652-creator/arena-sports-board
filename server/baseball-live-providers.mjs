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
   const stats=Object.fromEntries((Array.isArray(row.stats)?row.stats:[]).filter(x=>/^[A-Z_]+$/.test(x.statId)).map(x=>[x.statId,numberOrNull(x.value)]));const p={id:row.player.playerId,name:row.player.displayName,stats};if(table.tableId==='pitching'){p.pitchCount=integerOrNull(stats.PITCHES_THROWN);p.outsRecorded=inningsToOuts(stats.INNINGS_PITCHED);}target.push(p);}}
 }
 if(g.status==='live'){g.inning=integerOrNull(raw.currentPeriod?.period);const display=String(raw.currentPeriod?.displayName||raw.fullStatusDisplayName||'');g.half=/^(Top|上)/i.test(display)?'top':/^(Bottom|Bot|下)/i.test(display)?'bottom':null;}
 g.warnings.push('provider_update_time_not_supplied','lineup_confirmation_not_verified');if(g.pitching.away.concat(g.pitching.home).some(p=>p.pitchCount===null))g.warnings.push('pitch_count_not_supplied');if(!Array.isArray(raw.playByPlay)||raw.playByPlay.length===0)g.warnings.push('pitch_by_pitch_not_supplied');return validateGame(g);
}
export function parseKbo(raw,page,relay=null){
 assert(raw.categoryId==='kbo'&&KBO[raw.homeTeamCode]&&KBO[raw.awayTeamCode],'Not an actual KBO game');assert(/^\d{8}[A-Z0-9]{4,20}$/.test(raw.gameId),'Bad KBO game ID');const date=raw.gameDate;assert(raw.gameId.startsWith(date.replaceAll('-','')),'KBO date/ID conflict');
 const time=raw.gameDateTime?new Date(raw.gameDateTime+(/(?:Z|[+-]\d\d:\d\d)$/.test(raw.gameDateTime)?'':'+09:00')).toISOString():null;const g=base('KBO',raw.gameId,date,time,provenance('naver',page));g.home=team(raw.homeTeamCode,KBO[raw.homeTeamCode]);g.away=team(raw.awayTeamCode,KBO[raw.awayTeamCode]);
 g.rawStatus=raw.statusCode;g.status=raw.cancel?'cancelled':raw.suspended?'suspended':({BEFORE:'pregame',READY:'pregame',STARTED:'live',PLAYING:'live',IN_PROGRESS:'live',RESULT:'final',ENDED:'final',CANCEL:'cancelled'}[raw.statusCode]||'unknown');const played=['live','final','suspended'].includes(g.status);const state=relay?.currentGameState;
 for(const side of ['away','home']){
  if(played){g[side].score=integerOrNull(raw[side+'TeamScore']);g[side].hits=integerOrNull(raw[side+'TeamRheb']?.[1]);g[side].errors=integerOrNull(raw[side+'TeamRheb']?.[2]);}
  const s=raw[side+'StarterName'];if(s)g.starters[side]={id:null,name:s,confirmation:'probable'};if(played&&Array.isArray(raw[side+'TeamScoreByInning']))g.innings[side]=raw[side+'TeamScoreByInning'].map((value,i)=>({inning:i+1,runs:integerOrNull(value)}));
  const lineup=relay?.[side+'Lineup'];if(lineup){g.lineups[side]=(lineup.batter||[]).filter(x=>Number(x.seqno)===1).map(x=>({id:String(x.pcode),name:x.name,order:bounded(x.batOrder,9),position:x.posName||x.pos||null,confirmation:'source_listed'}));
   g.batting[side]=(lineup.batter||[]).map(x=>({id:String(x.pcode),name:x.name,stats:{AT_BATS:integerOrNull(x.ab),RUNS:integerOrNull(x.run),HITS:integerOrNull(x.hit),RBIS:integerOrNull(x.rbi),HOME_RUNS:integerOrNull(x.hr),WALKS:integerOrNull(x.bb),STRIKEOUTS:integerOrNull(x.so)}}));
   g.pitching[side]=(lineup.pitcher||[]).map(x=>({id:String(x.pcode),name:x.name,pitchCount:integerOrNull(x.ballCount),outsRecorded:inningsToOuts(x.inn),stats:{INNINGS_PITCHED:numberOrNull(x.inn),HITS_ALLOWED:integerOrNull(x.hit),EARNED_RUNS:integerOrNull(x.er),RUNS_ALLOWED:integerOrNull(x.run),WALKS_ALLOWED:integerOrNull(x.bb),STRIKEOUTS_THROWN:integerOrNull(x.kk),PITCHES_THROWN:integerOrNull(x.ballCount),SEASON_ERA:numberOrNull(x.seasonEra)}}));}
 }
 if(g.status==='live'){const m=String(raw.currentInning||raw.statusInfo||'').match(/(\d+)회(초|말)/);if(m){g.inning=Number(m[1]);g.half=m[2]==='초'?'top':'bottom';}if(state){g.balls=bounded(state.ball,3);g.strikes=bounded(state.strike,2);g.outs=bounded(state.out,3);g.bases=[state.base1,state.base2,state.base3].map(x=>x===null||x===undefined?null:x!==''&&x!=='0'&&x!==0);g.currentPitcher=state.pitcher||null;g.currentBatter=state.batter||null;}}
 g.warnings.push('provider_update_time_not_supplied');return validateGame(g);
}
export function npbScheduleIds(html){const region=html.split('ファーム・リーグ')[0],ids=[];for(const m of region.matchAll(/<a\b([^>]*)>/gi)){const cls=(m[1].match(/\bclass=["']([^"']*)["']/i)?.[1]||'').split(/\s+/);if(!cls.includes('bb-score__content'))continue;const id=m[1].match(/\bhref=["'][^"']*\/npb\/game\/(\d+)\//)?.[1];if(id&&!ids.includes(id))ids.push(id);}return ids.slice(0,12);}
export function parseNpb(scoreHtml,statsHtml,id,page){
 const title=plain(scoreHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');const m=title.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);assert(m,'NPB title date missing');const date=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;const round=classText(scoreHtml,'bb-gameRound'),hour=round.match(/\b(\d{2}:\d{2})\b/)?.[1];
 const g=base('NPB',id,date,hour?new Date(date+'T'+hour+':00+09:00').toISOString():null,provenance('sportsnavi',page));
 const link=[...scoreHtml.matchAll(/<a\b[^>]*href=["'][^"']*\/npb\/game\/(\d+)\/(?:index|score)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)].find(x=>x[1]===String(id)&&/bb-score__homeLogo/.test(x[2]));
 if(link){for(const side of ['home','away']){const n=link[2].match(new RegExp(`bb-score__${side}Logo--npbTeam(\\d+)`));assert(n&&NPB[n[1]],'NPB team ID not mapped');g[side]=team(n[1],NPB[n[1]]);const p=classText(link[2],side==='home'?'bb-score__playerHome':'bb-score__playerAway');if(/^\(予\)/.test(p))g.starters[side]={id:null,name:p.replace(/^\(予\)\s*/,''),confirmation:'probable'};}}
 const liveHtml=classBlock(scoreHtml,'bb-live');assert(liveHtml,'NPB live component missing');const live=plain(liveHtml);g.rawStatus=live.slice(0,160);g.status=/試合終了|コールド/.test(live)?'final':/試合中止/.test(live)?'cancelled':/試合前|開始前/.test(live)?'pregame':/中断/.test(live)?'suspended':/\d+回[表裏]/.test(live)?'live':'unknown';
 const score=tableData(scoreHtml).find(t=>/\bid=["']ing_brd["']/.test(t.attrs))||tableData(scoreHtml).find(t=>t.rows[0]?.includes('計')&&t.rows[0]?.includes('安'));
 if(score){const [h,...r]=score.rows;assert(r.length===2,'NPB inning team rows missing');['away','home'].forEach((side,i)=>{if(['live','final','suspended'].includes(g.status)){g[side].score=integerOrNull(r[i][h.indexOf('計')]);g[side].hits=integerOrNull(r[i][h.indexOf('安')]);g[side].errors=integerOrNull(r[i][h.indexOf('失')]);g.innings[side]=h.map((v,k)=>/^\d+$/.test(v)?{inning:Number(v),runs:integerOrNull(r[i][k])}:null).filter(Boolean);}});}
 if(g.status==='live'){const inn=live.match(/(\d+)回(表|裏)/);if(inn){g.inning=Number(inn[1]);g.half=inn[2]==='表'?'top':'bottom';}}
 if(statsHtml&&['live','final','suspended'].includes(g.status)){const statsTitle=plain(statsHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');assert(statsTitle.startsWith(`${Number(m[1])}年${Number(m[2])}月${Number(m[3])}日`),'NPB stats date conflict');
  for(const t of tableData(statsHtml)){const teamId=t.attrs.match(/--npbTeam(\d+)/)?.[1],side=teamId===g.away?.id?'away':teamId===g.home?.id?'home':null;if(!side)continue;const [headers,...rows]=t.rows;const kind=headers.includes('投球数')?'pitching':headers.includes('打数')?'batting':null;if(!kind)continue;
   const mappings=kind==='pitching'?{投球回:'INNINGS_PITCHED',投球数:'PITCHES_THROWN',被安打:'HITS_ALLOWED',自責点:'EARNED_RUNS',失点:'RUNS_ALLOWED',与四球:'WALKS_ALLOWED',奪三振:'STRIKEOUTS_THROWN'}:{打数:'AT_BATS',得点:'RUNS',安打:'HITS',打点:'RBIS',本塁打:'HOME_RUNS',四球:'WALKS',三振:'STRIKEOUTS'};
   for(const row of rows){const name=row[headers.indexOf('選手名')];if(!name||name==='合計')continue;const stats=Object.fromEntries(Object.entries(mappings).map(([label,key])=>[key,numberOrNull(row[headers.indexOf(label)])]));const person={id:null,name,stats};if(kind==='pitching'){person.pitchCount=integerOrNull(stats.PITCHES_THROWN);person.outsRecorded=inningsToOuts(stats.INNINGS_PITCHED);}g[kind][side].push(person);}}
 }
 g.warnings.push('provider_update_time_not_supplied','bso_and_bases_not_verified');return validateGame(g);
}
async function attempt(errors,fn){try{return await fn();}catch(e){errors.push(String(e.message));return null;}}
export async function collectLeague(league,{date=dayInTaipei(),fetcher=fetch}={}){
 assert(['NPB','KBO','CPBL'].includes(league),'Unknown league');assert(/^\d{4}-\d{2}-\d{2}$/.test(date),'Invalid date');const games=[],errors=[];const get=url=>fetchPublic(url,fetcher);
 if(league==='KBO'){
  const root='https://api-gw.sports.naver.com',page=await get(root+'/schedule/games?'+new URLSearchParams({upperCategoryId:'kbaseball',fromDate:date,toDate:date,page:'1',pageSize:'100'}));const j=JSON.parse(page.text);assert(j.success===true&&Array.isArray(j.result?.games),'KBO schedule malformed');const found=j.result.games.filter(x=>x.categoryId==='kbo'&&KBO[x.homeTeamCode]&&KBO[x.awayTeamCode]);
  for(const row of found){const g=await attempt(errors,async()=>{assert(/^[A-Za-z0-9]+$/.test(row.gameId),'Invalid KBO ID');const p=await get(root+'/schedule/games/'+row.gameId+'/game-polling');const r=JSON.parse(p.text);assert(r.success===true&&r.result?.game?.gameId===row.gameId,'KBO detail identity conflict');return parseKbo(r.result.game,p,r.result.textRelayData);});if(g)games.push(g);}
 }else if(league==='CPBL'){
  const candidates=new Map();for(const name of ['富邦','統一','台鋼','中信','樂天','味全']){await attempt(errors,async()=>{const p=await get('https://tw.sports.yahoo.com/cpbl/teams/'+encodeURIComponent(name)+'/');for(const x of yahooObjects(p.text)){if(/^cpbl\.g\.\d{9}$/.test(x.gameId)&&x.startTime&&CPBL[x.homeTeamId]&&CPBL[x.awayTeamId]&&dayInTaipei(new Date(x.startTime))===date){const url=x.alias?.url;if(typeof url==='string'&&/^https:\/\/tw\.sports\.yahoo\.com\/cpbl\/[^/]+-\d{9}\/$/.test(url))candidates.set(x.gameId,url);}}});}
  assert(candidates.size||errors.length===0,'CPBL schedule unavailable');for(const [id,url] of candidates){const g=await attempt(errors,async()=>{const p=await get(url);const choices=yahooObjects(p.text).filter(x=>x.gameId===id&&x.playerStats&&CPBL[x.homeTeamId]&&CPBL[x.awayTeamId]);assert(choices.length,'CPBL full game payload missing');return parseCpbl(choices.at(-1),p);});if(g)games.push(g);}
 }else{
  const page=await get('https://baseball.yahoo.co.jp/npb/schedule/?date='+date),ids=npbScheduleIds(page.text);assert(ids.length,'NPB no recognizable first-team fixtures; not proof of an off day');
  for(const id of ids){const g=await attempt(errors,async()=>{const root='https://baseball.yahoo.co.jp/npb/game/'+id,p=await get(root+'/score');let stats=null;try{stats=await get(root+'/stats');}catch(e){errors.push(`${id}:stats ${e.message}`);}return parseNpb(p.text,stats?.text||'',id,p);});if(g&&g.date===date)games.push(g);else if(g)errors.push(`${id}:date_conflict:${g.date}`);}
 }
 const unique=new Map(games.map(g=>[g.key,g]));return {schemaVersion:1,league,date,collectedAt:new Date().toISOString(),games:[...unique.values()],errors,status:errors.length?'partial':'ok',liveLatencyVerified:false};
}
