import {
  footballDay,
  isFootballFormCompetition,
  isFootballNationalCompetition,
  type FootballGame,
  type FootballLeague,
  type FootballTeam,
} from "./football";
import {
  footballVenue,
  summarizeFootballProfile,
  type FootballVenue,
} from "./football-team-profile";
import { reconcileFootballHistory } from "./football-history";

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
  Number(footballDay(new Date(now)).slice(0, 4));
export const footballProfileDefaultSeason = (
  league: FootballLeague,
  now = Date.now(),
) => {
  const day = footballDay(new Date(now)),
    year = Number(day.slice(0, 4));
  return isFootballNationalCompetition(league) || Number(day.slice(5, 7)) >= 7
    ? year
    : year - 1;
};
export const validFootballProfileSeason = (year: number, now = Date.now()) =>
  Number.isInteger(year) && year >= 2021 && year <= footballProfileYear(now);
const involves = (g: FootballGame<string>, id: string) =>
  g.home.id === id || g.away.id === id;
export function footballSeasonGames(
  history: FootballGame<string>[],
  league: FootballLeague,
  id: string,
  season: number,
) {
  return reconcileFootballHistory(history, [])
    .games.filter(
      (g) =>
        involves(g, id) &&
        g.season === season &&
        isFootballFormCompetition(g.league, league, true),
    )
    .sort(
      (a, b) =>
        Date.parse(b.start) - Date.parse(a.start) || a.id.localeCompare(b.id),
    );
}
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
const number = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
export function parseFootballRoster(
  raw: any,
  league: FootballLeague,
  id: string,
  season: number,
  team: FootballTeam,
): FootballRosterPlayer[] {
  if (
    String(raw?.team?.id) !== id ||
    Number(raw?.season?.year) !== season ||
    raw.team.isNational !== isFootballNationalCompetition(league) ||
    !Array.isArray(raw.athletes) ||
    raw.athletes.length > 200 ||
    team.id !== id
  )
    throw Error("球員名單身分或年度不符");
  const seen = new Set<string>();
  return raw.athletes.map((p: any) => {
    const playerId = String(p.id),
      name = String(p.displayName || p.fullName || "").trim();
    if (!/^\d{1,12}$/.test(playerId) || !name || seen.has(playerId))
      throw Error("球員名單格式不符");
    seen.add(playerId);
    const stats = (p.statistics?.splits?.categories || []).flatMap((c: any) =>
        Array.isArray(c.stats) ? c.stats : [],
      ),
      stat = (key: string) =>
        number(stats.find((s: any) => s.name === key)?.value);
    const photo = `/api/football-player-photo?player=${playerId}&league=${league}`;
    return {
      id: playerId,
      name,
      number: String(p.jersey || ""),
      position: String(p.position?.abbreviation || ""),
      country: String(p.citizenship || ""),
      height: String(p.displayHeight || ""),
      photo,
      href: `https://www.espn.com/soccer/player/stats/_/id/${playerId}`,
      appearances: stat("appearances"),
      goals: stat("totalGoals"),
      assists: stat("goalAssists"),
    };
  });
}
export function parseFootballBenchmark(
  raw: any,
  league: FootballLeague,
  season: number,
): FootballBenchmark {
  if (Number(raw?.season?.year) !== season) throw Error("聯賽比較年度不符");
  const records: Record<string, FootballStandingRecord> = {};
  function visit(node: any) {
    const table = node?.standings;
    if (table && Array.isArray(table.entries) && table.entries.length) {
      if (
        Number(table.season) !== season ||
        !table.links?.some(
          (l: any) =>
            l.href === `https://www.espn.com/soccer/table/_/league/${league}`,
        )
      )
        throw Error("聯賽比較來源不符");
      for (const e of table.entries) {
        const id = String(e.team?.id),
          stat = (key: string) =>
            number(e.stats?.find((s: any) => s.name === key)?.value);
        const r = {
          games: stat("gamesPlayed"),
          wins: stat("wins"),
          draws: stat("ties"),
          losses: stat("losses"),
          scored: stat("pointsFor"),
          conceded: stat("pointsAgainst"),
        };
        if (
          !/^\d+$/.test(id) ||
          Object.values(r).some((v) => v === null || !Number.isInteger(v)) ||
          r.games !== r.wins! + r.draws! + r.losses!
        )
          throw Error("聯賽比較數據不完整");
        if (records[id] && JSON.stringify(records[id]) !== JSON.stringify(r))
          throw Error("聯賽分組數據重複");
        records[id] = r as FootballStandingRecord;
      }
    }
    for (const child of node?.children || []) visit(child);
  }
  visit(raw);
  const rows = Object.values(records),
    sum = (key: keyof FootballStandingRecord) =>
      rows.reduce((s, r) => s + r[key], 0),
    games = sum("games");
  if (
    rows.length < 2 ||
    !games ||
    games % 2 ||
    sum("draws") % 2 ||
    sum("wins") !== sum("losses") ||
    sum("scored") !== sum("conceded")
  )
    throw Error("聯賽比較資料尚未完整");
  return {
    league,
    season,
    teams: rows.length,
    games: games / 2,
    winRate: sum("wins") / games,
    drawRate: sum("draws") / games,
    unbeatenRate: (sum("wins") + sum("draws")) / games,
    scoredPerGame: sum("scored") / games,
    concededPerGame: sum("conceded") / games,
    pointsPerGame: (3 * sum("wins") + sum("draws")) / games,
    records,
  };
}
