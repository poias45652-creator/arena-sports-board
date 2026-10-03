"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, RefreshCw, Search, UserRound } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ChartContainer } from "@/components/ui/chart";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  FOOTBALL_LEAGUES,
  footballDay,
  type FootballGame,
  type FootballLeague,
} from "@/lib/football";
import {
  footballBoardHref,
  footballCompetitionName,
  footballTeamHref,
  footballVenue,
  type FootballVenue,
} from "@/lib/football-team-profile";
import {
  FOOTBALL_PROFILE_TABS,
  filterFootballSeasonGames,
  footballMonthlySummary,
  footballOpponentSummary,
  footballProfileDefaultSeason,
  footballProfileYear,
  footballSeasonSummary,
  type FootballBenchmark,
  type FootballProfileTab,
  type FootballRoster,
  type FootballRosterPlayer,
  type FootballSeasonProfile,
} from "@/lib/football-team-details";
import "./football.css";
import "./football-team-profile.css";

const decimal = (n: number | null | undefined) =>
    typeof n === "number" ? n.toFixed(2) : "—",
  percent = (n: number | null | undefined) =>
    typeof n === "number" ? (100 * n).toFixed(1) + "%" : "—";
const dateTime = (date: string, time = true) =>
  new Date(date).toLocaleString("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(time ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  });
const venueNames = {
  all: "全部",
  home: "主場",
  away: "客場",
  neutral: "中立場",
};
const positionNames: Record<string, string> = {
  G: "門將",
  GK: "門將",
  D: "後衛",
  M: "中場",
  F: "前鋒",
};
function useProfileData<T>(query: string | null, revision: number) {
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string;
    loading: boolean;
  }>({ key: "", data: null, error: "", loading: false });
  useEffect(() => {
    if (!query) return;
    const c = new AbortController();
    setState({ key: query, data: null, error: "", loading: true });
    fetch("/api/football-team?" + query, {
      cache: "no-store",
      signal: AbortSignal.any([c.signal, AbortSignal.timeout(55000)]),
    })
      .then(async (r) => {
        if (r.status === 401) {
          window.location.assign("/login");
          throw Error("請重新登入");
        }
        const d = await r.json();
        if (!r.ok) throw Error(d.error || "資料讀取失敗");
        const p = new URLSearchParams(query);
        if (
          d.league !== p.get("league") ||
          d.season !== Number(p.get("season")) ||
          (p.get("action") !== "benchmark" && d.team?.id !== p.get("team"))
        )
          throw Error("球隊資料不符");
        if (!c.signal.aborted)
          setState({ key: query, data: d, error: "", loading: false });
      })
      .catch((e) => {
        if (!c.signal.aborted)
          setState({
            key: query,
            data: null,
            error: e instanceof Error ? e.message : "資料讀取失敗",
            loading: false,
          });
      });
    return () => c.abort();
  }, [query, revision]);
  return state.key === query
    ? state
    : { key: query || "", data: null, error: "", loading: !!query };
}
function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="team-filter">
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}
function TeamLogo({ id, size = 24 }: { id: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <span
      className="football-logo-fallback"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      ⚽
    </span>
  ) : (
    <img
      src={`https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
export default function FootballTeamProfile({
  league,
  teamId,
  returnDay,
}: {
  league: FootballLeague;
  teamId: string;
  returnDay?: string;
}) {
  const [season, setSeason] = useState(() =>
      footballProfileDefaultSeason(league),
    ),
    [competition, setCompetition] = useState<string>(league),
    [venue, setVenue] = useState<FootballVenue>("all"),
    [limit, setLimit] = useState(0),
    [view, setView] = useState<FootballProfileTab>("overview"),
    [revision, setRevision] = useState(0),
    [metric, setMetric] = useState("goals");
  const current = footballProfileYear(),
    query = new URLSearchParams({
      league,
      team: teamId,
      season: String(season),
    }).toString();
  const profile = useProfileData<FootballSeasonProfile>(query, revision),
    roster = useProfileData<FootballRoster>(
      view === "players" ? query + "&action=roster" : null,
      revision,
    );
  const benchmark = useProfileData<FootballBenchmark>(
    view === "overview" &&
      competition === league &&
      venue === "all" &&
      limit === 0
      ? query + "&action=benchmark"
      : null,
    revision,
  );
  const data = profile.data,
    leagueInfo = FOOTBALL_LEAGUES.find((l) => l.code === league)!;
  const allResults = useMemo(
    () => filterFootballSeasonGames(data?.results || [], teamId, competition),
    [data, teamId, competition],
  );
  const selected = useMemo(
    () => filterFootballSeasonGames(allResults, teamId, "all", venue, limit),
    [allResults, teamId, venue, limit],
  );
  const stats = useMemo(
      () => footballSeasonSummary(selected, teamId),
      [selected, teamId],
    ),
    wholeSeason = useMemo(
      () => footballSeasonSummary(allResults, teamId),
      [allResults, teamId],
    );
  const opponents = useMemo(
      () => footballOpponentSummary(selected, teamId),
      [selected, teamId],
    ),
    monthly = useMemo(
      () => footballMonthlySummary(selected, teamId),
      [selected, teamId],
    );
  const standing = benchmark.data?.records[teamId],
    sameCoverage =
      standing &&
      standing.games === stats.games &&
      standing.wins === stats.wins &&
      standing.draws === stats.draws &&
      standing.losses === stats.losses &&
      standing.scored === stats.scored &&
      standing.conceded === stats.conceded;
  const comparison = sameCoverage ? benchmark.data! : wholeSeason,
    comparisonName = sameCoverage ? `${leagueInfo.name}平均` : "全季平均";
  const competitions = [
    ...new Set([league, ...(data?.games || []).map((g) => g.league)]),
  ];
  if (!competitions.includes(competition) && competition !== "all")
    competitions.push(competition);
  const games = filterFootballSeasonGames(
      data?.games || [],
      teamId,
      competition,
      venue,
    ),
    loading = view === "players" ? roster.loading : profile.loading;
  const team = data?.team || roster.data?.team;
  const metrics: [string, string, string][] = [
    [
      "戰績",
      `${stats.wins}－${stats.draws}－${stats.losses}`,
      `勝・和・負 / ${stats.games} 場`,
    ],
    ["勝率", percent(stats.winRate), stats.streak],
    [
      "場均進球",
      decimal(stats.scoredPerGame),
      `失球 ${decimal(stats.concededPerGame)}`,
    ],
    ["場均淨勝球", decimal(stats.goalDifferencePerGame), "每場"],
    ["平均勝球差", decimal(stats.winMargin), `${stats.wins} 勝`],
    ["平均敗球差", decimal(stats.lossMargin), `${stats.losses} 負`],
  ];
  const comparisons: [string, number | null, number | null, boolean][] = [
    ["勝率", stats.winRate, comparison.winRate, true],
    ["場均進球", stats.scoredPerGame, comparison.scoredPerGame, false],
    ["場均失球", stats.concededPerGame, comparison.concededPerGame, false],
    ["不敗率", stats.unbeatenRate, comparison.unbeatenRate, true],
    ["和局率", stats.drawRate, comparison.drawRate, true],
    ["場均積分", stats.pointsPerGame, comparison.pointsPerGame, false],
  ];
  return (
    <main
      className="arena-shell football-team-page football-team-dashboard"
      data-sport="football"
    >
      <header className="team-page-nav">
        <a href={footballBoardHref(league, returnDay)}>
          <ArrowLeft size={17} />
          賽前分析・足球
        </a>
        <a href={footballBoardHref(league, returnDay)}>足球賽事</a>
      </header>
      <div className="team-page-container">
        <div className="team-identity">
          <TeamLogo key={teamId} id={teamId} size={80} />
          <div>
            <p className="league-eyebrow">{leagueInfo.name} / 球隊資料</p>
            <h1>{team?.name || "球隊數據"}</h1>
            {team && (
              <p className="football-team-english">{team.englishName}</p>
            )}
          </div>
          <button
            className="football-dashboard-button"
            type="button"
            onClick={() => setRevision((n) => n + 1)}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            更新
          </button>
        </div>
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as FootballProfileTab)}
        >
          <TabsList className="league-tabs" aria-label="球隊資料分類">
            {FOOTBALL_PROFILE_TABS.map(([value, label]) => (
              <TabsTrigger key={value} value={value}>
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value={view}>
            <div className="team-filters panel football-dashboard-filters">
              <Filter
                label="賽季"
                value={String(season)}
                onChange={(v) => setSeason(Number(v))}
                options={Array.from({ length: current - 2020 }, (_, i) => [
                  String(current - i),
                  String(current - i),
                ])}
              />
              {view !== "players" && (
                <>
                  <Filter
                    label="賽事類型"
                    value={competition}
                    onChange={setCompetition}
                    options={[
                      ["all", "全部賽事"],
                      ...competitions.map(
                        (code) =>
                          [code, footballCompetitionName(code)] as [
                            string,
                            string,
                          ],
                      ),
                    ]}
                  />
                  <Filter
                    label="主客場"
                    value={venue}
                    onChange={(v) => setVenue(v as FootballVenue)}
                    options={Object.entries(venueNames).map(
                      ([value, label]) => [value, label],
                    )}
                  />
                  {view !== "games" && (
                    <Filter
                      label="場數"
                      value={String(limit)}
                      onChange={(v) => setLimit(Number(v))}
                      options={[
                        ["0", "全季"],
                        ["5", "近 5 場"],
                        ["10", "近 10 場"],
                        ["20", "近 20 場"],
                      ]}
                    />
                  )}
                </>
              )}
            </div>
            {view === "players" ? (
              <FootballPlayers
                data={roster.data}
                loading={roster.loading}
                error={roster.error}
                retry={() => setRevision((n) => n + 1)}
              />
            ) : profile.error ? (
              <DataError
                message={profile.error}
                retry={() => setRevision((n) => n + 1)}
              />
            ) : !data ? (
              <div className="panel football-dashboard-loading" role="status">
                <RefreshCw className="animate-spin" size={22} />
                正在整理球隊資料…
              </div>
            ) : (
              <>
                {view !== "games" && (
                  <div className="team-metrics">
                    {metrics.map(([label, value, note]) => (
                      <div key={label}>
                        <span>{label}</span>
                        <strong>{value}</strong>
                        <small>{note}</small>
                      </div>
                    ))}
                  </div>
                )}
                {view === "overview" && (
                  <>
                    <div className="team-detail-grid">
                      <section className="panel football-dashboard-panel">
                        <h2 className="team-section-title">團隊數據比較</h2>
                        {comparisons.map(([label, a, b, rate]) => (
                          <div className="team-comparison" key={label}>
                            <div>
                              <b>{rate ? percent(a) : decimal(a)}</b>
                              <span>{label}</span>
                              <b>{rate ? percent(b) : decimal(b)}</b>
                            </div>
                            <div className="comparison-bars" aria-hidden="true">
                              {typeof a === "number" &&
                              typeof b === "number" &&
                              a + b > 0 ? (
                                <>
                                  <span
                                    style={{ width: `${(a / (a + b)) * 100}%` }}
                                  />
                                  <span
                                    style={{ width: `${(b / (a + b)) * 100}%` }}
                                  />
                                </>
                              ) : (
                                <span className="football-empty-bar" />
                              )}
                            </div>
                            <div>
                              <small className="football-comparison-team">
                                <TeamLogo id={teamId} size={20} />
                                {data.team.name}
                              </small>
                              <small>{comparisonName}</small>
                            </div>
                          </div>
                        ))}
                        <p className="team-footnote">
                          勝率以全部場次（含和局）為分母；積分以勝 3 分、和 1 分計算。
                        </p>
                      </section>
                      <section className="panel football-dashboard-panel">
                        <h2 className="team-section-title">對各隊戰績</h2>
                        {opponents.length ? (
                          opponents.map((r) => (
                            <div className="team-opponent" key={r.team.id}>
                              <div>
                                <a
                                  href={footballTeamHref(
                                    league,
                                    r.team.id,
                                    returnDay,
                                  )}
                                  className="football-comparison-team"
                                >
                                  <TeamLogo id={r.team.id} />
                                  {r.team.name}
                                </a>
                                <span>{r.games} 場</span>
                              </div>
                              <small>
                                勝 {r.wins}・和 {r.draws}・負 {r.losses}
                              </small>
                              <div
                                className="opponent-bar"
                                aria-label={`${r.wins}勝${r.draws}和${r.losses}負`}
                              >
                                <span
                                  className="football-win"
                                  style={{
                                    width: `${(r.wins / r.games) * 100}%`,
                                  }}
                                />
                                <span
                                  className="football-draw"
                                  style={{
                                    width: `${(r.draws / r.games) * 100}%`,
                                  }}
                                />
                                <span
                                  className="football-loss"
                                  style={{
                                    width: `${(r.losses / r.games) * 100}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="football-profile-empty">
                            這個範圍沒有已完賽紀錄。
                          </p>
                        )}
                      </section>
                    </div>
                    <section
                      className="football-extra-metrics"
                      aria-label="足球表現數據"
                    >
                      {[
                        ["零封率", percent(stats.cleanSheetRate)],
                        ["雙方進球", percent(stats.bttsRate)],
                        ["大於 2.5 球", percent(stats.over25Rate)],
                      ].map(([label, value]) => (
                        <div className="panel" key={label}>
                          <span>{label}</span>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </section>
                  </>
                )}
                {view === "trends" && (
                  <section className="panel football-dashboard-panel">
                    <h2 className="team-section-title">月度趨勢</h2>
                    <div
                      className="football-trend-options"
                      role="group"
                      aria-label="趨勢指標"
                    >
                      {[
                        ["goals", "進球與失球"],
                        ["winRate", "勝率"],
                        ["pointsPerGame", "場均積分"],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          className="football-dashboard-button"
                          type="button"
                          aria-pressed={metric === key}
                          onClick={() => setMetric(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    {!selected.length ? (
                      <p className="football-profile-empty">
                        此範圍沒有可繪製的完場紀錄。
                      </p>
                    ) : (
                      <>
                        <ChartContainer
                          config={{
                            scoredPerGame: {
                              label: "場均進球",
                              color: "#ffd538",
                            },
                            concededPerGame: {
                              label: "場均失球",
                              color: "#38bdf8",
                            },
                            winRate: { label: "勝率", color: "#ffd538" },
                            pointsPerGame: {
                              label: "場均積分",
                              color: "#ffd538",
                            },
                          }}
                          className="football-trend-chart"
                        >
                          <LineChart
                            data={monthly}
                            margin={{ left: 0, right: 16, top: 16, bottom: 4 }}
                            accessibilityLayer
                          >
                            <CartesianGrid vertical={false} stroke="#263447" />
                            <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#9fb1c6" }} />
                            <YAxis
                              width={48}
                              domain={
                                metric === "winRate" ? [0, 1] : [0, "auto"]
                              }
                              tickFormatter={(v) =>
                                metric === "winRate"
                                  ? `${Math.round(v * 100)}%`
                                  : decimal(v)
                              }
                            />
                            <Tooltip
                              contentStyle={{
                                background: "#101b2a",
                                borderColor: "#344158",
                                color: "#fff",
                              }}
                              formatter={(v: any) =>
                                metric === "winRate" ? percent(v) : decimal(v)
                              }
                            />
                            <Legend />
                            {metric === "goals" ? (
                              <>
                                <Line
                                  dataKey="scoredPerGame"
                                  name="場均進球"
                                  stroke="#ffd538"
                                  strokeWidth={3}
                                  connectNulls={false}
                                />
                                <Line
                                  dataKey="concededPerGame"
                                  name="場均失球"
                                  stroke="#38bdf8"
                                  strokeWidth={2}
                                  connectNulls={false}
                                />
                              </>
                            ) : (
                              <Line
                                dataKey={metric}
                                name={
                                  metric === "winRate" ? "勝率" : "場均積分"
                                }
                                stroke="#ffd538"
                                strokeWidth={3}
                                connectNulls={false}
                              />
                            )}
                          </LineChart>
                        </ChartContainer>
                        <div className="football-table-scroll">
                          <table className="football-month-table">
                            <thead>
                              <tr>
                                <th>月份</th>
                                <th>場次</th>
                                <th>勝・和・負</th>
                                <th>進球</th>
                                <th>失球</th>
                                <th>勝率</th>
                              </tr>
                            </thead>
                            <tbody>
                              {monthly.map((r) => (
                                <tr key={r.month}>
                                  <th>{r.month}</th>
                                  <td>{r.games}</td>
                                  <td>
                                    {r.wins}・{r.draws}・{r.losses}
                                  </td>
                                  <td>{r.games ? r.scored : "—"}</td>
                                  <td>{r.games ? r.conceded : "—"}</td>
                                  <td>{percent(r.winRate)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </section>
                )}
                {view === "games" && (
                  <FootballMatches
                    key={`${season}:${competition}:${venue}`}
                    games={games}
                    teamId={teamId}
                    upcomingMissing={data.upcoming === null}
                    retry={() => setRevision((n) => n + 1)}
                  />
                )}
                {view !== "games" && (
                  <p className="team-footnote">
                    統計採 90 分鐘完場賽果，延長賽與互射十二碼不計入。
                  </p>
                )}
              </>
            )}
            <footer className="football-profile-footer">
              {season} 賽季・ESPN
              {(view === "players"
                ? roster.data?.fetchedAt
                : data?.fetchedAt) &&
                `・更新 ${dateTime(view === "players" ? roster.data!.fetchedAt : data!.fetchedAt)}（台灣時間）`}
            </footer>
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
function DataError({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="football-alert" role="alert">
      {message}
      <button type="button" onClick={retry}>
        重新載入
      </button>
    </div>
  );
}
function FootballPlayers({
  data,
  loading,
  error,
  retry,
}: {
  data: FootballRoster | null;
  loading: boolean;
  error: string;
  retry: () => void;
}) {
  const [position, setPosition] = useState("all"),
    [search, setSearch] = useState("");
  const players = (data?.players || []).filter(
    (p) =>
      (position === "all" || p.position === position) &&
      p.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <section className="panel football-dashboard-panel">
      <h2 className="team-section-title">球員名單</h2>
      <div className="team-filters football-dashboard-filters football-roster-filters">
        <Filter
          label="位置"
          value={position}
          onChange={setPosition}
          options={[
            ["all", "全部"],
            ["G", "門將"],
            ["D", "後衛"],
            ["M", "中場"],
            ["F", "前鋒"],
          ]}
        />
        <label className="team-filter">
          <span>搜尋球員</span>
          <div className="football-player-search">
            <Search size={16} />
            <input
              aria-label="搜尋球員"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="輸入球員姓名"
            />
          </div>
        </label>
      </div>
      {loading ? (
        <div className="football-dashboard-loading" role="status">
          正在取得球員名單…
        </div>
      ) : error ? (
        <DataError message={error} retry={retry} />
      ) : (
        <>
          <p className="team-footnote">
            {data?.season} 賽季・{players.length} 位球員
          </p>
          <div className="team-player-grid">
            {players.map((p) => (
              <FootballPlayerCard key={p.id} player={p} />
            ))}
          </div>
          {!players.length && (
            <p className="football-profile-empty">
              {search || position !== "all"
                ? "沒有符合條件的球員。"
                : "此年度尚無球員名單。"}
            </p>
          )}
        </>
      )}
    </section>
  );
}
function FootballPlayerCard({ player: p }: { player: FootballRosterPlayer }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!failed || attempt >= 2) return;
    const retry = setTimeout(() => { setFailed(false); setAttempt(n => n + 1); }, 2000 * (attempt + 1));
    return () => clearTimeout(retry);
  }, [failed, attempt]);
  return (
    <article className="team-player-card football-player-card">
      <div className="football-player-portrait">
        {failed ? (
          <UserRound size={48} aria-label="尚無球員照片" />
        ) : (
          <img
            src={p.photo + (attempt ? `&retry=${attempt}` : "")}
            alt={p.name}
            decoding="async"
            width={100}
            height={100}
            loading="lazy"
            onError={() => setFailed(true)}
          />
        )}
      </div>
      <h3>
        <a href={p.href} target="_blank" rel="noreferrer">
          {p.name} ↗
        </a>
      </h3>
      <p>
        #{p.number || "—"}・
        {positionNames[p.position] || p.position || "未公布位置"}
      </p>
      <p>
        {p.country || "—"}
        {p.height ? `・${p.height}` : ""}
      </p>
      <dl className="football-player-statline">
        {[
          ["出場", p.appearances],
          ["進球", p.goals],
          ["助攻", p.assists],
        ].map(([label, value]) => (
          <div key={String(label)}>
            <dt>{label}</dt>
            <dd>{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </article>
  );
}
function FootballMatches({
  games,
  teamId,
  upcomingMissing,
  retry,
}: {
  games: FootballGame<string>[];
  teamId: string;
  upcomingMissing: boolean;
  retry: () => void;
}) {
  const [mode, setMode] = useState("list"),
    [month, setMonth] = useState("all"),
    months = [
      ...new Set(games.map((g) => footballDay(g.start).slice(0, 7))),
    ].sort();
  useEffect(() => {
    if (month !== "all" && !months.includes(month))
      setMonth(mode === "calendar" ? months[0] || "all" : "all");
  }, [month, mode, months.join(",")]);
  const rows = games
    .filter((g) => month === "all" || footballDay(g.start).startsWith(month))
    .sort((a, b) => Date.parse(b.start) - Date.parse(a.start));
  const scheduled = rows
      .filter((g) => g.state === "scheduled" || g.state === "live")
      .sort((a, b) => Date.parse(a.start) - Date.parse(b.start)),
    past = rows.filter((g) => !scheduled.includes(g));
  const year = Number(month.slice(0, 4)),
    m = Number(month.slice(5, 7)),
    days = month === "all" ? 0 : new Date(Date.UTC(year, m, 0)).getUTCDate();
  return (
    <section className="panel football-dashboard-panel">
      <div className="team-calendar-heading">
        <h2 className="team-section-title">近期賽事</h2>
        <div className="football-match-controls">
          <select
            aria-label="賽事月份"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {mode === "list" && <option value="all">全部月份</option>}
            {months.map((m) => (
              <option key={m} value={m}>
                {m.replace("-", " 年 ")} 月
              </option>
            ))}
          </select>
          {[
            ["list", "列表"],
            ["calendar", "月曆"],
          ].map(([key, label]) => (
            <button
              key={key}
              className="football-dashboard-button"
              type="button"
              aria-pressed={mode === key}
              disabled={key === "calendar" && !months.length}
              onClick={() => {
                setMode(key);
                if (key === "calendar" && month === "all") {
                  const now = footballDay().slice(0, 7);
                  setMonth(
                    months.includes(now)
                      ? now
                      : months.filter((m) => m <= now).at(-1) || months[0],
                  );
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {mode === "calendar" ? (
        <div className="team-calendar-scroll">
          <div className="team-calendar">
            {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
              <div className="calendar-weekday" key={day}>
                {day}
              </div>
            ))}
            {Array.from(
              { length: new Date(Date.UTC(year, m - 1, 1)).getUTCDay() },
              (_, i) => (
                <div className="calendar-empty" key={`blank-${i}`} />
              ),
            )}
            {Array.from({ length: days }, (_, i) => {
              const date = `${month}-${String(i + 1).padStart(2, "0")}`;
              return (
                <div
                  className={`calendar-day ${date === footballDay() ? "calendar-today" : ""}`}
                  key={date}
                >
                  <b>{i + 1}</b>
                  {rows
                    .filter((g) => footballDay(g.start) === date)
                    .map((g) => (
                      <FootballMatch
                        key={g.id}
                        game={g}
                        teamId={teamId}
                        compact
                      />
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {scheduled.length > 0 && (
            <div className="football-match-group">
              <h3>進行中與接下來的賽程</h3>
              {scheduled.map((g) => (
                <FootballMatch key={g.id} game={g} teamId={teamId} />
              ))}
            </div>
          )}
          <div className="football-match-group">
            <h3>近期賽果</h3>
            {past.map((g) => (
              <FootballMatch key={g.id} game={g} teamId={teamId} />
            ))}
            {!past.length && (
              <p className="football-profile-empty">此範圍尚無賽果。</p>
            )}
          </div>
        </>
      )}
      {upcomingMissing && (
        <button
          className="football-dashboard-button"
          type="button"
          onClick={retry}
        >
          重新載入後續賽程
        </button>
      )}
      <p className="team-footnote">
        日期與開賽時間為台灣時間；比分順序為本隊：對手。
      </p>
    </section>
  );
}
function FootballMatch({
  game: g,
  teamId,
  compact = false,
}: {
  game: FootballGame<string>;
  teamId: string;
  compact?: boolean;
}) {
  const home = g.home.id === teamId,
    opponent = home ? g.away : g.home,
    own = home ? g.homeScore : g.awayScore,
    against = home ? g.awayScore : g.homeScore;
  const scored = own !== null && against !== null,
    result =
      g.state === "final" && g.statusName === "STATUS_FULL_TIME" && scored
        ? own! > against!
          ? "勝"
          : own! < against!
            ? "負"
            : "和"
        : "";
  return (
    <article
      className={`football-fixture-row ${compact ? "football-fixture-compact" : ""}`}
    >
      <div className="football-fixture-date">
        <time dateTime={g.start}>
          {dateTime(g.start, g.state === "scheduled" && g.timeConfirmed)}
        </time>
        <small>{footballCompetitionName(g.league)}</small>
      </div>
      <span className="football-fixture-venue">
        {venueNames[footballVenue(g, teamId)]}
      </span>
      <a
        href={g.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="football-fixture-opponent"
      >
        <TeamLogo id={opponent.id} />
        <strong>{opponent.name}</strong>
      </a>
      <div className="football-fixture-result">
        <b>
          {scored
            ? `${own} : ${against}`
            : g.state === "scheduled"
              ? "VS"
              : "—"}
        </b>
        {result ? (
          <span className="football-profile-result" data-result={result}>
            {result}
          </span>
        ) : (
          <small>
            {g.state === "scheduled"
              ? g.timeConfirmed
                ? "未開賽"
                : "時間待定"
              : g.statusLabel}
          </small>
        )}
      </div>
    </article>
  );
}
