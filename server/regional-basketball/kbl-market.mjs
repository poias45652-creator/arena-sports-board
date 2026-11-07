const base = 'https://oddsrun.com'
export const kblOddsIndex = base + '/matches/basketball/kr/2148/korea-kbl/'
const matchLink = /^https:\/\/oddsrun\.com\/match\/basketball\/kr\/2148\/(\d+)\/korea-kbl\/[a-z0-9-]+\/$/
const teams = {
  'Wonju Promy':'DB','Changwon Sakers':'LG','Mobis Phoebus':'MOB',
  'Anyang Red Boosters':'JJK','KCC Egis':'KCC','Suwon Sonicboom':'KT',
  'Seoul Thunders':'SAM','Seoul SK Knights':'SK','Seoul Knights':'SK',
  'Goyang Sky Gunners':'SON','Korea Gas Corporation':'KOG'
}
const seconds = n => n * 1000
const day = 86400000
function data(html) {
  const raw = html.match(/<script\b[^>]*id="__ssr_data__"[^>]*>([\s\S]*?)<\/script>/i)
  return raw ? JSON.parse(raw[1]) : {}
}

export function parseKblIndex(html, now = Date.now()) {
  const dates = data(html)['/league/matches'] || {}
  const events = new Set(Object.values(dates).flat().map(row => row?.match).filter(m =>
    m && String(m['league-id']) === '2148' && seconds(Number(m['date-start-timestamp'])) >= now - 2*day &&
    seconds(Number(m['date-start-timestamp'])) <= now + 10*day).map(m => String(m.id)))
  const urls = []
  for (const [,url] of html.matchAll(/href="(https:\/\/oddsrun\.com\/match\/basketball\/kr\/2148\/[^"]+)"/g)) {
    const id = url.match(matchLink)?.[1]
    if (id && events.has(id) && !urls.includes(url)) urls.push(url)
  }
  return urls
}

function latest(rows, cutoff, type) {
  if (!Array.isArray(rows)) return null
  const prices = type === 'ou' ? ['over_od','under_od'] : ['home_od','away_od']
  return rows.filter(r => r && prices.every(p => Number.isFinite(Number(r[p])) && Number(r[p]) > 1) &&
    (type === '1X2' || (typeof r.handicap === 'string' && /^[+-]?\d+(?:\.\d+)?$/.test(r.handicap))) &&
    Number(r.add_time) > 0 && seconds(Number(r.add_time)) < cutoff)
    .sort((a,b)=>Number(b.add_time)-Number(a.add_time))[0] || null
}

export function parseKblMarket(html, url, now = Date.now()) {
  const id = url.match(matchLink)?.[1]
  if (!id) return null
  const d = data(html)['/match/details#' + id]
  const match = d?.match?.match
  const start = seconds(Number(match?.['date-start-timestamp']))
  if (!match || String(match['league-id']) !== '2148' || !Number.isFinite(start) || start < now-2*day || start > now+10*day) return null
  const home = teams[match['home-name']], away = teams[match['away-name']]
  if (!home || !away || home === away) return null
  const cutoff = Math.min(start,now+1)
  for (const book of ['PinnacleSports','Bet365','Ladbrokes','UniBet','BetFair']) {
    const [ml,ah,ou] = ['1X2','ah','ou'].map(type=>latest(d.matchOdds?.[type]?.[book]?.odds?.[type],cutoff,type))
    if (!ml || !ah || !ou || Number(ml.draw_od) > 0 || Number(ou.handicap) <= 0) continue
    const quoteTimes = [ml, ah, ou].map(r=>seconds(Number(r.add_time)))
    const earliest = Math.min(...quoteTimes)
    const archived = start <= now || match['event-stage-name'] !== 'Scheduled' && String(match.time_status) !== '0'
    const kind = !archived && now - earliest <= 24*3600000 ? 'public_pregame' : 'archived_pregame'
    const iso = t => new Date(t).toISOString()
    return {league:'KBL',date:iso(start+8*3600000).slice(0,10),home,away,startsAt:iso(start),
      spread:Number(ah.handicap),total:Number(ou.handicap),homeMoneyline:Number(ml.home_od),awayMoneyline:Number(ml.away_od),
      homeSpreadPrice:Number(ah.home_od),awaySpreadPrice:Number(ah.away_od),overPrice:Number(ou.over_od),underPrice:Number(ou.under_od),
      provider:book + '（OddsRun 彙整）',url,checkedAt:iso(now),quotedAt:iso(earliest),
      quoteTimes:{moneyline:iso(quoteTimes[0]),spread:iso(quoteTimes[1]),total:iso(quoteTimes[2])},kind}
  }
  return null
}

async function htmlAt(url) {
  const r = await fetch(url,{headers:{Accept:'text/html'},signal:AbortSignal.timeout(7000)})
  if (!r.ok) throw new Error('韓國職籃盤口來源回應 ' + r.status)
  return r.text()
}
export async function fetchKblMarkets() {
  const urls = parseKblIndex(await htmlAt(kblOddsIndex)).slice(0,12)
  const resolved = await Promise.allSettled(urls.map(async url => parseKblMarket(await htmlAt(url),url)))
  return resolved.filter(r => r.status === 'fulfilled' && r.value).map(r=>r.value)
}
