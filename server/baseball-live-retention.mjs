/** Retain a known scheduled start, never a score, from the exact same fixture. */
export function retainFixtureStart(fresh, previous) {
  if (fresh.startTime || !previous?.startTime) return fresh;
  const same = !!fresh.id && !!fresh.home?.id && !!fresh.away?.id && fresh.league === previous.league && fresh.date === previous.date &&
    fresh.id === previous.id && fresh.key === previous.key &&
    fresh.home?.id === previous.home?.id && fresh.away?.id === previous.away?.id;
  const start = Date.parse(previous.startTime);
  const observed = Date.parse(previous.source?.fetchedAt);
  const current = Date.parse(fresh.source?.fetchedAt);
  if (!same || !Number.isFinite(start) || !Number.isFinite(observed) ||
      !Number.isFinite(current) || observed > current) return fresh;
  const offset = fresh.league === 'CPBL' ? 8 : 9;
  if (new Date(start + offset * 3600000).toISOString().slice(0, 10) !== fresh.date) return fresh;
  return {...fresh, startTime:previous.startTime,
    startTimeSource:previous.startTimeSource || {...previous.source, retained:true}};
}
