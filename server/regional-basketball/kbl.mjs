const BASE = 'https://api.kbl.or.kr';
const WEB = 'https://www.kbl.or.kr';
const HEADERS = {Accept:'application/json', Channel:'WEB', TeamCode:'XX', 'X-Requested-With':'XMLHttpRequest', lang:'ko', Origin:WEB, Referer:WEB+'/'};
const TEAMS = {'06':'KT','10':'MOB','16':'DB','35':'SAM','50':'LG','55':'SK','60':'KCC','64':'KOG','66':'SON','70':'JJK'};
const VENUES = {'창원체육관':'昌原體育館','원주DB프로미아레나':'原州 DB 體育館','수원 KT 소닉붐 아레나':'水原 KT 音速彈體育館','잠실학생체육관':'蠶室學生體育館','울산동천체육관':'蔚山東川體育館','안양 정관장 아레나':'安養正官庄體育館','고양 소노 아레나':'高陽索諾體育館','부산 사직실내체육관':'釜山社稷室內體育館','대구체육관':'大邱體育館','잠실실내체육관':'蠶室室內體育館'};
const ACTION = {'001':'本節開始','002':'比賽中斷','003':'暫停','009':'本節結束','010':'調整比賽時間','101':'換上場','102':'換下場','201':'兩分命中','202':'兩分出手','203':'罰球命中','204':'罰球出手','205':'三分命中','206':'三分出手','207':'灌籃命中','208':'灌籃出手','209':'進攻籃板','210':'防守籃板','211':'助攻','212':'抄截','213':'阻攻','214':'失誤','215':'罰球犯規','216':'犯規','217':'球隊快攻','218':'團隊籃板','219':'違例','221':'成功防守','223':'團隊失誤','224':'其他犯規','225':'團隊犯規','226':'掩護助攻','227':'撥球','228':'影片判讀','229':'教練挑戰'};

