const dayTitle = new Intl.DateTimeFormat('zh-TW', {
  timeZone:'Asia/Hong_Kong',year:'numeric',month:'long',day:'numeric',weekday:'long'
});
const localClock = new Intl.DateTimeFormat('zh-TW', {
  timeZone:'Asia/Hong_Kong',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
});

export function matchDayTitle(day) {
  return dayTitle.format(new Date(day+'T12:00:00+08:00'));
}
export function matchTime(game) {
  return game.timeConfirmed ? localClock.format(new Date(game.start)) : '時間待定';
}
export function groupMatchDays(games) {
  const byDay = new Map();
  for (const game of games) {
    const day = game.day || new Date(Date.parse(game.start)+8*3600000).toISOString().slice(0,10);
    if (!byDay.has(day)) byDay.set(day,[]);
    byDay.get(day).push(game);
  }
  return [...byDay].sort(([a],[b])=>a.localeCompare(b)).map(([day,matches])=>({
    day,
    games:matches.sort((a,b)=>{
      if (a.timeConfirmed!==b.timeConfirmed) return a.timeConfirmed ? -1 : 1;
      return a.timeConfirmed ? Date.parse(a.start)-Date.parse(b.start) : 0;
    })
  }));
}
