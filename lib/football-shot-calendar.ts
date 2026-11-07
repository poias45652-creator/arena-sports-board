import type {FootballGame, FootballLeague} from './football';
import type {ShotGame} from './football-shot-model';

export const isShotLeague = (league:string) => ['eng.1','esp.1','fra.1','ita.1','ger.1'].includes(league);
const DAY = 86_400_000;
export const utcMatchDay = (time:number) => Math.floor(time / DAY);
// Disciplinary and resumed fixtures, keyed by competition, season and ESPN IDs.
const irregular = new Set(['ita.1|2020|119|104','ger.1|2021|121|268','esp.1|2023|3747|93',
  'ita.1|2023|118|104','ger.1|2024|598|121','ita.1|2024|109|110','fra.1|2024|274|178']);
type CalendarGame = {id:string; key:string; start:number; home:string; away:string; scheduled:boolean; final:ShotGame|null};
export type ShotCalendar = {league:FootballLeague; year:number; games:CalendarGame[]};
function count(raw:unknown,max:number) {
  if (typeof raw !== 'number' && (typeof raw !== 'string' || !/^\d+$/.test(raw))) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
}
function onTarget(team:any) {
  if (!Array.isArray(team.statistics)) return null;
  const stats = (name:string) => team.statistics.filter((s:any) => s?.name === name);
  const shots = stats('shotsOnTarget'), totals = stats('totalShots');
  const n = shots.length === 1 ? count(shots[0].displayValue, 100) : null;
  const total = totals.length === 1 ? count(totals[0].displayValue, 100) : null;
  return n !== null && (totals.length === 0 || (total !== null && n <= total)) ? n : null;
}
export function parseShotCalendar(data:any, league:FootballLeague, year:number):ShotCalendar {
  if (!isShotLeague(league) || !data?.leagues?.some((l:any) => l.slug === league) ||
      !Array.isArray(data.events) || !data.events.length || data.events.length >= 1000) throw Error('聯賽年度射正來源不完整');
  const games:CalendarGame[] = [];
  const seen = new Set<string>(), keys = new Set<string>(), blocked = new Set<string>();
  for (const e of data.events) {
    const c = e?.competitions?.[0], start = Date.parse(c?.date ?? e?.date);
    if (!c || !Number.isFinite(start) || new Date(start).getUTCFullYear() !== year || c.neutralSite === true ||
      (e.league?.slug && e.league.slug !== league) || !Array.isArray(c.competitors) || c.competitors.length !== 2) continue;
    const notes = [e.season?.slug, ...(c.notes || []).map((n:any) => n.headline)].join(' ');
    if (/play.?off|relegation|qualifying|tie.?break|abandon|awarded|resum/i.test(notes)) continue;
    const h = c.competitors.find((v:any) => v.homeAway === 'home'), a = c.competitors.find((v:any) => v.homeAway === 'away');
    const home = String(h?.team?.id), away = String(a?.team?.id), id = String(e.id);
    if (![home,away,id].every(v => /^\d+$/.test(v)) || home === away || !Number.isInteger(e.season?.year)) continue;
    const key = [league,e.season.year,home,away].join('|');
    if (seen.has(id)) throw Error('年度來源含重複賽事識別碼');
    seen.add(id);
    if (keys.has(key)) blocked.add(key);
    keys.add(key);
    if (irregular.has(key)) continue;
    const type = (c.status || e.status)?.type;
    const hg = count(h.score?.value ?? h.score, 30), ag = count(a.score?.value ?? a.score, 30);
    const final = type?.name === 'STATUS_FULL_TIME' && type.state === 'post' && type.completed === true && hg !== null && ag !== null
      ? {day:utcMatchDay(start),home,away,hg,ag,ht:onTarget(h),at:onTarget(a)} : null;
    const scheduled = type?.name === 'STATUS_SCHEDULED' && type.state === 'pre' && (c.timeValid ?? e.timeValid) === true;
    games.push({id,key,start,home,away,scheduled,final});
  }
  return {league,year,games:games.filter(g => !blocked.has(g.key)).sort((a,b) => a.start-b.start || a.id.localeCompare(b.id))};
}
export function shotHistory(game:FootballGame, calendars:ShotCalendar[], now:number) {
  const start = Date.parse(game.start), year = new Date(start).getUTCFullYear();
  if (!isShotLeague(game.league) || game.neutral || !game.timeConfirmed || game.state !== 'scheduled' ||
      !Number.isFinite(now) || start <= now || calendars.length !== 2 ||
      calendars.some(c => c.league !== game.league) || ![year-1,year].every(y => calendars.some(c => c.year === y))) return null;
  const entries = calendars.flatMap(c => c.games);
  const counts = new Map<string,number>();
  for (const item of entries) counts.set(item.key, (counts.get(item.key) || 0) + 1);
  const fixture = entries.find(e => e.id === game.id);
  if (!fixture?.scheduled || counts.get(fixture.key) !== 1 || fixture.home !== game.home.id || fixture.away !== game.away.id || fixture.start !== start) return null;
  const cutoff = utcMatchDay(Math.min(now,start));
  return entries.filter(e => counts.get(e.key) === 1 && e.final && e.final.day < cutoff)
    .sort((a,b) => a.start - b.start || a.id.localeCompare(b.id)).map(e => e.final!);
}
