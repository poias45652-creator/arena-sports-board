const PUBLIC = 'https://www.kbl.or.kr';
const DATA = 'https://kbl-api.sports2i.com/api/v1';
const STATS = 'https://api-stats.kbl.or.kr/api/records/player/general/traditional';
const TEAM_CODES = {KT:'06', MOB:'10', DB:'16', SAM:'35', LG:'50', SK:'55', KCC:'60', KOG:'64', SON:'66', JJK:'70'};
const TEAM_NAMES = Object.fromEntries(Object.entries(TEAM_CODES).map(([name, code]) => [code, name]));
const POSITIONS = {GD:['後衛','G'], FD:['前鋒','F'], C:['中鋒','C']};
const HEADERS = {Accept:'application/json', Origin:PUBLIC, Referer:PUBLIC+'/', Channel:'WEB', TeamCode:'XX', lang:'ko', 'X-Requested-With':'XMLHttpRequest', 'User-Agent':'Mozilla/5.0'};
const PHOTO_OVERRIDES = {'291475':'https://cdn.nba.com/headshots/nba/latest/1040x760/1629016.png'};

async function request(url) {
  const response = await fetch(url, {headers:HEADERS, signal:AbortSignal.timeout(11000)});
  if (!response.ok) throw new Error('KBL 球員資料 HTTP '+response.status);
  return response.json();
}

function numeric(value) {
  if (value == null || value === '' || !Number.isFinite(Number(value))) return null;
  return Number(value);
}

function round(value) {
  return Math.round(value * 10) / 10;
}

async function currentSeasons() {
  const result = await request(DATA+'/code/codes/4');
  if (!Array.isArray(result.data)) throw new Error('KBL 球季資料不完整');
  const ordered = [...result.data].sort((a,b) => b.seasonCode-a.seasonCode);
  const regular = ordered.find(row => row.seasonName2 === '1군시즌');
  const development = ordered.find(row => row.seasonName2 === '2군시즌');
  if (!regular?.seasonCode) throw new Error('KBL 例行賽球季不存在');
  return {season:regular.seasonName1, regular:regular.seasonCode, development:development?.seasonCode || 0};
}

async function seasonStats(seasonCode) {
  const query = new URLSearchParams({seasonCode, gameCode:'01', sortDataSc:'score', sortOrderSc:'desc', listCn:'200', pageNo:'1', ruleCk:'0'});
  const first = await request(STATS+'?'+query);
  if (first.resultCode !== 200 || !Array.isArray(first.data)) throw new Error('KBL 球季統計不完整');
  const rows = [...first.data];
  const total = numeric(rows[0]?.totalCn) ?? rows.length;
  for (let page = 2; rows.length < total; page++) {
    query.set('pageNo', page);
    const next = await request(STATS+'?'+query);
    if (next.resultCode !== 200 || !next.data?.length) throw new Error('KBL 球季統計分頁不完整');
    rows.push(...next.data);
  }
  return rows;
}

function playerStats(row) {
  const gp = numeric(row?.gameCount);
  const stats = {gp};
  for (const [output,input] of Object.entries({pts:'score', reb:'rb', ast:'aS', stl:'sT', blk:'bS', tov:'tO', min:'playSec'})) {
    const total = numeric(row?.[input]);
    stats[output] = gp > 0 && total !== null ? round(total/gp/(output === 'min' ? 60 : 1)) : null;
  }
  for (const [field,value,attempts] of [['fgPct','fdgRt','fdgA'],['threePct','threepRt','threepA'],['ftPct','ftRt','ftA']]) {
    const rate = numeric(row?.[value]);
    stats[field] = rate !== null && numeric(row?.[attempts]) > 0 ? round(rate) : null;
  }
  return stats;
}

export async function getKblRoster(teamCode) {
  const key = String(teamCode).toUpperCase();
  const code = TEAM_CODES[key];
  if (typeof code !== 'string') throw new Error('不支援的 KBL 隊碼');
  const query = new URLSearchParams({teamCd:code, regSc:'Y', pageNo:'1', listCn:'200'});
  const [raw, season] = await Promise.all([request(DATA+'/players?'+query), currentSeasons()]);
  if (!Array.isArray(raw.playerList) || !raw.playerList.length || raw.playerList.length !== Number(raw.totalCn)) throw new Error('KBL 球員名單不完整');
  const stats = await seasonStats(season.regular);
  const players = raw.playerList.map(row => {
    if (String(row.teamCode).padStart(2,'0') !== code || !row.playerNo) throw new Error('KBL 名單球隊或球員識別碼錯誤');
    const id = String(row.playerNo);
    const records = stats.filter(r => String(r.playerNo) === id);
    const record = records.length === 1 ? records[0] : records.find(r => String(r.teamCode).padStart(2,'0') === code);
    const en = row.ename?.trim() || null;
    const name = en && en === en.toUpperCase() ? en.toLowerCase().replace(/(^|[ -])([a-z])/g, (_,s,c) => s+c.toUpperCase()) : en;
    const [position,positionCode] = POSITIONS[row.pos] || [null,null];
    return {id, name:name || row.kname, native:row.kname, en, team:key, number:row.backNum ?? null, position, positionCode,
      height:numeric(row.pHeight) || null, weight:numeric(row.pWeight) || null, photoUrl:PHOTO_OVERRIDES[id] || 'https://kbl.or.kr/files/kbl/players-photo/'+id+'.png',
      url:PUBLIC+'/player/player/'+id, statsStatus:record ? 'recorded' : 'no_regular_season_record', ...playerStats(record)};
  });
  if (new Set(players.map(r => r.id)).size !== players.length) throw new Error('KBL 名單含重複球員');
  return {players, season:season.season, asOf:new Date().toISOString(), source:PUBLIC+'/player/player', statsSource:PUBLIC+'/record/player'};
}

export async function getKblPlayerLog(playerId) {
  const id = String(playerId);
  if (!/^\d{1,9}$/.test(id)) throw new Error('KBL 球員識別碼錯誤');
  const season = await currentSeasons();
  const url = DATA+'/players/categories/game/'+season.regular+'/'+season.development+'/'+id;
  const raw = await request(url);
  if (!Array.isArray(raw.RegularGameRecords)) throw new Error('KBL 逐場資料不完整');
  const gameLog = raw.RegularGameRecords.filter(row => row.gameCode === '01' && Number(row.seasonCode) === Number(season.regular) && (row.win === 1 || row.loss === 1)).map(row => {
    const day = String(row.gameDate), gameId = 'S'+row.seasonCode+'G01N'+row.gameNo;
    const seconds = numeric(row.playSec);
    const opp = TEAM_NAMES[String(row.awayTeam).padStart(2,'0')], team = TEAM_NAMES[String(row.teamCode).padStart(2,'0')];
    if (!opp || !team || !/^\d{8}$/.test(day) || !/^\d+$/.test(String(row.gameNo))) throw new Error('KBL 逐場識別碼錯誤');
    return {id:gameId, date:day.slice(0,4)+'-'+day.slice(4,6)+'-'+day.slice(6), team, opp,
      minutes:seconds === null ? null : String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0'),
      pts:numeric(row.pts), reb:numeric(row.rb), ast:numeric(row.aS), stl:numeric(row.sT), blk:numeric(row.bS), url:PUBLIC+'/match/record/'+gameId+'/'+day};
  }).sort((a,b) => b.date.localeCompare(a.date));
  return {gameLog, season:season.season, asOf:new Date().toISOString(), source:PUBLIC+'/player/player/'+id};
}