async function api(path) {
  const response = await fetch(BASE + path, {headers:HEADERS, signal:AbortSignal.timeout(11000)});
  if (!response.ok) throw new Error('KBL '+response.status+' '+path.split('?')[0]);
  return response.json();
}
function validateId(id) {
  if (!/^S\d+G\d+N\d+$/.test(id)) throw new Error('KBL 賽事識別碼錯誤');
}
function validateDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(Date.parse(day)) || new Date(day).toISOString().slice(0,10) !== day) throw new Error('日期格式錯誤');
  return day;
}
function dayAfter(day) {
  return new Date(Date.parse(day)+86400000).toISOString().slice(0,10);
}
function num(value) {return value===null || value===undefined || value==='' || !Number.isFinite(Number(value)) ? null : Number(value);}
function team(code) {return TEAMS[String(code).padStart(2,'0')];}
function periodLabel(period) {return typeof period==='string' && /^(X|EQ)\d+$/.test(period) ? 'OT'+period.match(/\d+/)[0] : period || null;}
function makeGame(row) {
  const dateKst=String(row.gameDate);
  if (!/^\d{8}$/.test(dateKst) || !/^\d{4}$/.test(row.gameStart)) throw new Error('KBL 日期或開賽時間不完整');
  const timeKst=String(row.gameStart);
  const start=new Date(dateKst.slice(0,4)+'-'+dateKst.slice(4,6)+'-'+dateKst.slice(6,8)+'T'+timeKst.slice(0,2)+':'+timeKst.slice(2)+':00+09:00');
  const local=new Date(start.getTime()+8*3600000).toISOString();
  const date=local.slice(0,10),time=local.slice(11,16);
  const id=row.gmkey;
  validateId(id);
  const home=team(row.tcodeH),away=team(row.tcodeA);
  if (!home || !away) throw new Error('KBL 隊碼未對照');
  const status=Number(row.isEnded)===1?'final':Number(row.isStarted)===1?'in_progress':'scheduled';
  const page=status==='scheduled'?'preview/'+dateKst+'/'+id:'record/'+id+'/'+dateKst;
  return {id,date,time,startsAt:date+'T'+time+':00+08:00',home,away,homeScore:status==='scheduled'?null:num(row.scoreH),awayScore:status==='scheduled'?null:num(row.scoreA),status,period:status==='in_progress' && row.playingQuarter!=='X'?periodLabel(row.playingQuarter):null,clock:null,periods:[],category:row.seasonCategory || ({'01':'R','14':'OM'})[row.gameCode] || null,categoryName:row.seasonCategoryName || null,season:row.seasonName1 ||row.seasonName,venue:VENUES[row.stadiumnameF] || row.stadiumnameEn || row.stadiumnameF || row.stadiumname,url:WEB+'/match/'+page};
}
async function list(from,to) {
  validateDay(from);validateDay(to);
  if (from>to) throw new Error('日期範圍錯誤');
  const query=new URLSearchParams({fromDate:from.replaceAll('-',''),toDate:dayAfter(to).replaceAll('-',''),tcodeList:'all'});
  const raw=await api('/match/list?'+query);
  if (!Array.isArray(raw)) throw new Error('KBL 賽程回應格式錯誤');
  return raw.filter(g=>g.seasonCategory==='R' || g.seasonCategory==='PO').map(makeGame).filter(g=>g.date>=from && g.date<=to).sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
}
async function ranking(){
  const rows=await api('/league/rank/team');
  if (!Array.isArray(rows) || rows.length===0) throw new Error('KBL 排名資料無法取得');
  return rows.map(r=>({team:team(r.tcode),rank:r.rank,wins:r.win,losses:r.loss,homeWins:r.hwin,homeLosses:r.hloss,awayWins:r.awin,awayLosses:r.aloss,gamesBehind:r.winDiff,winStreak:r.contiWin,lossStreak:r.contiLoss})).filter(r=>r.team);
}
function quarterScores(info) {
  const h=info.teamrecords?.home,a=info.teamrecords?.away;
  if(!h||!a)return [];
  const period=info.game.playingQuarter;
  const regulation=Number(info.game.isEnded)===1 || /^(X|EQ)\d+$/.test(period) ? 4 : Number(/^Q([1-4])$/.exec(period)?.[1]??0);
  const periods=[];
  for(let q=1;q<=regulation;q++) periods.push({label:'Q'+q,home:num(h['scoreq'+q]),away:num(a['scoreq'+q])});
  for(let i=0;i<Math.max(h.scoreeq?.length||0,a.scoreeq?.length||0);i++) periods.push({label:'OT'+(i+1),home:num(h.scoreeq?.[i]),away:num(a.scoreeq?.[i])});
  return periods;
}
function timeLeft(row) {
  const m=num(row?.m),s=num(row?.s);
  return m!==null && s!==null && m>=0 && s>=0 && s<60 ? m+':'+String(s).padStart(2,'0') : null;
}
function playRows(raw) {
  if(!Array.isArray(raw))return [];
  return raw.filter(event=>Boolean(ACTION[event.a])).map(event=>({
    seq:event.n,period:periodLabel(event.q),clock:timeLeft(event),team:event.t?team(event.t):null,
    text:[event.e || event.p,ACTION[event.a]].filter(Boolean).join('・')
  })).sort((a,b)=>b.seq-a.seq);
}
function quarterTotal(periods,side){
  return periods.length && periods.every(q=>Number.isFinite(q[side]))?periods.reduce((total,q)=>total+q[side],0):null;
}
function teamBox(r) {
  if(!r)return null;
  const to=num(r.to),teamTo=num(r.tto);
  return {points:num(r.score),fga:num(r.fgtA),fgm:num(r.fgt),threeMade:num(r.threep),threeAttempted:num(r.threepA),fta:num(r.ftA),ftm:num(r.ft),oreb:num(r.offr),turnovers:to!==null&&teamTo!==null?to+teamTo:null,reb:num(r.rb),ast:num(r.ast),stl:num(r.stl),blk:num(r.bs),dreb:num(r.defr),fouls:num(r.foul)};
}
function pairBoxes(rows,home,away) {
  const pick=code=>teamBox(Array.isArray(rows)?rows.find(r=>team(r.tcode)===code)?.records:null);
  return {home:pick(home),away:pick(away)};
}
function playerBox(row){
  const p=row.player,r=row.records,minutes=num(r.playMin),seconds=num(r.playSec);
  return {id:String(p.pcode),name:p.ename||p.pname,native:p.pname,number:p.backNum,starter:Number(row.startFlag)===1,minutes:minutes!==null&&seconds!==null?minutes+':'+String(seconds).padStart(2,'0'):null,pts:num(r.score),reb:num(r.rb),ast:num(r.ast),stl:num(r.stl),blk:num(r.bs),turnovers:num(r.to),fgm:num(r.fgt),fga:num(r.fgtA),threeMade:num(r.threep),threeAttempted:num(r.threepA),ftm:num(r.ft),fta:num(r.ftA)};
}
async function latest(id,allPeriods=false){
  const query=allPeriods?'?quarterList=Q1,Q2,Q3,Q4,X1,X2,X3,X4,X5,X6,X7,X8':'';
  const [info,events]=await Promise.all([api('/match/'+id),api('/match/'+id+'/text-cast'+query).catch(()=>null)]);
  if(!info.game || info.game.gmkey!==id)throw new Error('KBL 賽事明細回應錯誤');
  const periods=quarterScores(info),plays=playRows(events);
  const period=periodLabel(info.game.playingQuarter);
  const clock=Number(info.game.isEnded)===0&&plays[0]?.period===period?plays[0].clock:null;
  return {info,periods,plays,clock};
}
export async function getKblFeed(day) {
  const [games,standingResult]=await Promise.all([list(day,day),ranking().catch(()=>null)]);
  await Promise.all(games.filter(g=>g.status!=='scheduled').map(async game=>{
    try {
      const detail=await latest(game.id);
      const {periods,plays,clock,info}=detail;
      const h=quarterTotal(periods,'home'),a=quarterTotal(periods,'away');
      // League endpoints refresh independently. Never replace a newer aggregate with an older quarter snapshot.
      const consistent=h!==null && a!==null && h>=(game.homeScore??0) && a>=(game.awayScore??0);
      if(consistent){game.homeScore=h;game.awayScore=a;game.periods=periods;}
      else if(game.status==='in_progress' && periods.length) {
        // The standings service can publish aggregate points ahead of the detailed feed.
        // Keep completed quarters while withholding the temporarily inconsistent active one.
        game.periods=periods.filter(q=>q.label!==game.period);
      }
      if(Number(info.game.isEnded)===1){game.status='final';game.period=null;}
      if(game.status==='in_progress'){game.period=periodLabel(info.game.playingQuarter)||game.period;game.clock=clock;}
      game.plays=plays.slice(0,12);
    } catch {game.detailAvailable=false;}
  }));
  return {league:'KBL',date:day,asOf:new Date().toISOString(),source:WEB+'/match/schedule',standingsSource:WEB+'/match/team-ranking',standings:standingResult,games};
}
export async function getKblHistory(from,to){
  return (await list(from,to)).filter(g=>g.status==='final' && g.category==='R' && g.homeScore!==null && g.awayScore!==null);
}
function periodNumber(value) {
  const match=/^(Q|OT|X|EQ)(\d+)$/.exec(value);
  return match ? Number(match[2]) + (match[1]==='Q' ? 0 : 4) : 0;
}

