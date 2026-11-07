const article = 'https://www.nbl.com.au/news/nbl26-the-latest-injury-updates'
const codes = {ADL:'ADL', BNE:'BRI', BRI:'BRI', CNS:'CNS', ILL:'ILL', MU:'MEL', MEL:'MEL', NZB:'NZL', NZL:'NZL', PER:'PER', SEM:'SEM', SYD:'SYD', TAS:'TAS'}
const reasons = {
  ankle:'腳踝', acl:'膝前十字韌帶', 'personal reasons':'個人因素', concussion:'腦震盪',
  undisclosed:'原因未公布', 'lower leg':'小腿', 'lower limb':'下肢', hamstring:'腿後肌',
  back:'背部', foot:'足部', neck:'頸部', soreness:'痠痛', calf:'小腿', knee:'膝部', heel:'足跟'
}

export function parseNblInjuries(html, now = Date.now()) {
  const match = html.match(/<title[^>]*>NBL(\d{2}): The latest injury updates<\/title>/i)
  const sourceDate = html.match(/"dateModified":\s*"([A-Za-z]{3,9}) (\d{1,2}), (20\d{2})"/)
  const reportDate = html.match(/Last updated:\s*([A-Za-z]+) (\d{1,2}),\s*(\d{1,2}):(\d{2})\s*(am|pm)\s*(AEDT|AEST)/i)
  if (!match || !sourceDate || !reportDate) return []
  const [ , month, day, hour, minute, part, zone] = reportDate
  const endYear = 2000 + Number(match[1])
  const year = Number(sourceDate[3])
  const monthNum = new Date(month + ' 1, 2000 UTC').getUTCMonth()
  const reportYear = monthNum === 11 && sourceDate[1].toLowerCase().startsWith('jan') ? year-1 : year
  const hourUtc = Number(hour) % 12 + (part.toLowerCase() === 'pm' ? 12 : 0) - (zone.toUpperCase() === 'AEDT' ? 11 : 10)
  const stamp = Date.UTC(reportYear, monthNum, Number(day), hourUtc, Number(minute))
  if (reportYear < endYear - 1 || reportYear > endYear || !Number.isFinite(stamp) || stamp > now || now-stamp > 10*86400000) return []
  const season = String(endYear - 1) + '-' + match[1]
  const list = []
  for (const [, banner, body] of html.matchAll(/WebHeaders_([A-Z]+)\.webp"[^>]*>[\s\S]*?<\/figure>\s*<p>([\s\S]*?)<\/p>/g)) {
    const team = codes[banner]
    if (!team) continue
    for (const row of body.split(/<br\s*\/?>/i)) {
      const fields = row.replace(/<[^>]+>/g,'').trim().split(/\s+-\s+/)
      if (fields.length !== 3 || !fields[0]) continue
      const [player, rawReason, ret] = fields
      const status = /^season$/i.test(ret) ? 'confirmed_out' : (/^test$/i.test(ret) ? 'fitness_test' : 'listed')
      const round = ret.match(/^Round (\d+(?:-\d+)?)$/i)
      const returnNote = round ? '第 ' + round[1] + ' 輪' : ({season:'本季缺陣',tbc:'復出時間未定',test:'待賽前測試'}[ret.toLowerCase()] || ret)
      list.push({league:'NBL', season, team, player, status, reason:reasons[rawReason.toLowerCase()] || rawReason, returnNote, reportedAt:new Date(stamp).toISOString(), source:'NBL 官方傷停報告', url:article})
    }
  }
  return list
}

export async function fetchNblInjuries() {
  const r = await fetch(article, {headers:{Accept:'text/html'}, signal:AbortSignal.timeout(6500)})
  if (!r.ok) throw new Error('澳職官方傷停來源回應 ' + r.status)
  return parseNblInjuries(await r.text())
}
