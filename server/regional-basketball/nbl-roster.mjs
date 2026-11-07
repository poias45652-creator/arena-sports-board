const NBL = 'https://www.nbl.com.au';
const CALENDAR = 'https://schedule.nbl.com.au/api/calendar';
const clubs = {
  ADL: 'adelaide-36ers', BRI: 'brisbane-bullets', CNS: 'cairns-taipans',
  ILL: 'illawarra-hawks', MEL: 'melbourne-united', NZL: 'new-zealand-breakers',
  PER: 'perth-wildcats', SEM: 'south-east-melbourne-phoenix', SYD: 'sydney-kings',
  TAS: 'tasmania-jackjumpers',
};
const lookups = new Map();
const stats = {pts: 'points', reb: 'rebounds', ast: 'assists', stl: 'steals', blk: 'blocks', tov:'turnovers', fgm:'field_goals_made', fga:'field_goals_attempted', threeMade:'three_points_made', threeAttempted:'three_points_attempted', ftm:'free_throws_made', fta:'free_throws_attempted'};

function cached(key, seconds, read) {
  const now = Date.now();
  const entry = lookups.get(key);
  if (entry && entry.until > now) return entry.promise;
  if (lookups.size >= 256) {
    for (const [id, row] of lookups) if (row.until <= now) lookups.delete(id);
    if (lookups.size >= 256) lookups.delete(lookups.keys().next().value);
  }
  const promise = Promise.resolve().then(read);
  lookups.set(key, {until: now + seconds * 1000, promise});
  promise.catch(() => {
    if (lookups.get(key)?.promise === promise) lookups.delete(key);
  });
  return promise;
}

async function request(url, ttl, format) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(13000),
    cf: {cacheEverything: true, cacheTtl: ttl},
    headers: {Accept: format === 'json' ? 'application/json' : 'text/html'},
  });
  if (!response.ok) throw new Error(`NBL 來源回應 ${response.status}`);
  return format === 'json' ? response.json() : response.text();
}

