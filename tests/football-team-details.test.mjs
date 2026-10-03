import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { moduleUrl } from "./profile-loader.mjs";

const d = await import(moduleUrl("lib/football-team-details.ts"));
const { parseFootballTeamHistory } = await import(moduleUrl("lib/football.ts"));
const fixture = JSON.parse(
  readFileSync("tests/fixtures/football-team-profile.json"),
);
const payload = (path) =>
  fixture.sources.find((s) => s.paths.includes(path))?.data;
const raw = payload("all/teams/359/schedule?season=2026&limit=100");
const history = parseFootballTeamHistory(raw, "359", "eng.1", true);
const seed = history.find((g) => g.statusName === "STATUS_FULL_TIME");
const team = { id: "359", name: "阿森納", englishName: "Arsenal" },
  opponent = { id: "360", name: "對手", englishName: "Opponent" };
const game = (id, date, score = [1, 0], extra = {}) => ({
  ...seed,
  id: String(id),
  league: "eng.1",
  season: 2026,
  start: date,
  home: team,
  away: opponent,
  homeScore: score[0],
  awayScore: score[1],
  neutral: false,
  state: "final",
  statusName: "STATUS_FULL_TIME",
  ...extra,
});

test("season selection excludes other seasons, families, duplicate and conflicting scores", () => {
  const a = game(1, "2026-01-01T12:00:00Z");
  const rows = d.footballSeasonGames(
    [
      a,
      a,
      { ...a, id: "2", season: 2025 },
      { ...a, id: "3", league: "club.friendly" },
      { ...a, id: "4", league: "fifa.friendly" },
      { ...a, id: "5", home: opponent, away: opponent },
    ],
    "eng.1",
    "359",
    2026,
  );
  assert.deepEqual(
    rows.map((g) => g.id),
    ["1"],
  );
  assert.equal(
    d.footballSeasonGames([a, { ...a, homeScore: 4 }], "eng.1", "359", 2026)
      .length,
    0,
  );
  assert.equal(
    d.footballProfileDefaultSeason("eng.1", Date.parse("2026-02-01")),
    2025,
  );
  assert.equal(
    d.footballProfileDefaultSeason("uefa.nations", Date.parse("2026-02-01")),
    2026,
  );
});
test("venue and competition filters apply before recent-game limit; zero means the whole season", () => {
  const rows = Array.from({ length: 24 }, (_, i) =>
    game(
      i + 10,
      `2026-01-${String(i + 1).padStart(2, "0")}T12:00:00Z`,
      [2, 0],
      { neutral: i % 2 === 0 },
    ),
  );
  rows.push(
    game(50, "2026-02-01T12:00:00Z", [1, 0], { league: "uefa.champions" }),
  );
  const selected = d.filterFootballSeasonGames(rows, "359", "eng.1", "home", 5);
  assert.equal(selected.length, 5);
  assert.equal(selected[0].start, "2026-01-24T12:00:00Z");
  assert.ok(selected.every((g) => !g.neutral));
  assert.equal(
    d.filterFootballSeasonGames(rows, "359", "eng.1", "neutral", 0).length,
    12,
  );
  assert.equal(
    d.filterFootballSeasonGames(rows, "359", "all", "all", 0).length,
    25,
  );
});
test("draws, away perspective, win/loss margins, incomplete and extra-time results are handled correctly", () => {
  const games = [
    game(1, "2026-01-04T12:00:00Z", [3, 0]),
    game(2, "2026-01-03T12:00:00Z", [2, 1], { home: opponent, away: team }),
    game(3, "2026-01-02T12:00:00Z", [0, 0], { neutral: true }),
    game(4, "2026-01-01T12:00:00Z", [2, 0]),
  ];
  const invalid = [
    game(5, "2026-01-01T12:00:00Z", [4, 0], { statusName: "STATUS_FINAL_AET" }),
    game(6, "2026-01-01T12:00:00Z", [null, null]),
    game(7, "2099-01-01T12:00:00Z"),
  ];
  const s = d.footballSeasonSummary([...games, ...invalid], "359");
  assert.deepEqual(
    [s.games, s.wins, s.draws, s.losses, s.scored, s.conceded],
    [4, 2, 1, 1, 6, 2],
  );
  assert.equal(s.winRate, 0.5);
  assert.equal(s.winMargin, 2.5);
  assert.equal(s.lossMargin, 1);
  assert.equal(s.pointsPerGame, 1.75);
  assert.equal(s.streak, "1 連勝");
  assert.equal(d.footballSeasonSummary([], "359").winRate, null);
  assert.equal(d.footballOpponentSummary(games, "359")[0].games, 4);
});
test("monthly trends use Taiwan dates, distinguish calendar years and leave gaps empty", () => {
  const rows = d.footballMonthlySummary(
    [
      game(1, "2024-12-31T18:00:00Z"),
      game(2, "2025-03-01T12:00:00Z", [0, 0]),
      game(3, "2025-12-31T18:00:00Z", [0, 1]),
    ],
    "359",
  );
  assert.equal(rows[0].month, "2025-01");
  assert.equal(rows.at(-1).month, "2026-01");
  assert.equal(rows.length, 13);
  assert.equal(rows[1].games, 0);
  assert.equal(rows[1].winRate, null);
  assert.equal(rows[2].draws, 1);
});
test("rosters preserve zero and missing stats, reject wrong team/season and duplicate players", () => {
  const r = {
    team: { id: "359", isNational: false },
    season: { year: 2026 },
    athletes: [
      {
        id: "100",
        displayName: "Player",
        position: { abbreviation: "G" },
        statistics: {
          splits: {
            categories: [
              {
                stats: [
                  { name: "totalGoals", value: 0 },
                  { name: "appearances", value: 3 },
                ],
              },
            ],
          },
        },
      },
    ],
  };
  const p = d.parseFootballRoster(r, "eng.1", "359", 2026, team)[0];
  assert.equal(p.goals, 0);
  assert.equal(p.assists, null);
  assert.equal(p.appearances, 3);
  assert.throws(() => d.parseFootballRoster(r, "eng.1", "360", 2026, team));
  assert.throws(() => d.parseFootballRoster(r, "eng.1", "359", 2025, team));
  assert.throws(() =>
    d.parseFootballRoster(
      { ...r, athletes: [...r.athletes, ...r.athletes] },
      "eng.1",
      "359",
      2026,
      team,
    ),
  );
});
test("comparison uses weighted league averages and rejects mismatched season, source or incomplete tables", () => {
  const entry = (id, v) => ({
    team: { id },
    stats: [
      "gamesPlayed",
      "wins",
      "ties",
      "losses",
      "pointsFor",
      "pointsAgainst",
    ].map((name, i) => ({ name, value: v[i] })),
  });
  const table = {
    season: 2026,
    links: [{ href: "https://www.espn.com/soccer/table/_/league/eng.1" }],
    entries: [
      entry("359", [2, 1, 1, 0, 3, 1]),
      entry("360", [1, 0, 0, 1, 0, 2]),
      entry("361", [1, 0, 1, 0, 1, 1]),
    ],
  };
  const b = d.parseFootballBenchmark(
    { season: { year: 2026 }, children: [{ standings: table }] },
    "eng.1",
    2026,
  );
  assert.equal(b.games, 2);
  assert.equal(b.winRate, 0.25);
  assert.equal(b.scoredPerGame, 1);
  assert.equal(b.pointsPerGame, 1.25);
  assert.throws(() =>
    d.parseFootballBenchmark(
      { season: { year: 2025 }, standings: table },
      "eng.1",
      2026,
    ),
  );
  assert.throws(() =>
    d.parseFootballBenchmark(
      { season: { year: 2026 }, standings: table },
      "esp.1",
      2026,
    ),
  );
  assert.throws(() =>
    d.parseFootballBenchmark(
      {
        season: { year: 2026 },
        standings: { ...table, entries: table.entries.slice(0, 2) },
      },
      "eng.1",
      2026,
    ),
  );
});
test("season API rejects invalid parameters, retains actual season results when fixtures fail and fails closed on wrong identity", async () => {
  const { GET } = await import(moduleUrl("app/api/football-team/route.ts"));
  const originalFetch = globalThis.fetch,
    originalNow = Date.now;
  let now = Date.parse(fixture.capturedAt),
    wrong = false,
    calls = 0;
  Date.now = () => now;
  globalThis.fetch = async (url) => {
    calls++;
    if (String(url).includes("fixture=true"))
      throw Error("fixtures unavailable");
    return Response.json(
      wrong
        ? { ...raw, team: { id: "360", isNational: false } }
        : { ...raw, team: { ...raw.team, isNational: false } },
    );
  };
  const get = (q) =>
    GET(
      new Request(
        "http://localhost/api/football-team?league=eng.1&team=359&" + q,
      ),
    );
  try {
    for (const q of [
      "season=2000",
      "season=2099",
      "season=2026.0",
      "season=&action=profile",
      "action=roster",
      "season=2026&action=bad",
    ])
      assert.equal((await get(q)).status, 400);
    assert.equal(calls, 0);
    const response = await get("season=2026"),
      data = await response.json();
    assert.equal(response.status, 200);
    assert.equal(data.team.id, "359");
    assert.equal(data.upcoming, null);
    assert.ok(data.results.length);
    assert.ok(data.games.every((g) => g.season === 2026));
    assert.match(response.headers.get("cache-control"), /private.*no-store/);
    wrong = true;
    now += 20 * 60000;
    assert.equal((await get("season=2026")).status, 503);
  } finally {
    globalThis.fetch = originalFetch;
    Date.now = originalNow;
  }
});
