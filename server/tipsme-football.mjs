const competitions = {
  'hkg.1': ['Hong Kong Premier League','Hong Kong Premier League (China)','Hong Kong China Premier League','Hong Kong Premier Division','HK Premier League','港超'],
  'eng.1': ['English Premier League','Premier League','England Premier League'],
  'esp.1': ['Spanish La Liga','La Liga','LaLiga','Spain Primera Liga','Spain La Liga'],
  'ita.1': ['Italian Serie A','Serie A','Italy Serie A'],
  'ger.1': ['German Bundesliga','Bundesliga','Germany Bundesliga'],
  'fra.1': ['French Ligue 1','Ligue 1','France Ligue 1'],
  'uefa.champions': ['UEFA Champions League','Champions League'],
  'uefa.europa': ['UEFA Europa League','Europa League'],
  'uefa.nations': ['UEFA Nations League','Nations League']
};
function name(value) {
  return String(value || '').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/\b(?:fc|cf|afc)\b/g,'').replace(/[^\p{L}\p{N}]/gu,'');
}
function sameClub(ref, team, league) {
  const aliases = [team.name,team.englishName];
  if (league==='hkg.1' && team.id==='ND') aliases.push('Golik North District','North District','北區');
  const names = aliases.map(name).filter(Boolean);
  return [ref?.name,ref?.nameOriginal].some(value => names.includes(name(value)));
}
function clock(value) {
  const minute = /^(\d{1,3})(?:['′’]?\+(\d{1,2}))?['′’]?$/.exec(String(value ?? '').trim());
  if (minute) return {order:Number(minute[1])*100+Number(minute[2]||0),label:minute[1]+(minute[2]?'+'+minute[2]:'')+'′'};
  if (/^(HT|half[ -]?time|中場休息|半場)$/i.test(value || '')) return {order:4599,label:'中場休息'};
  return null;
}
function pair(raw) {
  const m=/^(\d{1,3})\s*-\s*(\d{1,3})$/.exec(String(raw??'').trim());
  return m && [Number(m[1]),Number(m[2])];
}
function count(raw) { return /^\d{1,3}$/.test(String(raw??'')) ? Number(raw) : null; }
export function applyTipsmeLive(detail, rows, checkedAt) {
  const game=detail.game, leagues=competitions[game.league];
  if (!leagues || !['scheduled','pending','unknown','live'].includes(game.state)) return detail;
  const matches=rows.filter(row => row?.status==='live' && Date.parse(row.kickoffUtc)===Date.parse(game.start) &&
    [row.competition?.name,row.competition?.nameOriginal].some(value=>leagues.some(alias=>name(alias)===name(value))) &&
    sameClub(row.home,game.home,game.league) && sameClub(row.away,game.away,game.league));
  if (matches.length!==1) return detail;
  const row=matches[0], minute=clock(row.minute), nativeClock=clock(detail.pitch?.clock)||clock(game.statusLabel);
  if (!minute || (nativeClock && nativeClock.order>minute.order)) return detail;
  const score=pair(row.score?.current);
  // Preserve confirmed goals if this provider has yet to report them at the same minute.
  if (score && (!nativeClock || nativeClock.order===minute.order) &&
      ((game.homeScore!=null && score[0]<game.homeScore)||(game.awayScore!=null && score[1]<game.awayScore))) return detail;
  const corners=pair(row.corners);
  const values=new Map([
    ['角球',corners],
    ['紅牌',[count(row.homeCards?.red),count(row.awayCards?.red)]],
    ['黃牌',[count(row.homeCards?.yellow),count(row.awayCards?.yellow)]]
  ]);
  const stats=new Map(detail.stats.map(stat=>[stat.label,stat]));
  for (const [label,totals] of values) {
    if (!totals||totals.every(v=>v===null)) continue;
    const old=stats.get(label);
    stats.set(label,{key:old?.key||label,label,home:totals[0]??old?.home??'—',away:totals[1]??old?.away??'—'});
  }
  return {...detail,game:{...game,state:'live',statusName:minute.label==='中場休息'?'STATUS_HALFTIME':'STATUS_IN_PROGRESS',statusLabel:minute.label,
    homeScore:score?.[0]??game.homeScore,awayScore:score?.[1]??game.awayScore},
    stats:[...stats.values()],pitch:{...detail.pitch,clock:minute.label,updatedAt:checkedAt,delayed:false},fetchedAt:checkedAt};
}

let nextCheck=0, snapshot, pending;
async function liveList(key) {
  if (pending) return pending;
  if (Date.now()<nextCheck) return snapshot;
  pending=(async()=>{
    nextCheck=Date.now()+30000;
    try {
      const res=await fetch('https://api.tipsme.hk/v1/football/matches/live?locale=en',{
        headers:{Authorization:'Bearer '+key,Accept:'application/json'},cache:'no-store',signal:AbortSignal.timeout(4000)
      });
      if (!res.ok) {
        if (res.status===429) {
          const retry=res.headers.get('retry-after');
          const until=retry&&/^\d+$/.test(retry)?Date.now()+Number(retry)*1000:Date.parse(retry||'');
          nextCheck=Math.max(nextCheck,Number.isFinite(until)?until:Date.now()+60000);
        } else if (res.status===401 || res.status===403) nextCheck=Date.now()+300000;
        snapshot=null;
      } else {
        const body=await res.json();
        snapshot=Array.isArray(body?.data)?{rows:body.data,checkedAt:new Date().toISOString()}:null;
      }
    } catch { snapshot=null; }
    return snapshot;
  })().finally(()=>{pending=null;});
  return pending;
}
export async function withTipsmeLive(detail) {
  const key=process.env.TIPSME_API_KEY, game=detail?.game;
  if (!key||!game?.timeConfirmed||!competitions[game.league]||!['live','scheduled','pending','unknown'].includes(game.state)) return detail;
  const age=Date.now()-Date.parse(game.start);
  if (!Number.isFinite(age)||age<0||age>4*3600000) return detail;
  const list=await liveList(key);
  return list?applyTipsmeLive(detail,list.rows,list.checkedAt):detail;
}