function decode(value) {
  const entities = {amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' '};
  return value.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (whole, key) => {
    if (!key.startsWith('#')) return entities[key] ?? whole;
    const code = key[1]?.toLowerCase() === 'x' ? Number.parseInt(key.slice(2), 16) : Number(key.slice(1));
    return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}
function attribute(tag, key) {
  const hit = tag.match(new RegExp('(?:^|\\s)' + key + '\\s*=\\s*(["\'])([\\s\\S]*?)\\1', 'i'));
  return hit ? decode(hit[2].trim()) : '';
}
function cardText(body, element) {
  for (const m of body.matchAll(/<([a-z][\w-]*)\b([^>]*)>([^<>]+)<\//gi)) {
    if (attribute(m[2], 'data-element') === element) return decode(m[3].trim());
  }
  return '';
}
async function roster(code) {
  return cached('roster-' + code, 900, async () => {
    const source = NBL + '/teams/' + clubs[code];
    const html = await request(source, 900, 'text');
    const season = html.match(/<h3\b[^>]*>\s*(20\d{2})\s*[-–]\s*(20\d{2})\s*<\/h3>/i);
    const players = new Map();
    for (const m of html.matchAll(/<a\b([^>]+)>([\s\S]*?)<\/a>/gi)) {
      if (attribute(m[1], 'data-element') !== 'player-link') continue;
      const path = attribute(m[1], 'href');
      if (!/^\/players\/[\w-]+\/?$/.test(path)) continue;
      const slug = path.split('/')[2];
      const id = slug.match(/[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i)?.[0] || slug;
      const name = cardText(m[2], 'name');
      if (!name) continue;
      const data = {id, name, en: name, url: NBL + path};
      for (const [key, attr] of [['number', 'jersey-number'], ['position', 'position'], ['height', 'height']]) {
        const val = cardText(m[2], attr);
        if (key === 'height' && /^\d+$/.test(val) && Number(val) > 0) data.height = Number(val);
        else if (key !== 'height' && val) data[key] = val;
      }
      for (const [tag] of m[2].matchAll(/<img\b[^>]+>/gi)) {
        if (attribute(tag, 'data-element') !== 'image' || /invisible/.test(attribute(tag, 'class'))) continue;
        const src = attribute(tag, 'src');
        if (/^https:\/\/cdn\.prod\.website-files\.com\//i.test(src) && !/placeholder|silhouette/i.test(src)) data.photoUrl = src;
      }
      players.set(id, data);
    }
    if (players.size < 5 || !season || +season[2] !== +season[1] + 1) throw new Error('NBL 官方球員名單或球季尚未就緒');
    return {players: [...players.values()], year: Number(season[1]), source};
  });
}

function taipeiDay(epoch) {
  return new Date(epoch + 8 * 3600000).toISOString().slice(0, 10);
}
function minutes(text) {
  const m = /^(\d+):([0-5]\d)$/.exec(text ?? '');
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
const nameKey = name => name?.normalize('NFKC').toLowerCase().replace(/[^a-z\d]/g, '');
async function games(year) {
  return cached('schedule-' + year, 120, async () => {
    const json = await request(`${CALENDAR}/schedule?league=nbl&year=${year}&limit=500&offset=0`, 120, 'json');
    if (Number(json.year) !== year || !Array.isArray(json.matches) || json.matches.length < Number(json.total)) {
      throw new Error('NBL 官方賽程尚未完整');
    }
    return json.matches.filter(row => row.season_type === 'regular' && /^\d+$/.test(String(row.round_label)) && row.phase === 'complete');
  });
}
async function box(game) {
  return cached('box-' + game.id, 21600, async () => {
    const url = `${CALENDAR}/match?league=nbl&match=${encodeURIComponent(game.id)}`;
    const {match} = await request(url, 21600, 'json');
    if (match?.match_type !== 'regular' || !['complete','confirmed','final','completed'].includes(String(match.match_status).toLowerCase()) ||
        match.home_score == null || match.away_score == null ||
        Number(match.home_score) !== Number(game.home_score) || Number(match.away_score) !== Number(game.away_score)) {
      throw new Error('NBL 完賽紀錄尚未核對');
    }
    const rows = [], totals = new Map(), keys = new Set();
    for (const r of match.player_match_statistics ?? []) {
      if (String(r.period) !== '0' || !r.player || !r.team) continue;
      const team = r.team.team_code, id = r.player.external_id || r.player.id;
      if (!id || keys.has(team + '/' + id)) throw new Error('NBL 球員技術統計無法對齊');
      keys.add(team + '/' + id);
      if (r.points == null || !Number.isFinite(Number(r.points))) throw new Error('NBL 個人得分尚未確認');
      totals.set(team, (totals.get(team) || 0) + Number(r.points));
      const seconds = minutes(r.minutes);
      if (!(seconds > 0 || [r.points,r.rebounds,r.assists,r.blocks,r.steals,r.fouls,r.field_goals_attempted].some(v => v > 0))) continue;
      const row = {id, team, date: taipeiDay(game.starts_at_ms), name: r.player.full_name,
        opp: team === game.home.team_code ? game.away.team_code : game.home.team_code,
        minutes: r.minutes, url: 'https://schedule.nbl.com.au/match?league=nbl&match=' + encodeURIComponent(game.id)};
      for (const [key, attr] of Object.entries(stats)) {
        if (r[attr] != null && Number.isFinite(Number(r[attr]))) row[key] = Number(r[attr]);
      }
      rows.push(row);
    }
    if (totals.get(game.home.team_code) !== Number(game.home_score) || totals.get(game.away.team_code) !== Number(game.away_score)) {
      throw new Error('NBL 球員得分未能與終場比分核對');
    }
    return rows;
  });
}

function applyStats(player, logs) {
  player.gp = logs.length;
  player.gameLog = logs.sort((a,b) => b.date.localeCompare(a.date)).map(({id,name,...rest}) => rest);
  if (!logs.length) return;
  for (const key of Object.keys(stats)) {
    if (logs.every(g => g[key] != null && Number.isFinite(g[key]))) {
      player[key] = +(logs.reduce((sum, g) => sum + g[key], 0) / logs.length).toFixed(1);
    }
  }
  for(const [key,made,attempted] of [['fgPct','fgm','fga'],['threePct','threeMade','threeAttempted'],['ftPct','ftm','fta']]){
    const complete=logs.every(g=>Number.isFinite(g[made])&&Number.isFinite(g[attempted]));
    const attempts=complete?logs.reduce((n,g)=>n+g[attempted],0):0;
    player[key]=attempts?+(logs.reduce((n,g)=>n+g[made],0)*100/attempts).toFixed(1):null;
  }
  if (logs.every(row => minutes(row.minutes) != null)) {
    player.min = +(logs.reduce((sum,g) => sum + minutes(g.minutes), 0) / 60 / logs.length).toFixed(1);
  }
}

// baseline is the optional players.json snapshot. Only complete, same-season baselines
// with game logs can be incremented. Without one, verify the team's whole season.
export async function getNblRoster(teamCode, baseline) {
  const code = String(teamCode || '').toUpperCase();
  if (!Object.hasOwn(clubs, code)) throw new Error('未知的 NBL 球隊');
  const list = await roster(code);
  const players = list.players.map(p => ({...p}));
  const result = {players, asOf: new Date().toISOString(), source: list.source,
    season: list.year + '–' + String(list.year+1).slice(2), statsComplete: false};
  try {
    const all = (await games(list.year)).filter(g => g.home?.team_code === code || g.away?.team_code === code);
    const baseTeam = baseline?.teams?.[code];
    const base = new Map((Array.isArray(baseTeam) ? baseTeam : []).map(p => [p.id,p]));
    const incremental = baseline?.season === result.season && /^\d{4}-\d{2}-\d{2}$/.test(baseline?.asOf) &&
      players.every(p => {const prev=base.get(p.id);return prev && Array.isArray(prev.gameLog) && prev.gp===prev.gameLog.length;});
    const pending = incremental ? all.filter(g => taipeiDay(g.starts_at_ms) >= baseline.asOf) : all;
    const results = [];
    for (let i = 0; i < pending.length; i += 4) {
      results.push(...await Promise.all(pending.slice(i,i+4).map(box)));
    }
    const nameCounts = new Map();
    for (const p of players) nameCounts.set(nameKey(p.name), (nameCounts.get(nameKey(p.name)) || 0) + 1);
    const rows = results.flat().filter(r => r.team === code);
    for (const p of players) {
      const previous = incremental ? base.get(p.id).gameLog.filter(g => g.team === code && g.date < baseline.asOf) : [];
      const name = nameKey(p.name);
      const matches = rows.filter(r => r.id === p.id || (name && nameCounts.get(name)===1 && nameKey(r.name) === name));
      applyStats(p, [...previous, ...matches]);
    }
    result.statsComplete = true;
    result.statsSource = 'https://schedule.nbl.com.au/nbl';
    result.statsThrough = all.length ? taipeiDay(Math.max(...all.map(g => g.starts_at_ms))) : null;
  } catch {
    // Return verified roster fields alone when any box or the schedule is incomplete.
  }
  return result;
}
