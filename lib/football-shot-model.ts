// All times are UTC match days. Callers supply verified finals in chronological order.
export type ShotGame = {day:number; home:string; away:string; hg:number; ag:number; ht:number|null; at:number|null};
export type ShotFit = {mean:number[]; std:number[]; b:number[]};
const DAY = 86_400_000;

export function shotFeatures(history:readonly ShotGame[], day:number, home:string, away:string) {
  const year = new Date(day * DAY).getUTCFullYear();
  const start = Date.UTC(year - 1, 0, 1) / DAY;
  const ratings = new Map<string, {points:number; year:number}>();
  const recent:ShotGame[] = [];
  function rating(team:string, currentYear:number) {
    const prior = ratings.get(team);
    return prior ? 1500 + (prior.points - 1500) * .85 ** (currentYear - prior.year) : 1500;
  }
  for (const game of history) {
    if (game.day < start || game.day >= day) continue;
    const seasonYear = new Date(game.day * DAY).getUTCFullYear();
    const h = rating(game.home, seasonYear), a = rating(game.away, seasonYear);
    const result = game.hg === game.ag ? .5 : Number(game.hg > game.ag);
    const move = 20 * (result - 1 / (1 + 10 ** (-(h - a + 60) / 400)));
    ratings.set(game.home, {points:h + move, year:seasonYear});
    ratings.set(game.away, {points:a - move, year:seasonYear});
    if (day - game.day <= 365) recent.push(game);
  }
  const shots = recent.filter(g => g.ht !== null && g.at !== null);
  if (recent.length < 30 || !shots.length) return null;
  const homeGoals = recent.reduce((v,g) => v + g.hg, 0) / recent.length;
  const awayGoals = recent.reduce((v,g) => v + g.ag, 0) / recent.length;
  const leagueGoals = (homeGoals + awayGoals) / 2;
  const leagueShots = shots.reduce((v,g) => v + g.ht! + g.at!, 0) / (2 * shots.length);
  if (Math.min(homeGoals, awayGoals, leagueShots) <= 0) return null;

  function teamForm(team:string) {
    const games = recent.filter(g => g.home === team || g.away === team).slice(-20);
    if (games.length < 5 || day - games[games.length - 1].day > 120) return null;
    let goalWeight = 0, shotWeight = 0, shotGames = 0;
    let scored = 0, conceded = 0, shotsFor = 0, shotsAgainst = 0;
    for (const g of games) {
      const weight = Math.exp(-(day - g.day) / 90), atHome = g.home === team;
      goalWeight += weight;
      scored += weight * (atHome ? g.hg : g.ag);
      conceded += weight * (atHome ? g.ag : g.hg);
      if (g.ht === null || g.at === null) continue;
      shotWeight += weight;
      shotGames++;
      shotsFor += weight * (atHome ? g.ht : g.at);
      shotsAgainst += weight * (atHome ? g.at : g.ht);
    }
    if (shotGames < 5) return null;
    const relative = (total:number, weight:number, mean:number) => Math.log((total + 5 * mean) / ((weight + 5) * mean));
    return {attack:relative(scored, goalWeight, leagueGoals), defense:relative(conceded, goalWeight, leagueGoals),
      shotsFor:relative(shotsFor, shotWeight, leagueShots), shotsAgainst:relative(shotsAgainst, shotWeight, leagueShots), shotGames};
  }
  const h = teamForm(home), a = teamForm(away);
  if (!h || !a) return null;
  const elo = (rating(home, year) - rating(away, year)) / 400;
  return {rows:[[1, Math.log(homeGoals), 1, elo, h.attack, a.defense, h.shotsFor, a.shotsAgainst],
    [1, Math.log(awayGoals), -1, -elo, a.attack, h.defense, a.shotsFor, h.shotsAgainst]],
    homeGames:h.shotGames, awayGames:a.shotGames};
}

export function shotRates(rows:number[][], fit:ShotFit) {
  const rates = rows.map(row => Math.exp(fit.b.reduce((v,b,i) => v + b * (row[i] - fit.mean[i]) / fit.std[i], 0)));
  return rates.every(v => Number.isFinite(v) && v > 0 && v < 10) ? rates : null;
}
