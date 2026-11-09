export async function saveForecast(db, league, game, report) {
  const start = new Date(game.date + 'T' + game.time + ':00+08:00').toISOString();
  if (!report.ready || report.replay || game.timeConfirmed === false ||
      !['scheduled', 'fixture'].includes(game.status) || !(Date.parse(report.asOf) < Date.parse(start))) return false;
  const payload = JSON.stringify({...report, startsAt: start});
  const key = [league, game.date, game.home, game.away, start].join('/');
  const result = await db.prepare(`INSERT INTO regional_basketball_forecasts
    (id,league,date,fixture_key,start_time,captured_at,payload)
    SELECT ?,?,?,?,?,?,? WHERE clock_timestamp() < ?::timestamptz
    ON CONFLICT (id) DO UPDATE SET captured_at=excluded.captured_at,payload=excluded.payload
    WHERE regional_basketball_forecasts.captured_at < excluded.captured_at
      AND clock_timestamp() < excluded.start_time::timestamptz`)
    .bind(key, league, game.date, [game.date, game.home, game.away].join('/'), start, report.asOf, payload, start).run();
  return result.meta.changes > 0;
}

export async function readForecasts(db, league, day) {
  const {results} = await db.prepare(`SELECT fixture_key,payload FROM regional_basketball_forecasts
    WHERE league=? AND date=? AND captured_at < start_time`).bind(league, day).all();
  return results.map(row => ({fixture: row.fixture_key, report: JSON.parse(row.payload)}));
}
