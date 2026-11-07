// Team bulletins also cover event tickets, so select player availability subjects at the title level.
// A temporary replacement notice does not identify the injured player unless the text explicitly does.
const teams = {
  DB:'16', SAM:'35', SK:'55', LG:'50', SON:'66', KOG:'64', KCC:'60', JJK:'70', KT:'06', MOB:'10'
}
const domains = {
  DB:'promy', SAM:'thunders', SK:'knights', LG:'sakers', SON:'skygunners',
  KOG:'pegasus', KCC:'egis', JJK:'kgc', KT:'sonicboom', MOB:'phoebus'
}

export function parseKblTeamNotices(payload, team, now = Date.now()) {
  if (!teams[team] || !Array.isArray(payload?.list)) return []
  const rows = []
  for (const a of payload.list) {
    if (String(a.teamCode) !== teams[team] || a.boardCode !== 'NOTICE' || !/^\d+$/.test(a.artcSq)) continue
    if (typeof a.artcTitle !== 'string' || !/부상|결장|복귀|일시\s*대체|일시\s*교체/.test(a.artcTitle)) continue
    const reportedAt = a.regDttm + '+09:00'
    const time = Date.parse(reportedAt)
    if (!Number.isFinite(time) || time > now || now - time > 28*86400000) continue
    const seasonEnd = Number(a.regDttm.slice(0,4)) + (Number(a.regDttm.slice(5,7)) >= 7 ? 1 : 0)
    let category = '球員動態'
    if (/일시\s*(?:대체|교체)/.test(a.artcTitle)) category = '臨時替補公告'
    else if (/부상|결장/.test(a.artcTitle)) category = '傷停相關公告'
    else if (/복귀/.test(a.artcTitle)) category = '復出相關公告'
    rows.push({league:'KBL', season:(seasonEnd-1)+'-'+String(seasonEnd).slice(-2),team, title:a.artcTitle.trim(),
      category, reportedAt, source:'KBL 球團公告', url:'https://' + domains[team] + '.kbl.or.kr/board/notice/' + a.artcSq + '?teamCd=' + teams[team]})
  }
  return rows
}

export async function fetchKblTeamNotices(teamCodes = Object.keys(teams)) {
  const valid = [...new Set(teamCodes)].filter(team => teams[team])
  const reports = await Promise.allSettled(valid.map(async team => {
    const params = new URLSearchParams({boardCode:'NOTICE',boardCatSq:'0',teamCodeList:teams[team],start:'0',limit:'20'})
    const r = await fetch('https://api.kbl.or.kr/article/list?' + params,{headers:{Accept:'application/json',
      Origin:'https://www.kbl.or.kr',Referer:'https://www.kbl.or.kr/',Channel:'WEB',TeamCode:teams[team]},signal:AbortSignal.timeout(7000)})
    if (!r.ok) throw new Error('KBL 球團公告來源回應 ' + r.status)
    return parseKblTeamNotices(await r.json(),team)
  }))
  return reports.filter(r => r.status === 'fulfilled').flatMap(r=>r.value)
}