function pct(made,attempted) {
  return made!==null && attempted>0 ? Math.round(1000*made/attempted)/10 : null;
}

const ADVANCED = {offRating:'offrtg',defRating:'defrtg',netRating:'netrtg',efgPct:'efgRt',tsPct:'tsRt',astPct:'astRt',astTo:'astTo',astRatio:'astRatio',orebPct:'orebRt',drebPct:'drebRt',rebPct:'rebRt',usagePct:'usgRt',pace:'pace',turnoverPct:'tovRt',possessions:'poss',per:'per',pie:'pie'};
function advanced(r,available) {
  return Object.fromEntries(Object.entries(ADVANCED).map(([key,source])=>[key,available ? num(r?.[source]) : null]));
}

function detailedBox(row,side,game,base) {
  const r=row.records,p=row.player;
  const seconds=num(r.playMin)!==null && num(r.playSec)!==null ? r.playMin*60+r.playSec : null;
  const appeared=seconds>0 || Number(row.startFlag)===1 || ['inout','inout1','score','rb','ast','stl','bs','foul','to','fgtA','ftA'].some(k=>Number(r[k])>0);
  const status=appeared?'played':seconds===null?'unknown':game.status==='final'?'dnp':'not_yet_played';
  const plus=num(r.marginCn);
  const hasAdvanced=appeared && (game.status==='final' || (plus!==null && plus!==999 && Object.values(ADVANCED).some(k=>Number(r[k])>0)));
  return {...base,team:game[side],side,position:({GD:'G',FD:'F',C:'C'})[p.pos]||p.pos||null,seconds,played:appeared,dnp:status==='dnp',status,
    plusMinus:appeared && plus!==999 ? plus : null,oreb:num(r.offr),dreb:num(r.defr),fouls:num(r.foul),twoMade:num(r.fg),twoAttempted:num(r.fgA),paintMade:num(r.pp),paintAttempted:num(r.ppA),dunks:num(r.dk),
    fgPct:pct(base.fgm,base.fga),threePct:pct(base.threeMade,base.threeAttempted),ftPct:pct(base.ftm,base.fta),advanced:advanced(r,hasAdvanced),
    url:WEB+'/player/player/'+p.pcode};
}

