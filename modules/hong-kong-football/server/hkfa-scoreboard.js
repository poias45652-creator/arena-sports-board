const teams = {
  '東方': 'EA', '至尊沙田': 'ST', '冠忠南區': 'SO', '港會': 'HK', '標準流浪': 'BR',
  '傑志': 'KC', '高力北區': 'ND', '大埔': 'TP', '理文': 'LM', '和富九龍城': 'KL', '東區': 'ED',
};

export const hkfaScheduleURL = 'https://www.hkfa.com/competitions/fixtures?competition=2041&year=2026-2027';
export const hkfaMatchURL = id => 'https://www.hkfa.com/competitions/result/' + id + '/detail';

const fieldValue = /"(?:[^"\\]|\\.)*"|[A-Za-z_$][\w$]*|-?\d+(?:\.\d+)?/y;

function literal(token) {
  if (typeof token !== 'string' || !/^(?:"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?|null|true|false)$/.test(token)) return undefined;
  return JSON.parse(token);
}

function aliasesOf(script) {
  const head = script.match(/^\s*\(function\(([^)]*)\)\{/);
  const tail = script.match(/\}\(((?:"(?:[^"\\]|\\.)*"|[^"])*?)\)\);?\s*$/);
  if (!head || !tail) throw new Error('足總頁面格式已變更');
  const names = head[1].split(',');
  const args = tail[1];
  // These positional constants are produced by Nuxt’s devalue serializer. Only JSON literals are read.
  const constants = new Map();
  let pos = 0;
  let depth = 0;
  let start = 0;
  let slot = 0;
  while (pos <= args.length) {
    const ch = args[pos];
    if (ch === '"') {
      pos++;
      while (pos < args.length && args[pos] !== '"') pos += args[pos] === '\\' ? 2 : 1;
    } else if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    else if ((ch === ',' || pos === args.length) && depth === 0) {
      constants.set(names[slot++], literal(args.slice(start,pos).trim()));
      start = pos + 1;
    }
    pos++;
  }
  if (slot !== names.length) throw new Error('足總賽事欄位未能核實');
  return constants;
}

function block(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      for (i++; i < text.length && text[i] !== '"'; i++) if (text[i] === '\\') i++;
    } else if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return text.slice(start,i + 1);
  }
  throw new Error('足總賽事列不完整');
}

const getterPatterns = new Map();
function prop(text, name, aliases) {
  if (!getterPatterns.has(name)) getterPatterns.set(name, new RegExp('(?:^|[,{])'+name+':','g'));
  const pattern = getterPatterns.get(name);
  pattern.lastIndex = 0;
  const match = pattern.exec(text);
  if (!match) return null;
  const start = match.index + match[0].length;
  if (text[start] === '{') return block(text,start);
  fieldValue.lastIndex = start;
  const result = fieldValue.exec(text)?.[0];
  const value = literal(result);
  return value === undefined ? aliases.get(result) : value;
}

function officialState(label, code) {
  if (/^(?:完場|全場完|全場完場|全場結束|FT|Full Time)$/i.test(label)) return 'final';
  if (/延期|改期|postponed/i.test(label)) return 'postponed';
  if (/取消|cancelled|canceled/i.test(label)) return 'cancelled';
  if (/^(?:上半場|下半場|半場|中場(?:休息)?|比賽進行中|進行中|半場完|HT|1st Half|2nd Half|Half Time|Live|\d{1,3}(?:\+\d+)?[′'’分])$/i.test(label)) return 'live';
  if (label === '' && code === 0 || /^(?:未開始|未開賽|未開場|Scheduled|Not Started)$/i.test(label)) return 'pre';
  return 'unknown';
}

function readFixture(raw, aliases) {
  const value = name => prop(raw,name,aliases);
  const league = value('LeagueYear');
  if (!league || !String(prop(league,'LeagueYearName',aliases)).includes('香港超級聯賽')) return null;
  const home = teams[prop(value('team_home')||'','TeamName',aliases)];
  const away = teams[prop(value('team_guest')||'','TeamName',aliases)];
  const id = value('match_id');
  const dateISO = value('match_date');
  const postedTime = value('match_time');
  const time = postedTime === '--:--' || postedTime === '' ? null : postedTime;
  const officialStatus = String(value('matchStatus') ?? '').trim();
  const state = officialState(officialStatus,value('match_status'));
  if (!home || !away || home === away || !Number.isInteger(id) || !/^\d{4}-\d{2}-\d{2}$/.test(dateISO) || (time !== null && !/^\d{2}:\d{2}$/.test(time))) throw new Error('足總賽事識別未能核實');
  function score(n) {
    if (state !== 'live' && state !== 'final') return null;
    return Number.isInteger(n) && n >= 0 && n <= 99 ? n : typeof n === 'string' && /^\d{1,2}$/.test(n) ? Number(n) : null;
  }
  const venue = prop(value('Venue')||'','VenueName',aliases) || '';
  return {
    home,away,officialId:id, officialStatus, dateISO,date:dateISO.slice(5).replace('-','/'),time,venue,
    state,hg:score(value('home_score')),ag:score(value('guest_score')),
    round:value('match_round') || null,
  };
}

// Read a fixed set of public match fields. Upstream JavaScript is never run or returned.
export function parseHkfaScoreboard(html) {
  const script = html.match(/<script\b[^>]*>\s*window\.__NUXT__\s*=\s*([\s\S]*?)<\/script>/i)?.[1];
  if (!script) throw new Error('足總資料暫缺');
  const aliases = aliasesOf(script);
  const rows = [];
  const startOfMatch = /\{match_(?:description|time):/g;
  for (const m of script.matchAll(startOfMatch)) {
    const row = readFixture(block(script, m.index),aliases);
    if (row) rows.push(row);
  }
  if (!rows.length) throw new Error('足總未傳回港超賽事');
  return rows;
}

async function fetchPage(url, { fetcher = fetch, signal } = {}) {
  const res = await fetcher(url, { headers: { Accept:'text/html', 'Accept-Language':'zh-HK' },signal });
  if (!res.ok) throw new Error('足總頁面連線失敗');
  return parseHkfaScoreboard(await res.text());
}

export async function fetchHkfaSchedule(options = {}) {
  const pages = await Promise.all([1,2,3].map(page => fetchPage(hkfaScheduleURL+'&page='+page,options)));
  const rows = pages.flat();
  if (rows.length !== 110 || new Set(rows.map(r=>r.home+':'+r.away)).size !== 110 || new Set(rows.map(r=>r.officialId)).size !== 110)
    throw new Error('足總港超全季場次未能核實');
  return rows;
}

export async function fetchHkfaMatch(id,options = {}) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('不明足總賽事');
  const rows = await fetchPage(hkfaMatchURL(id), options);
  if (rows.length !== 1 || rows[0].officialId !== id) throw new Error('足總對賽場次不符');
  return rows[0];
}
