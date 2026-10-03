import {
  isFootballNationalCompetition,
  parseFootballTeamHistory,
  type FootballLeague,
} from "./football";
import { footballProfileTeam } from "./football-team-profile";
import {
  footballRegulationResults,
  footballSeasonGames,
  parseFootballBenchmark,
  parseFootballRoster,
  type FootballSeasonProfile,
  type FootballRoster,
} from "./football-team-details";
const ROOT = "https://site.api.espn.com/apis/site/v2/sports/soccer";
const cache = new Map<string, { expires: number; value: any }>(),
  pending = new Map<string, Promise<any>>();
let active = 0;
const queue: (() => void)[] = [];
async function source(url: string, ttl: number) {
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.value;
  if (pending.has(url)) return pending.get(url)!;
  if (queue.length >= 40) throw Error("球隊資料更新中");
  const task = (async () => {
    if (active >= 4) await new Promise<void>((resolve) => queue.push(resolve));
    else active++;
    try {
      const r = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(18000),
      });
      if (!r.ok) throw Error("足球資料暫時無法取得");
      const text = await r.text();
      if (text.length > 6000000) throw Error("球隊來源資料過大");
      const value = JSON.parse(text);
      if (cache.size >= 120) cache.delete(cache.keys().next().value!);
      cache.set(url, { value, expires: Date.now() + ttl });
      return value;
    } finally {
      const next = queue.shift();
      if (next) next();
      else active--;
    }
  })().finally(() => pending.delete(url));
  pending.set(url, task);
  return task;
}
function checkedTeam(raw: any, league: FootballLeague, id: string) {
  const team = footballProfileTeam(raw?.team, id);
  if (raw.team.isNational !== isFootballNationalCompetition(league))
    throw Error("球隊賽事類別不符");
  return team;
}
export async function footballSeasonProfile(
  league: FootballLeague,
  id: string,
  season: number,
): Promise<FootballSeasonProfile> {
  const responses = await Promise.allSettled(
    [false, true].map(async (fixture) => {
      const raw = await source(
        `${ROOT}/all/teams/${id}/schedule?season=${season}${fixture ? "&fixture=true" : ""}&limit=100`,
        fixture ? 5 * 60000 : 10 * 60000,
      );
      const team = checkedTeam(raw, league, id);
      if (!Array.isArray(raw.events) || raw.events.length >= 100)
        throw Error("球隊年度資料不完整");
      return { team, games: parseFootballTeamHistory(raw, id, league, true) };
    }),
  );
  if (responses[0].status !== "fulfilled")
    throw Error("球隊年度資料暫時無法讀取");
  const history = responses.flatMap((r) =>
      r.status === "fulfilled" ? r.value.games : [],
    ),
    games = footballSeasonGames(history, league, id, season),
    now = Date.now();
  return {
    league,
    season,
    team: responses[0].value.team,
    games,
    results: footballRegulationResults(games, now),
    upcoming:
      responses[1].status === "fulfilled"
        ? games
            .filter((g) => g.state === "scheduled" && Date.parse(g.start) > now)
            .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
        : null,
    fetchedAt: new Date(now).toISOString(),
  };
}
export async function footballSeasonRoster(
  league: FootballLeague,
  id: string,
  season: number,
): Promise<FootballRoster> {
  const raw = await source(
      `${ROOT}/${league}/teams/${id}/roster?season=${season}`,
      10 * 60000,
    ),
    team = checkedTeam(raw, league, id);
  return {
    league,
    season,
    team,
    players: parseFootballRoster(raw, league, id, season, team),
    fetchedAt: new Date().toISOString(),
  };
}
export async function footballSeasonBenchmark(
  league: FootballLeague,
  season: number,
) {
  const raw = await source(
    `https://site.web.api.espn.com/apis/v2/sports/soccer/${league}/standings?season=${season}`,
    10 * 60000,
  );
  return parseFootballBenchmark(raw, league, season);
}
