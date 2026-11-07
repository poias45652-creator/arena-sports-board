// International 40-minute basketball adapter for the site's basketball-efficiency model.
// All supplied games and boxes must belong to the indicated league. Times without an
// explicit offset use the dashboard's Taiwan dates. Probabilities are fractions [0,1].
const DAY = 86_400_000;
const DEFAULT_WEIGHTS = [20, 20, 20, 20, 20];
export const WEIGHT_LABELS = ['進攻效率','防守效率','三分命中率','罰球出手率','節奏'];
const fields = ['points','fga','fgm','threeMade','threeAttempted','fta','ftm','oreb','turnovers'];
const mean = xs => xs.reduce((n,x) => n+x, 0) / xs.length;
const variance = xs => { const avg=mean(xs); return mean(xs.map(x => (x-avg)**2)); };
const round = x => Math.round(10*x) / 10;
const teamCode = t => typeof t === 'object' && t ? t.code ?? t.id : t;
const hasTeam = (g,t) => teamCode(g.home) === t || teamCode(g.away) === t;
const state = g => g.status ?? g.state;
const leagueFits = (row,league) => !row.league || !league || row.league === league;
function timestamp(value) {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (!value) return NaN;
  return Date.parse(String(value));
}
function start(g) {
  return timestamp(g.startsAt || g.start ||
    (g.date && /^\d{2}:\d{2}(:\d{2})?$/.test(g.time) ?
      g.date+'T'+g.time+(g.time.length===5?':00':'')+'+08:00' : undefined));
}
function fixtureKey(g) {
  return JSON.stringify([start(g), teamCode(g.home), teamCode(g.away)]);
}
function weights(values=DEFAULT_WEIGHTS) {
  if (!Array.isArray(values) || values.length !== 5 ||
      values.some(x=>!Number.isFinite(x)||x<0||x>100)) throw Error('五項模型比例需介於 0 到 100');
  const total=values.reduce((n,x)=>n+x,0);
  if (total<=0) throw Error('模型比例總和必須大於 0');
  return values.map(x=>x/total);
}
function finalAtCutoff(g,cutoff,snapshotTime) {
  if (state(g)!=='final'||g.phase===1||g.phase==='preseason') return false;
  const tip=start(g);
  if (!Number.isFinite(tip)||tip>=cutoff||tip<cutoff-400*DAY) return false;
  if (!Number.isInteger(g.homeScore)||!Number.isInteger(g.awayScore)||
      Math.min(g.homeScore,g.awayScore)<=0||g.homeScore===g.awayScore) return false;
  const end=timestamp(g.endedAt||g.completedAt||g.finalAt);
  if (Number.isFinite(end)) return end>=tip && end<=cutoff;
  const observed=timestamp(g.finalObservedAt||g.observedAt||g.fetchedAt||snapshotTime);
  if (Number.isFinite(observed)&&observed>=tip&&observed<=cutoff) return true;
  // A final result without its finish timestamp cannot establish when it
  // was known during that same Taiwan day; use it from the next day onward.
  return Math.floor((tip+8*3600_000)/DAY) < Math.floor((cutoff+8*3600_000)/DAY);
}
function verifiedStats(s,points) {
  return s && fields.every(k=>Number.isInteger(s[k])&&s[k]>=0) &&
    s.points===points && s.fga>0 && s.fgm<=s.fga && s.ftm<=s.fta &&
    s.threeMade<=s.fgm && s.threeMade<=s.threeAttempted && s.threeAttempted<=s.fga &&
    s.oreb<=s.fga-s.fgm+s.fta-s.ftm && 2*s.fgm+s.threeMade+s.ftm===points;
}
function boxFor(g,boxes) {
  const b=boxes.get(fixtureKey(g));
  if (!b || !Number.isInteger(b.minutes)||b.minutes<40||(b.minutes-40)%5 || b.minutes>120 ||
      !verifiedStats(b.homeStats,g.homeScore)||!verifiedStats(b.awayStats,g.awayScore)) return null;
  const estimate = s => s.fga+.44*s.fta-s.oreb+s.turnovers;
  const possessions=(estimate(b.homeStats)+estimate(b.awayStats))/2;
  return possessions>0 ? {...b,possessions} : null;
}
function boxIndex(boxes,league) {
  const result=new Map();
  const signature=b=>JSON.stringify([b.minutes,...fields.flatMap(k=>[b.homeStats?.[k],b.awayStats?.[k]])]);
  for(const b of boxes) {
    if(!leagueFits(b,league)||!Number.isFinite(start(b))) continue;
    const k=fixtureKey(b);
    if(!result.has(k)) result.set(k,b);
    else if(result.get(k)&&signature(result.get(k))!==signature(b)) result.set(k,null);
  }
  return result;
}
function teamMetrics(rows,team,boxMap) {
  const data=rows.map(g=>boxFor(g,boxMap));
  if(data.some(b=>!b)) throw Error('近期已完賽場次的完整投籃、籃板、失誤或延長賽資料尚未齊全');
  let pts=0,opp=0,poss=0,min=0,threes=0,threeAttempts=0,fta=0,fga=0;
  const obs=data.map(b=>{
    const home=teamCode(b.home)===team;
    const s=home?b.homeStats:b.awayStats, o=home?b.awayStats:b.homeStats;
    pts+=s.points;opp+=o.points;poss+=b.possessions;min+=b.minutes;
    threes+=s.threeMade;threeAttempts+=s.threeAttempted;fta+=s.fta;fga+=s.fga;
    return [s.points/b.possessions*100,o.points/b.possessions*100,
      s.threeAttempted?s.threeMade/s.threeAttempted:null,s.fta/s.fga];
  });
  if(!threeAttempts||!fga||!poss||!min) throw Error('近期效率指標不足');
  return {games:rows.length,ortg:pts/poss*100,drtg:opp/poss*100,threePct:threes/threeAttempts,
    threeRate:threeAttempts/fga,ftRate:fta/fga,pace:poss/min*40,pointsFor:pts/rows.length,
    pointsAgainst:opp/rows.length,samples:{possessions:poss,threeAttempts,fieldGoalAttempts:fga,minutes:min},obs};
}
// Schedule strength uses recent pre-cutoff FINAL scores, excludes all games against
// the team being assessed, and weighs only opponents actually faced in this sample.
function scheduleStrength(team,rows,history) {
  const opponentNets=new Map();
  for (const g of rows) {
    const opponent=teamCode(g.home)===team?teamCode(g.away):teamCode(g.home);
    if (opponentNets.has(opponent)) continue;
    const own=history.filter(x=>hasTeam(x,opponent)&&!hasTeam(x,team)).slice(0,20);
    if (own.length < 3) return null;
    opponentNets.set(opponent,mean(own.map(x=>(teamCode(x.home)===opponent?1:-1)*(x.homeScore-x.awayScore))));
  }
  return mean(rows.map(g=>opponentNets.get(teamCode(g.home)===team?teamCode(g.away):teamCode(g.home))));
}
function weightedProjection(h,a,hw,aw,neutral) {
  const hs=[h.ortg,h.drtg,h.threePct,h.ftRate],as=[a.ortg,a.drtg,a.threePct,a.ftRate];
  let adjustment=0;
  for(let i=0;i<4;i++) {
    const sample=[...h.obs,...a.obs].map(r=>r[i]).filter(Number.isFinite);
    if(!sample.length) continue;
    const sd=Math.sqrt(variance(sample));
    if(sd<=1e-9) continue;
    const center=mean(sample),direction=i===1?-1:1;
    adjustment+=4*direction*(hw[i]*(hs[i]-center)-aw[i]*(as[i]-center))/sd;
  }
  const pace=(h.pace*(1+(hw[4]-.2)*.1)+a.pace*(1+(aw[4]-.2)*.1))/2;
  const home=((h.ortg+a.drtg)/2+(neutral?0:2.5))*pace/100+adjustment;
  const away=((a.ortg+h.drtg)/2)*pace/100-adjustment;
  return {home,away,pace,adjustment};
}
function simulate(margin,identity) {
  let seed=2166136261;
  for (const c of identity){seed^=c.charCodeAt(0);seed=Math.imul(seed,16777619);}
  const uniform=()=>{
    seed|=0;seed=seed+0x6D2B79F5|0;
    let t=Math.imul(seed^seed>>>15,1|seed);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
  let wins=0;const margins=[];
  for(let n=0;n<5000;n++){
    const z=Math.sqrt(-2*Math.log(Math.max(Number.EPSILON,uniform())))*Math.cos(2*Math.PI*uniform());
    for(const value of [margin+10.5*z,margin-10.5*z]){
      margins.push(value);
      if(value>0)wins++;else if(value===0)wins+=.5;
    }
  }
  margins.sort((x,y)=>x-y);
  return {homeProb:wins/10000,awayProb:1-wins/10000,iterations:10000,
    marginP10:margins[999],marginP50:(margins[4999]+margins[5000])/2,marginP90:margins[8999]};
}
function taiwanDay(t) {
  return new Date(t+8*3600_000).toISOString().slice(0,10);
}
function knownInjuries(injuries,game,cutoff) {
  if(!Array.isArray(injuries))return [];
  const day=taiwanDay(start(game));
  const relevant=injuries.filter(r=>r&&hasTeam(game,teamCode(r.team??r.teamCode??r.teamId))&&
    leagueFits(r,game.league)&&(!r.gameId||r.gameId===game.id)&&
    Array.isArray(r.appliesToDates)&&r.appliesToDates.includes(day)&&
    (r.url||r.sourceUrl)&&(!r.expiresAt||timestamp(r.expiresAt)>cutoff));
  return relevant.flatMap(r=>{
    const published=r.publishedAt||r.reportedAt||r.sourceUpdatedAt;
    if(!published)return [];
    // Date-only publication can be displayed as dated reporting but may not be
    // used numerically on the same day absent an exact pre-cutoff retrieval time.
    const dayOnly=/^\d{4}-\d{2}-\d{2}$/.test(published);
    if(dayOnly?published>taiwanDay(cutoff):!(timestamp(published)<=cutoff))return [];
    const seen=timestamp(r.checkedAt||r.retrievedAt);
    const timely=!dayOnly||published<taiwanDay(cutoff)||(Number.isFinite(seen)&&seen<=cutoff);
    return [{...r,applied:false,numericTimeConfirmed:timely}];
  });
}
function nameKey(s) {
  return typeof s==='string'?s.normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,''):'';
}
function playedMinutes(v) {
  if(typeof v==='number')return v;
  if(/^\d{1,2}:\d{2}$/.test(v)){
    const [m,s]=v.split(':').map(Number);
    return s<60?m+s/60:NaN;
  }
  return /^\d+(\.\d+)?$/.test(v)?Number(v):NaN;
}
function rotationChange(team,roster,rows,boxes,reports,cutoff) {
  if(!reports.length)return 0;
  for(const r of reports)r.adjustmentReason=r.status==='confirmed_out'?'待核對球員身分、近期上場與輪替':'傷情未確認缺陣，僅列示';
  if(!Array.isArray(roster)||!roster.length)return 0;
  const played=roster.map(p=>{
    const logs=Array.isArray(p.gameLog)?p.gameLog:[];
    const byGame=rows.map(g=>{
      const date=g.date||taiwanDay(start(g)),opponent=teamCode(g.home)===team?teamCode(g.away):teamCode(g.home);
      const matches=logs.filter(x=>x.date===date&&x.team===team&&x.opp===opponent&&(x.url||x.sourceUrl));
      if(matches.length!==1)return null;
      const x=matches[0],min=playedMinutes(x.minutes??x.min);
      if(!Number.isFinite(min)||min<=0||!Number.isInteger(x.pts)||x.pts<0)return null;
      const duration=boxes.get(fixtureKey(g))?.minutes;
      if(!duration||min>duration+.01)return null;
      return {min,scaledMin:min*40/duration,pts:x.pts};
    });
    const games=byGame.filter(Boolean);
    const min=games.reduce((n,x)=>n+x.min,0),points=games.reduce((n,x)=>n+x.pts,0);
    return {p,games:games.length,expected:byGame.reduce((n,x)=>n+(x?.scaledMin||0),0)/rows.length,
      rate:min?points/min:0,recent:byGame.slice(0,2).some((x,i)=>x&&cutoff-start(rows[i])<=7*DAY),byGame};
  });
  const excluded=new Map();
  for(const r of reports) {
    if(r.status!=='confirmed_out')continue;
    if(!r.numericTimeConfirmed){r.adjustmentReason='來源未給可驗證的賽前發布時分，僅列示';continue;}
    const playerId=r.playerId??r.athleteId,needle=nameKey(r.player||r.playerName);
    const matches=played.filter(({p})=>playerId!=null?String(p.id)===String(playerId):
      needle&&[p.name,p.native,p.en].some(n=>nameKey(n)===needle));
    if(matches.length!==1){r.adjustmentReason='傷情報告與當隊名冊無法唯一對應';continue;}
    const row=matches[0];
    if(!row.recent){r.adjustmentReason='近兩場或七天內沒有可核實的上場紀錄，避免重複扣分';continue;}
    if(!Number.isFinite(row.p.min)||row.p.min<=0||!Number.isFinite(row.p.pts)||row.p.pts<0||
        !Number.isInteger(row.p.gp)||row.p.gp<8||row.games<8){
      r.adjustmentReason='過往正式賽的球員分鐘與得分樣本不足八場';continue;
    }
    if(excluded.has(row.p.id)){r.adjustmentReason='同一球員缺陣已列入';continue;}
    excluded.set(row.p.id,{row,report:r});
  }
  if(!excluded.size)return 0;
  // Use the actual minutes of the eligible part of the rotation. Players without
  // measured production keep their existing share of the 200 regulation minutes.
  const regulars=played.filter(r=>r.recent&&r.games>=8&&r.expected>0);
  const coverage=mean([0,1].map(i=>regulars.reduce((n,r)=>n+(r.byGame[i]?.scaledMin||0),0))) / 200;
  const affected=[...excluded.values()];
  const skip=msg=>{affected.forEach(x=>{x.report.adjustmentReason=msg;});return 0;};
  if(coverage<.75)return skip('最近兩場有足夠樣本的現役輪替分鐘覆蓋未達 75%');
  const replacements=regulars.filter(r=>!excluded.has(r.p.id)).map(r=>({...r,add:0}));
  let remaining=affected.reduce((n,x)=>n+x.row.expected,0);
  // Same minutes-proportional allocation and individual 40-minute ceiling as
  // the site's rotation allocator; only reallocate measured missing minutes.
  for(let pass=0;remaining>1e-7&&pass<=replacements.length;pass++){
    const pool=replacements.filter(r=>r.expected+r.add<40-1e-8);
    const weight=pool.reduce((n,r)=>n+r.expected,0);
    if(!weight)break;
    let used=0;for(const r of pool){const n=Math.min(40-r.expected-r.add,remaining*r.expected/weight);r.add+=n;used+=n;}
    remaining-=used;
  }
  if(remaining>1e-5)return skip('可核實替補人手無法分配缺陣分鐘');
  const lost=affected.reduce((n,x)=>n+x.row.expected*x.row.rate,0);
  const recovered=replacements.reduce((n,r)=>n+r.add*r.rate,0);
  for(const {row,report} of affected){
    report.applied=true;report.adjustmentReason='已確認缺陣，依近期實際得分／分鐘及可用輪替重分配';
    report.missingMinutes=row.expected;report.measuredPlayerGames=row.games;
  }
  return recovered-lost;
}
export function analyzeGame({game,games=[],boxes=[],homeWeights,awayWeights,injuries=[],rosters={},gamesAsOf,asOf=Date.now()}={}) {
  const unavailable=reason=>({ready:false,reason,homeProb:null,awayProb:null,homeScore:null,awayScore:null,
    total:null,margin:null,spreadSigma:null,totalSigma:null,homeMetrics:null,awayMetrics:null});
  if(!game||!Array.isArray(games)||!Array.isArray(boxes))return unavailable('賽程或技術統計來源不足');
  const cutoff=timestamp(asOf),tip=start(game),home=teamCode(game.home),away=teamCode(game.away);
  if(!home||!away||home===away||!Number.isFinite(tip)||!Number.isFinite(cutoff)||game.timeConfirmed===false)
    return unavailable('對戰身分或開賽時間尚未確認');
  if(!['scheduled','fixture'].includes(state(game)))return unavailable('限有確認開賽時間的賽前場次');
  if(tip<=cutoff||tip>cutoff+30*DAY)return unavailable('僅分析未來 30 天內尚未開賽的場次');
  try{
    const hw=weights(homeWeights),aw=weights(awayWeights);
    const rows=new Map();
    for(const g of games){
      if(!leagueFits(g,game.league)||!finalAtCutoff(g,cutoff,gamesAsOf))continue;
      const k=fixtureKey(g),prev=rows.get(k);
      if(prev&&(prev.homeScore!==g.homeScore||prev.awayScore!==g.awayScore))
        throw Error('相同賽事的完賽比分不一致');
      rows.set(k,g);
    }
    const history=[...rows.values()].sort((x,y)=>start(y)-start(x));
    const hr=history.filter(g=>hasTeam(g,home)).slice(0,20),ar=history.filter(g=>hasTeam(g,away)).slice(0,20);
    if(Math.min(hr.length,ar.length)<8)return unavailable('主客隊各需至少 8 場已核實的正式賽技術統計');
    if(Math.max(cutoff-start(hr[0]),cutoff-start(ar[0]))>210*DAY)return unavailable('近期比賽樣本超過 210 天');
    const index=boxIndex(boxes,game.league);
    const h=teamMetrics(hr,home,index),a=teamMetrics(ar,away,index);
    const hs=scheduleStrength(home,hr,history),as=scheduleStrength(away,ar,history);
    const opponentAdjustment=hs!==null&&as!==null?(hs-as)/2:0;
    const p=weightedProjection(h,a,hw,aw,!!game.neutral);
    const reports=knownInjuries(injuries,game,cutoff);
    const rotation=rosters?.teams??rosters??{};
    const homeInjuryPoints=rotationChange(home,rotation[home],hr,index,reports.filter(r=>teamCode(r.team??r.teamCode??r.teamId)===home),cutoff);
    const awayInjuryPoints=rotationChange(away,rotation[away],ar,index,reports.filter(r=>teamCode(r.team??r.teamCode??r.teamId)===away),cutoff);
    const hp=p.home+opponentAdjustment/2+homeInjuryPoints,ap=p.away-opponentAdjustment/2+awayInjuryPoints;
    if(!Number.isFinite(hp)||!Number.isFinite(ap)||Math.min(hp,ap)<=0)return unavailable('效率預估無效');
    const simulation=simulate(hp-ap,(game.league||'')+':'+fixtureKey(game)+':40min-v1');
    const combined=[...new Map([...hr,...ar].map(g=>[fixtureKey(g),g])).values()];
    const {obs:homeObs,...homeMetrics}=h,{obs:awayObs,...awayMetrics}=a;
    const homeScore=round(hp),awayScore=round(ap);
    return {ready:true,reason:'',...simulation,homeScore,awayScore,total:round(homeScore+awayScore),
      margin:round(homeScore-awayScore),spreadSigma:10.5,totalSigma:Math.sqrt(variance(combined.map(g=>g.homeScore+g.awayScore))),
      homeMetrics,awayMetrics,homeWeights:hw,awayWeights:aw,homeOpponentNet:hs,awayOpponentNet:as,
      opponentAdjusted:hs!==null&&as!==null,opponentAdjustment,projectedPace:p.pace,regulationMinutes:40,
      injuries:reports,injuryAdjustmentApplied:reports.some(r=>r.applied),homeInjuryPoints,awayInjuryPoints,asOf:new Date(cutoff).toISOString()};
  }catch(error){return unavailable(error.message);}
}