function detailedTeam(pair,game,side) {
  const row=pair?.find(r=>team(r.tcode)===game[side])?.records;
  if(!row)return null;
  const base=teamBox(row);
  const hasAdvanced=game.status==='final' || Number(row.poss)>0;
  return {...base,team:game[side],fgPct:pct(base.fgm,base.fga),threePct:pct(base.threeMade,base.threeAttempted),ftPct:pct(base.ftm,base.fta),
    twoMade:num(row.fg),twoAttempted:num(row.fgA),paintMade:num(row.pp),paintAttempted:num(row.ppA),dunks:num(row.dk),
    fastBreakPoints:num(row.fbScoreCn),secondChancePoints:num(row.secChanceScoreCn),pointsOffTurnovers:num(row.turnoverScoreCn),benchPoints:num(row.benchScoreCn),largestLead:num(row.maxLeadScoreCn),longestScoringRun:num(row.maxContiScoreCn),leadSeconds:num(row.scoreHighTimeCn),teamRebounds:num(row.teamR),teamTurnovers:num(row.tto),
    advanced:advanced(row,hasAdvanced)};
}

function completeEvents(events,players,game,staffNames) {
  if(!Array.isArray(events))return [];
  const identities=new Map();
  for(const p of [...players.home,...players.away]){
    for(const name of new Set([p.native,p.name].filter(Boolean))){
      const key=p.team+'|'+name;
      identities.set(key,identities.has(key) && identities.get(key)!==p.id?null:p.id);
    }
  }
  const plays=[];
  let homeScore=0,awayScore=0;
  const sorted=[...events].sort((a,b)=>periodNumber(a.q)-periodNumber(b.q) || Number(a.n)-Number(b.n));
  for(const e of sorted){
    const who=team(e.t)||null,action=String(e.a);
    const points=({'201':2,'203':1,'205':3,'207':2})[action]||0;
    if(who===game.home)homeScore+=points;
    if(who===game.away)awayScore+=points;
    const person=e.e||e.p||null,period=periodLabel(e.q);
    const playerId=identities.get(who+'|'+e.p)||identities.get(who+'|'+e.e)||null;
    const actorType=playerId?'player':staffNames.has(who+'|'+e.p)?'coach':person?'official_actor':null;
    plays.push({id:game.id+'-'+period+'-'+e.n,seq:e.n,period,clock:timeLeft(e),team:who,
      action,points,homeScore,awayScore,playerId,actor:person,actorType,
      text:[person,ACTION[action]||('官方事件 '+action)].filter(Boolean).join('・'),foulCode:e.f||null,substitutionCode:e.c||null});
  }
  return plays.reverse();
}

