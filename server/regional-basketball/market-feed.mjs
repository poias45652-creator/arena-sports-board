const root = 'https://www.haterpicks.app/odds/nbl'
const teamCodes = new Map(Object.entries({
  'Adelaide 36ers': 'ADL',
  'Brisbane Bullets': 'BRI',
  'Cairns Taipans': 'CNS',
  'Illawarra Hawks': 'ILL',
  'Melbourne United': 'MEL',
  'New Zealand Breakers': 'NZL',
  'Perth Wildcats': 'PER',
  'South East Melbourne Phoenix': 'SEM',
  'Sydney Kings': 'SYD',
  'Tasmania JackJumpers': 'TAS'
}))

function schemaGraph(html) {
  const result = []
  for (const [, raw] of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const parsed = JSON.parse(raw)
      result.push(...(parsed['@graph'] || [parsed]))
    } catch {
      continue
    }
  }
  return result
}

export function parseNblMarketIndex(html) {
  const collection = schemaGraph(html).find(item => item['@type'] === 'CollectionPage')
  return [...new Set((collection?.hasPart?.itemListElement || [])
    .map(item => item.url)
    .filter(url => /^https:\/\/www\.haterpicks\.app\/odds\/nbl\/[a-z0-9-]+$/.test(url)))]
}

function strip(html) {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim()
}

function tableRows(html) {
  return [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(([, row]) =>
    [...row.matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(([, cell]) => strip(cell)))
}

export function parseNblMarket(html, url, now = Date.now()) {
  const event = schemaGraph(html).find(item => item.about?.['@type'] === 'SportsEvent')?.about
  if (!event || event.sport !== 'NBL') return null
  const home = teamCodes.get(event.homeTeam?.name)
  const away = teamCodes.get(event.awayTeam?.name)
  const start = Date.parse(event.startDate)
  if (!home || !away || home === away || !Number.isFinite(start) || start <= now || start > now + 21 * 86400000) return null
  const tableByKind = {}
  for (const [, markup] of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const [header, ...body] = tableRows(markup)
    if (header?.length !== 3 || header[0] !== 'Bookmaker') continue
    const rows = new Map(body.filter(row => row.length === 3 && row.slice(1).every(v => /^\$\d+\.\d{2}$/.test(v) && Number(v.slice(1)) > 1))
      .map(([source, first, second]) => [source, [Number(first.slice(1)), Number(second.slice(1))]]))
    if (header[1] === event.homeTeam.name && header[2] === event.awayTeam.name) {
      tableByKind.money = {rows}
    } else if (header[1].startsWith(event.homeTeam.name + ' ') && header[2].startsWith(event.awayTeam.name + ' ')) {
      const a = header[1].slice(event.homeTeam.name.length + 1)
      const b = header[2].slice(event.awayTeam.name.length + 1)
      if (/^[+-]?\d+(?:\.\d+)?$/.test(a) && /^[+-]?\d+(?:\.\d+)?$/.test(b) && Number(a) === -Number(b)) tableByKind.line = {rows, value: Number(a)}
    } else if (/^Over \d+(?:\.\d+)?$/.test(header[1]) && header[2] === header[1].replace('Over', 'Under')) {
      tableByKind.total = {rows, value: Number(header[1].split(' ')[1])}
    }
  }
  const {money, line, total} = tableByKind
  if (!money || !line || !total) return null
  const book = ['Sportsbet', 'TAB', 'Ladbrokes', 'Neds', 'Palmerbet', 'Unibet'].find(b => [money,line,total].every(m => m.rows.has(b)))
  if (!book) return null
  const [homeMoneyline, awayMoneyline] = money.rows.get(book)
  const [homeSpreadPrice, awaySpreadPrice] = line.rows.get(book)
  const [overPrice, underPrice] = total.rows.get(book)
  return {league: 'NBL', date: new Date(start + 8 * 3600000).toISOString().slice(0, 10),
    home, away, startsAt: new Date(start).toISOString(), spread: line.value, total: total.value,
    homeMoneyline, awayMoneyline, homeSpreadPrice, awaySpreadPrice, overPrice, underPrice,
    provider: book + '（HaterPicks 彙整）', url, checkedAt: new Date(now).toISOString(), quotedAt: null, kind: 'public_pregame'}
}

async function htmlAt(url) {
  const response = await fetch(url, {headers: {Accept: 'text/html'}, signal: AbortSignal.timeout(6500)})
  if (!response.ok) throw new Error('公開盤口來源回應 ' + response.status)
  return response.text()
}

export async function fetchNblMarkets() {
  const urls = parseNblMarketIndex(await htmlAt(root)).slice(0, 12)
  const resolved = await Promise.allSettled(urls.map(async url => parseNblMarket(await htmlAt(url), url)))
  return resolved.filter(v => v.status === 'fulfilled' && v.value).map(v => v.value)
}
