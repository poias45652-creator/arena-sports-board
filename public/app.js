const state = {
  scope: "full",
  raw: null,
};

const el = {
  refresh: document.querySelector("#refreshBtn"),
  status: document.querySelector("#statusPill"),
  notice: document.querySelector("#notice"),
  markets: document.querySelector("#markets"),
  raw: document.querySelector("#rawJson"),
  scopeMetric: document.querySelector("#scopeMetric"),
  countMetric: document.querySelector("#countMetric"),
  updatedMetric: document.querySelector("#updatedMetric"),
  subline: document.querySelector("#subline"),
  tabs: [...document.querySelectorAll(".tab")],
};

function setNotice(message = "", type = "") {
  if (!message) {
    el.notice.className = "notice hidden";
    el.notice.textContent = "";
    return;
  }
  el.notice.className = `notice${type ? ` ${type}` : ""}`;
  el.notice.textContent = message;
}

function setStatus(text, type = "") {
  el.status.textContent = text;
  el.status.className = `pill${type ? ` ${type}` : ""}`;
}

function first(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
  }
  return undefined;
}

function text(v, fallback = "-") {
  return v === undefined || v === null || v === "" ? fallback : String(v);
}

function collectRows(node, output = []) {
  if (!node) return output;
  if (Array.isArray(node)) {
    for (const item of node) collectRows(item, output);
    return output;
  }
  if (typeof node !== "object") return output;

  const hasGameId = "GameID" in node || "game_id" in node || "gameId" in node;
  const hasMarket = ["WagerTypeID", "WagerTypeKey", "HomeHdpOdds", "AwayHdpOdds", "OULine", "HomeHdp"].some(k => k in node);
  if (hasGameId && hasMarket) output.push(node);

  for (const value of Object.values(node)) {
    if (value && typeof value === "object") collectRows(value, output);
  }
  return output;
}

function groupRows(rows) {
  const map = new Map();
  for (const row of rows) {
    const id = text(first(row, ["GameID", "game_id", "gameId"]), "unknown");
    if (!map.has(id)) map.set(id, []);
    map.get(id).push(row);
  }
  return [...map.entries()].map(([gameId, items]) => ({ gameId, items }));
}

function isHalf(row) {
  const gameType = Number(first(row, ["GameType", "gameType"]));
  const group = Number(first(row, ["WagerGrpID", "wagerGrpId"]));
  const name = `${first(row, ["WagerTypeName", "Name", "name"]) || ""}`.toLowerCase();
  return gameType === 2 || group === 20 || name.includes("half") || name.includes("上半");
}

function marketType(row) {
  const wagerType = Number(first(row, ["WagerTypeID", "wagerTypeId"]));
  const key = Number(first(row, ["WagerTypeKey", "wagerTypeKey"]));
  const line = first(row, ["OULine", "ouLine"]);
  if (line !== undefined && line !== "") return "全場大小";
  if ([101, 102, 1].includes(wagerType) || key === 1) return "全場讓分";
  if ([103, 104, 2].includes(wagerType) || key === 2) return "全場大小";
  return "全場獨贏";
}

function marketView(row, scope) {
  const labelBase = marketType(row).replace("全場", scope === "half" ? "上半場" : "全場");
  const homeHdp = first(row, ["HomeHdp", "homeHdp"]);
  const awayHdp = first(row, ["AwayHdp", "awayHdp"]);
  const ou = first(row, ["OULine", "ouLine"]);
  const homeOdds = first(row, ["HomeHdpOdds", "HomeOdds", "homeOdds"]);
  const awayOdds = first(row, ["AwayHdpOdds", "AwayOdds", "awayOdds"]);
  const hdpPos = Number(first(row, ["HdpPos", "hdpPos"]));

  let line = "主盤";
  if (ou !== undefined && ou !== "") line = `大小 ${text(ou)}`;
  else if (homeHdp !== undefined || awayHdp !== undefined) {
    const h = text(homeHdp, "");
    const a = text(awayHdp, "");
    line = hdpPos === 1 ? `主讓 ${h || a || "-"}` : hdpPos === 0 ? `客讓 ${a || h || "-"}` : `讓分 ${h || a || "-"}`;
  }

  return {
    label: labelBase,
    line,
    odds: `主 @${text(homeOdds)} ／ 客 @${text(awayOdds)}`,
    wagerType: text(first(row, ["WagerTypeID", "wagerTypeId"])),
  };
}

