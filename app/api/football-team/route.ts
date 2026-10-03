import { isFootballLeague } from "@/lib/football";
import { footballTeamProfile } from "@/lib/football-source";
import { validFootballProfileSeason } from "@/lib/football-team-details";
import {
  footballSeasonProfile,
  footballSeasonRoster,
  footballSeasonBenchmark,
} from "@/lib/football-team-details-source";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const p = new URL(request.url).searchParams,
    league = p.get("league") || "",
    team = p.get("team") || "",
    headers = { "Cache-Control": "private, no-store" };
  if (!isFootballLeague(league) || !/^\d{1,12}$/.test(team))
    return Response.json(
      { error: "足球聯賽或球隊參數錯誤" },
      { status: 400, headers },
    );
  const season = p.has("season") ? Number(p.get("season")) : undefined,
    action = p.get("action") || "profile";
  if (
    !["profile", "roster", "benchmark"].includes(action) ||
    (season !== undefined &&
      (!/^\d{4}$/.test(p.get("season") || "") ||
        !validFootballProfileSeason(season))) ||
    (action !== "profile" && season === undefined)
  )
    return Response.json(
      { error: "足球年度或資料類型錯誤" },
      { status: 400, headers },
    );
  try {
    return Response.json(
      season === undefined
        ? await footballTeamProfile(league, team)
        : action === "roster"
          ? await footballSeasonRoster(league, team, season)
          : action === "benchmark"
            ? await footballSeasonBenchmark(league, season)
            : await footballSeasonProfile(league, team, season),
      { headers },
    );
  } catch {
    return Response.json(
      { error: "球隊資料暫時無法讀取，請稍後重試。" },
      { status: 503, headers },
    );
  }
}