export function normalizeKblDetail(info,teamRows,playerRows,events,asOf=new Date().toISOString()) {
  const game=makeGame(info.game);
  const players={home:[],away:[]};
  for(const row of playerRows||[]){
    const side=String(row.homeAway)==='1'?'home':String(row.homeAway)==='2'?'away':null;
    if(side && row.records && row.player?.pcode) players[side].push(detailedBox(row,side,game,playerBox(row)));
  }
  const staffNames=new Set();
  for(const side of ['home','away']){
    const staff=info.teams?.[side]?.staffs;
    for(const person of [staff?.manager,...(staff?.coaches||[])]) if(person?.name) staffNames.add(game[side]+'|'+person.name);
  }
  const plays=completeEvents(events,players,game,staffNames);
  const newest=plays[0],live=game.status==='in_progress';
  const period=live && periodNumber(newest?.period)>periodNumber(game.period)?newest.period:game.period;
  const infoWithPeriod=period===game.period?info:{...info,game:{...info.game,playingQuarter:period?.replace(/^OT/,'X')}};
  const periods=game.status==='scheduled'?[]:quarterScores(infoWithPeriod);
  const teamStats={home:detailedTeam(teamRows,game,'home'),away:detailedTeam(teamRows,game,'away')};
  const homeScore=quarterTotal(periods,'home')??teamStats.home?.points??null;
  const awayScore=quarterTotal(periods,'away')??teamStats.away?.points??null;
  const clock=live && newest?.period===period?newest.clock:null;
  const scoringVerified=Boolean(newest) && newest.homeScore===homeScore && newest.awayScore===awayScore;
  const periodScore=label=>plays.find(p=>p.period===label);
  let previousHome=0,previousAway=0;
  const quartersVerified=periods.length>0 && periods.every(q=>{
    const last=periodScore(q.label);
    if(!last || last.homeScore-previousHome!==q.home || last.awayScore-previousAway!==q.away)return false;
    previousHome=last.homeScore;previousAway=last.awayScore;return true;
  });
  const boxVerified=players.home.length>0 && players.away.length>0 && ['home','away'].every(s=>{
    const expected=s==='home'?homeScore:awayScore;
    return teamStats[s]?.points===expected && players[s].reduce((a,p)=>a+(p.pts??0),0)===expected;
  });
  return {...game,homeScore,awayScore,asOf,period,periods,clock,plays,teamStats,players,
    minutes:game.status==='final'&&periods.length>=4?40+5*(periods.length-4):null,crowd:num(info.game.crowds),source:game.url,
    sourceChecks:{playByPlayScore:scoringVerified,periodScores:quartersVerified,playerAndTeamScore:boxVerified},
    officialEndpoints:{info:BASE+'/match/'+game.id,team:BASE+'/match/'+game.id+'/team-record',players:BASE+'/match/'+game.id+'/player-stat',plays:BASE+'/match/'+game.id+'/text-cast'}};
}

export async function getKblDetail(id) {
  validateId(id);
  const path='/match/'+id;
  const periods='Q1,Q2,Q3,Q4,X1,X2,X3,X4,X5,X6,X7,X8,EQ1,EQ2,EQ3,EQ4,EQ5,EQ6,EQ7,EQ8';
  async function snapshot(stamp) {
    const url=s=>s+(stamp ? (s.includes('?')?'&':'?')+'_='+stamp : '');
    const [info,teams,players,events]=await Promise.all([api(url(path)),api(url(path+'/team-record')).catch(()=>null),api(url(path+'/player-stat')).catch(()=>null),api(url(path+'/text-cast?quarterList='+periods)).catch(()=>null)]);
    if(info.game?.gmkey!==id) throw new Error('KBL 官方賽事識別碼不符');
    if(!info.game.isStarted) return normalizeKblDetail(info,teams,players,events);
    if(!Array.isArray(teams)||!Array.isArray(players)||!Array.isArray(events)) throw new Error('KBL 官方比賽詳細資料不完整');
    return normalizeKblDetail(info,teams,players,events);
  }
  let detail=await snapshot('');
  if(detail.status==='scheduled' || Object.values(detail.sourceChecks).every(Boolean))return detail;
  // The KBL feeds are cached independently. Re-read them on the same fresh cache key before accepting an inconsistent score sheet.
  detail=await snapshot(String(Date.now()));
  if(!Object.values(detail.sourceChecks).every(Boolean))throw new Error('KBL 官方逐節／逐球／箱分仍在同步');
  return detail;
}