function gameTitle(items, gameId) {
  for (const row of items) {
    const home = first(row, ["HomeTeamName", "HomeName", "HomeTeam", "homeTeamName", "home_name"]);
    const away = first(row, ["AwayTeamName", "AwayName", "AwayTeam", "awayTeamName", "away_name"]);
    if (home || away) return `${text(away, "客隊")}（客） vs ${text(home, "主隊")}（主）`;
  }
  return `賽事 #${gameId}`;
}

function render() {
  const payload = state.raw?.data ?? state.raw;
  const rows = collectRows(payload, []);
  const filtered = rows.filter(row => state.scope === "half" ? isHalf(row) : !isHalf(row));
  const groups = groupRows(filtered);

  el.scopeMetric.textContent = state.scope === "half" ? "上半場" : "全場";
  el.countMetric.textContent = String(filtered.length);

  if (!state.raw) {
    el.markets.className = "markets empty-state";
    el.markets.innerHTML = `<div><strong>等待 SUPER 資料</strong><p>按「更新盤口」取得最新來源資料。</p></div>`;
    return;
  }

  if (!filtered.length) {
    el.markets.className = "markets empty-state";
    el.markets.innerHTML = `<div><strong>目前沒有${state.scope === "half" ? "上半場" : "全場"}可辨識盤口</strong><p>來源資料已取得，但這個區間暫時沒有符合欄位的資料。</p></div>`;
    return;
  }

  el.markets.className = "markets";
  el.markets.innerHTML = groups.map(({ gameId, items }) => {
    const views = items.slice(0, 12).map(row => marketView(row, state.scope));
    return `
      <article class="game">
        <div class="game-head">
          <div>
            <div class="game-title">${escapeHtml(gameTitle(items, gameId))}</div>
            <div class="game-meta">SUPER ・ GameID ${escapeHtml(gameId)}</div>
          </div>
          <div class="game-meta">${items.length} 筆</div>
        </div>
        <div class="market-grid">
          ${views.map(view => `
            <div class="market">
              <h3>${escapeHtml(view.label)}</h3>
              <div class="market-line">${escapeHtml(view.line)}</div>
              <div class="market-odds">${escapeHtml(view.odds)}</div>
              <span class="tag">Wager ${escapeHtml(view.wagerType)}</span>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }).join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function refresh() {
  el.refresh.disabled = true;
  setNotice();
  setStatus("更新中");
  try {
    const response = await fetch("/api/refresh", { method: "POST" });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || result.upstream?.message || "更新失敗");

    state.raw = result.data;
    el.raw.textContent = JSON.stringify(result.data, null, 2);
    const now = new Date();
    el.updatedMetric.textContent = now.toLocaleTimeString("zh-TW", { hour12: false });
    el.subline.textContent = `SUPER ・ 賽前盤 ・ ${now.toLocaleString("zh-TW", { hour12: false })}`;
    setStatus("已連線", "ok");
    render();
  } catch (error) {
    setStatus("連線失敗", "error");
    setNotice(error.message || "SUPER 連線失敗", "error");
  } finally {
    el.refresh.disabled = false;
  }
}

for (const tab of el.tabs) {
  tab.addEventListener("click", () => {
    state.scope = tab.dataset.scope;
    for (const t of el.tabs) t.classList.toggle("active", t === tab);
    render();
  });
}

el.refresh.addEventListener("click", refresh);

fetch("/api/source-status")
  .then(r => r.json())
  .then(status => {
    if (!status.connectorConfigured) {
      setNotice("網站已搬到 GitHub，但 Render 還需要設定 CONNECTOR_KEY 才能向 SUPER 連線。");
    }
  })
  .catch(() => {});

render();
