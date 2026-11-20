export const fixtureFeedURL = 'https://hkfpl.com.hk/fixtures';

const clubs = {
  '東方': 'EA', '至尊沙田': 'ST', '冠忠南區': 'SO', '港會': 'HK', '標準流浪': 'BR',
  '傑志': 'KC', '高力北區': 'ND', '大埔': 'TP', '理文': 'LM', '和富九龍城': 'KL', '東區': 'ED',
};

const grounds = {
  'Mong Kok Stadium': '旺角大球場', 'Aberdeen S/G': '香港仔運動場', 'Tsing Yi S/G': '青衣運動場',
  'North District S/G': '北區運動場', 'Tai Po S/G': '大埔運動場', 'Hong Kong Football Club': '香港足球會足球場',
  'Tseung Kwan O S/G': '將軍澳運動場', 'Siu Sai Wan S/G': '小西灣運動場',
  'Kai Tak Youth S/G': '啟德青年運動場', 'Kai Tak Youth Sports Ground': '啟德青年運動場',
  'Hammer Hill Road S/G': '斧山道運動場', 'Sha Tin Sports Ground': '沙田運動場', 'Sha Tin S/G': '沙田運動場',
};

function visibleText(markup) {
  return markup.replace(/<!--[\s\S]*?-->|<[^>]+>/g, ' ').replace(/&nbsp;|\s+/g, ' ').trim();
}

// Read the public schedule and its published results independently, joining by team pair and kickoff.
export function parseFixtureFeed(html) {
  const structuredData = Array.from(html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi), m => JSON.parse(m[1]));
  const schedule = structuredData.find(s => s['@type'] === 'CollectionPage' && s.mainEntity?.['@type'] === 'ItemList' && s.name?.includes('2026/27'));
  const entries = schedule?.mainEntity?.itemListElement;
  if (!Array.isArray(entries) || entries.length !== 110) throw new Error('港超全季賽程未能核實');
  const displayed = new Map();
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  for (const section of markup.matchAll(/<section\b[^>]*>([\s\S]*?)<\/section>/gi)) {
    const week = Number(section[1].match(/<h2\b[^>]*>第\s*(\d+)\s*週<\/h2>/i)?.[1]);
    if (!week) continue;
    for (const item of section[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
      const kickoff = item[1].match(/<time\b[^>]*\bdatetime=["']([^"']+)["']/i)?.[1];
      if (!kickoff) continue;
      const summary = visibleText(item[1].split(/<time\b/i)[0]);
      const names = summary.match(/^(\S+)\s+v\s+(\S+)\s+(.+)$/i);
      if (!names || !clubs[names[1]] || !clubs[names[2]] || !Number.isFinite(Date.parse(kickoff))) throw new Error('港超賽果列未能核實');
      const [, home, away, status] = names;
      const score = status.match(/^(\d{1,2})\s*[-–—]\s*(\d{1,2})$/);
      let state = 'unknown';
      if (score) state = 'final';
      else if (/^\d{1,2}:\d{2}$/.test(status)) state = 'pre';
      else if (/延期|延後|待定|postponed/i.test(status)) state = 'postponed';
      else if (/取消|cancelled|canceled/i.test(status)) state = 'cancelled';
      displayed.set(home + ':' + away, { epoch: Date.parse(kickoff), state, week, hg: score ? Number(score[1]) : null, ag: score ? Number(score[2]) : null });
    }
  }
  if (displayed.size !== entries.length) throw new Error('港超比賽週資料未齊');
  const seen = new Set();
  return entries.map(({ item }) => {
    const home = item?.homeTeam?.name;
    const away = item?.awayTeam?.name;
    const epoch = Date.parse(item?.startDate);
    const pair = home + ':' + away;
    const label = displayed.get(pair);
    if (item?.['@type'] !== 'SportsEvent' || !clubs[home] || !clubs[away] || home === away || seen.has(pair) || !label || !Number.isFinite(epoch) || label.epoch !== epoch) throw new Error('港超賽程與賽果未能配對');
    seen.add(pair);
    const local = new Date(epoch + 8 * 3600000).toISOString();
    const dateISO = local.slice(0, 10);
    return {
      home: clubs[home], away: clubs[away], dateISO, date: dateISO.slice(5).replace('-', '/'),
      time: local.slice(11, 16), venue: grounds[item.location?.name] || item.location?.name || '',
      week: label.week, state: label.state, hg: label.hg, ag: label.ag,
    };
  });
}

export async function fetchFixtureFeed({ fetcher = fetch, signal } = {}) {
  const response = await fetcher(fixtureFeedURL, {
    headers: { Accept: 'text/html', 'Accept-Language': 'zh-HK,zh-Hant;q=0.9' }, signal,
  });
  if (!response.ok) throw new Error('港超賽程暫未回應');
  return parseFixtureFeed(await response.text());
}
