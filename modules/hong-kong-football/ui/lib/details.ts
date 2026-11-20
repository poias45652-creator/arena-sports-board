import {footballDay,footballVenue,summarizeFootballProfile,isFootballNationalCompetition} from './hong-kong';
export type FootballSeasonProfile = {
  league: FootballLeague;
  season: number;
  team: FootballTeam;
  games: FootballGame<string>[];
  results: FootballGame<string>[];
  upcoming: FootballGame<string>[] | null;
  fetchedAt: string;
};
export type FootballRosterPlayer = {
  englishName?: string;
  id: string;
  name: string;
  number: string;
  position: string;
  country: string;
  height: string;
  photo: string;
  href: string;
  appearances: number | null;
  goals: number | null;
  assists: number | null;
};
export type FootballRoster = {
  league: FootballLeague;
  season: number;
  team: FootballTeam;
  players: FootballRosterPlayer[];
  fetchedAt: string;
};
export type FootballStandingRecord = {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  scored: number;
  conceded: number;
};
export type FootballBenchmark = {
  league: FootballLeague;
  season: number;
  teams: number;
  games: number;
  winRate: number;
  drawRate: number;
  unbeatenRate: number;
  scoredPerGame: number;
  concededPerGame: number;
  pointsPerGame: number;
  records: Record<string, FootballStandingRecord>;
};
export type FootballProfileTab = "overview" | "trends" | "games" | "players";
export const FOOTBALL_PROFILE_TABS = [
  ["overview", "概覽"],
  ["trends", "月度趨勢"],
  ["games", "近期賽事"],
  ["players", "球員"],
] as const;
export const footballProfileYear = (now = Date.now()) =>
  Math.min(2026,Number(footballDay(new Date(now)).slice(0, 4)));
export const footballProfileDefaultSeason = (
  league: FootballLeague,
  now = Date.now(),
) => {
  const day = footballDay(new Date(now)),
    year = Number(day.slice(0, 4));
  return isFootballNationalCompetition(league) || Number(day.slice(5, 7)) >= 7
    ? Math.min(year,2026)
    : Math.min(year-1,2026);
};
export const validFootballProfileSeason = (year: number, now = Date.now()) =>
  Number.isInteger(year) && year >= 2021 && year <= footballProfileYear(now);
const involves = (g: FootballGame<string>, id: string) =>
  g.home.id === id || g.away.id === id;
export function footballRegulationResults(
  games: FootballGame<string>[],
  now = Date.now(),
) {
  return games.filter(
    (g) =>
      g.state === "final" &&
      g.statusName === "STATUS_FULL_TIME" &&
      g.homeScore !== null &&
      g.awayScore !== null &&
      Date.parse(g.start) < now,
  );
}
export function filterFootballSeasonGames(
  games: FootballGame<string>[],
  id: string,
  competition = "all",
  venue: FootballVenue = "all",
  limit = 0,
) {
  const rows = games
    .filter(
      (g) =>
        involves(g, id) &&
        (competition === "all" || g.league === competition) &&
        (venue === "all" || footballVenue(g, id) === venue),
    )
    .sort(
      (a, b) =>
        Date.parse(b.start) - Date.parse(a.start) || a.id.localeCompare(b.id),
    );
  return limit > 0 ? rows.slice(0, limit) : rows;
}
export function footballSeasonSummary(
  games: FootballGame<string>[],
  id: string,
) {
  const rows = footballRegulationResults(games)
      .filter((g) => involves(g, id))
      .sort((a, b) => Date.parse(b.start) - Date.parse(a.start)),
    s = summarizeFootballProfile(rows, id);
  let winMargin = 0,
    lossMargin = 0,
    streak = 0,
    last = "",
    inStreak = true;
  for (const g of rows) {
    const diff =
      g.home.id === id
        ? g.homeScore! - g.awayScore!
        : g.awayScore! - g.homeScore!;
    if (diff > 0) winMargin += diff;
    else if (diff < 0) lossMargin -= diff;
    const result = diff > 0 ? "勝" : diff < 0 ? "負" : "和";
    if (inStreak && (!streak || last === result)) {
      streak++;
      last = result;
    } else inStreak = false;
  }
  return {
    ...s,
    drawRate: s.games ? s.draws / s.games : null,
    unbeatenRate: s.games ? (s.wins + s.draws) / s.games : null,
    pointsPerGame: s.games ? (3 * s.wins + s.draws) / s.games : null,
    goalDifferencePerGame: s.games ? s.goalDifference / s.games : null,
    winMargin: s.wins ? winMargin / s.wins : null,
    lossMargin: s.losses ? lossMargin / s.losses : null,
    streak: streak ? `${streak} 連${last}` : "—",
  };
}
export function footballMonthlySummary(
  games: FootballGame<string>[],
  id: string,
) {
  const groups = new Map<string, FootballGame<string>[]>();
  for (const g of games) {
    const month = footballDay(g.start).slice(0, 7);
    groups.set(month, [...(groups.get(month) || []), g]);
  }
  if (!groups.size) return [];
  const keys = [...groups.keys()].sort(),
    start = new Date(keys[0] + "-01T12:00:00Z"),
    end = keys[keys.length - 1],
    rows = [];
  for (
    let d = start;
    d.toISOString().slice(0, 7) <= end;
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 12))
  ) {
    const month = d.toISOString().slice(0, 7);
    rows.push({ month, ...footballSeasonSummary(groups.get(month) || [], id) });
  }
  return rows;
}
export function footballOpponentSummary(
  games: FootballGame<string>[],
  id: string,
) {
  const opponents = new Map<string, FootballTeam>();
  for (const g of games) {
    if (!involves(g, id)) continue;
    const opponent = g.home.id === id ? g.away : g.home;
    opponents.set(opponent.id, opponent);
  }
  return [...opponents.values()]
    .map((team) => ({
      team,
      ...footballSeasonSummary(
        games.filter((g) => involves(g, team.id)),
        id,
      ),
    }))
    .sort(
      (a, b) =>
        b.games - a.games || a.team.name.localeCompare(b.team.name, "zh-TW"),
    );
}