export async function getKblBox(id){
  validateId(id);
  const [info,rows]=await Promise.all([api('/match/'+id),api('/match/'+id+'/team-record')]);
  if(!info.game || info.game.gmkey!==id) throw new Error('KBL 賽事識別碼不同');
  if(Number(info.game.isEnded)!==1)return null;
  const game=makeGame(info.game),stats=pairBoxes(rows,game.home,game.away),periods=quarterScores(info);
  if(periods.length<4 || !stats.home || !stats.away)throw new Error('KBL 完賽箱分不完整');
  for(const side of ['home','away']){
    if(quarterTotal(periods,side)!==stats[side].points || ['points','fgm','fga','threeMade','threeAttempted','fta','ftm','oreb','turnovers'].some(key=>stats[side][key]===null))throw new Error('KBL 箱分校驗失敗');
  }
  return {id,date:game.date,time:game.time,home:game.home,away:game.away,minutes:40+5*(periods.length-4),homeStats:stats.home,awayStats:stats.away,source:game.url};
}
export async function getKblStandings(seasonEnd,phase=2) {
  const year=Number(seasonEnd),stage=Number(phase);
  if(!Number.isInteger(year)||year<1997||year>2100||![1,2,3].includes(stage))throw new Error('KBL 球季／階段無效');
  const result={league:'KBL',seasonEnd:year,phase:stage,source:WEB+'/match/team-ranking',asOf:new Date().toISOString(),available:false,standings:[]};
  if(stage===1)return {...result,note:'KBL 官方戰績榜未提供熱身賽排名。'};
  const seasons=await api('/season/list?seasonCategory=R&gameCode=01&seasonGrade=1');
  if(!Array.isArray(seasons))throw new Error('KBL 球季清單格式錯誤');
  const season=seasons.find(r=>r.seasonGrade===1 && r.seasonCategory==='R' && r.seasonName===String(year-1)+'-'+String(year));
  if(!season)return {...result,note:'官方尚無此球季資料。'};
  if(stage===3) {
    const url='/league/playoff/'+(Number(season.seasonCode)>=45?'new/':'')+season.glkey;
    // Before postseason the league responds with an empty success body.
    const response=await fetch(BASE+url,{headers:HEADERS,signal:AbortSignal.timeout(11000)});
    if(!response.ok)throw new Error('KBL 季後賽來源 '+response.status);
    const raw=await response.text();
    const bracketData=raw.trim()?JSON.parse(raw):null;
    const bracket=bracketData?.result;
    const series=[];
    for(let i=1;i<=5;i++) {
      const games=bracket?.['game'+i];
      if(!Array.isArray(games)||!games.length)continue;
      const played=games.filter(g=>g.scoreH!==null && g.scoreA!==null && g.scoreH!==undefined && g.scoreA!==undefined && g.scoreH!==g.scoreA && (g.homeWin===0 || g.homeWin===1));
      const home=team(games[0].tcodeH),away=team(games[0].tcodeA);
      if(!home||!away)continue;
      const wins=played.filter(g=>team(g.homeWin?g.tcodeH:g.tcodeA)===home).length;
      series.push({round:i<=2?'首輪':i<=4?'準決賽':'總冠軍賽',home,away,homeWins:wins,awayWins:played.length-wins,gamesPlayed:played.length});
    }
    // Older archives expose team win/loss rows per round rather than a list of games.
    if(bracketData?.poScheduleExist) {
      for(const [key,round] of [['sixResult','首輪'],['fourResult','準決賽'],['finalResult','總冠軍賽']]){
        const rows=bracketData[key] || [];
        const seen=new Set();
        for(const r of rows){
          if(seen.has(r.teamCode))continue;
          const matches=rows.filter(o=>o.teamCode!==r.teamCode&&!seen.has(o.teamCode)&&o.gameDate===r.gameDate&&o.win===r.loss&&o.loss===r.win);
          if(matches.length!==1)continue;
          const rival=matches[0];
          seen.add(r.teamCode);seen.add(rival.teamCode);
          series.push({round,home:team(r.teamCode)||r.teamCode,away:team(rival.teamCode)||rival.teamCode,homeWins:r.win,awayWins:rival.win,gamesPlayed:r.win+r.loss});
        }
      }
    }
    return {...result,series,note:series.length?'KBL 季後賽採系列賽制，官方提供系列戰果。':'該球季尚無官方季後賽戰果。'};
  }
  const rows=await api('/league/rank/'+season.glkey);
  if(!Array.isArray(rows))throw new Error('KBL 球季排名格式錯誤');
  const standings=rows.map(r=>({team:team(r.teamCode) || String(r.teamCode),sourceName:r.teamName2,rank:num(r.rank),wins:num(r.TWin),losses:num(r.TLoss),homeWins:num(r.hwin),homeLosses:num(r.hloss),awayWins:num(r.awin),awayLosses:num(r.aloss),gamesBehind:num(r.winDiff),winRate:num(r.winRate),winStreak:num(r.contiWin),lossStreak:num(r.contiLoss)}));
  return {...result,available:standings.length>0,standings,note:standings.length?'':'該球季尚無官方例行賽戰績。'};
}
