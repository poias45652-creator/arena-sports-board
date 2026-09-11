const state = { scope: "full", raw: null, user: null, binding: null };
const $ = s => document.querySelector(s);
const el = {
  authView: $("#authView"), appView: $("#appView"), memberActions: $("#memberActions"), memberName: $("#memberName"),
  loginForm: $("#loginForm"), registerForm: $("#registerForm"), setupForm: $("#setupForm"), setupCard: $("#setupCard"),
  logout: $("#logoutBtn"), bindForm: $("#bindForm"), toggleBind: $("#toggleBindBtn"), unbind: $("#unbindBtn"), bindingText: $("#bindingText"),
  refresh: $("#refreshBtn"), notice: $("#notice"), markets: $("#markets"), raw: $("#rawJson"), scopeMetric: $("#scopeMetric"),
  countMetric: $("#countMetric"), updatedMetric: $("#updatedMetric"), subline: $("#subline"), tabs: [...document.querySelectorAll(".tab")],
};

async function request(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } });
  let data = {}; try { data = await response.json(); } catch {}
  if (!response.ok || data.ok === false) { const e = new Error(data.error || `HTTP ${response.status}`); e.status = response.status; throw e; }
  return data;
}
function formData(form) { return Object.fromEntries(new FormData(form).entries()); }
function show(node, yes = true) { node?.classList.toggle("hidden", !yes); }
function setNotice(message = "", type = "") {
  if (!el.notice) return;
  show(el.notice, Boolean(message)); el.notice.className = `notice${type ? ` ${type}` : ""}${message ? "" : " hidden"}`; el.notice.textContent = message;
}
function escapeHtml(v) { return String(v).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function first(o, keys) { for (const k of keys) if (o && o[k] !== undefined && o[k] !== null && o[k] !== "") return o[k]; }
function text(v, fallback = "-") { return v === undefined || v === null || v === "" ? fallback : String(v); }

function collectRows(node, output = []) {
  if (!node) return output;
  if (Array.isArray(node)) { for (const item of node) collectRows(item, output); return output; }
  if (typeof node !== "object") return output;
  const hasGameId = ["GameID","game_id","gameId"].some(k => k in node);
  const hasMarket = ["WagerTypeID","WagerTypeKey","HomeHdpOdds","AwayHdpOdds","OULine","HomeHdp"].some(k => k in node);
  if (hasGameId && hasMarket) output.push(node);
  for (const v of Object.values(node)) if (v && typeof v === "object") collectRows(v, output);
  return output;
}
function isHalf(row) {
  const gameType = Number(first(row,["GameType","gameType"])), group = Number(first(row,["WagerGrpID","wagerGrpId"]));
  const name = String(first(row,["WagerTypeName","Name","name"]) || "").toLowerCase();
  return gameType === 2 || group === 20 || name.includes("half") || name.includes("上半");
}
function marketType(row) {
  const wager = Number(first(row,["WagerTypeID","wagerTypeId"])), key = Number(first(row,["WagerTypeKey","wagerTypeKey"]));
  if (first(row,["OULine","ouLine"]) !== undefined && first(row,["OULine","ouLine"]) !== "") return "大小";
  if ([101,102,1].includes(wager) || key === 1) return "讓分";
  if ([103,104,2].includes(wager) || key === 2) return "大小";
  return "獨贏";
}
function marketView(row) {
  const type = marketType(row), h = first(row,["HomeHdp","homeHdp"]), a = first(row,["AwayHdp","awayHdp"]), ou = first(row,["OULine","ouLine"]), pos = Number(first(row,["HdpPos","hdpPos"]));
  const homeOdds = first(row,["HomeHdpOdds","HomeOdds","homeOdds"]), awayOdds = first(row,["AwayHdpOdds","AwayOdds","awayOdds"]);
  let line = "主盤";
  if (type === "大小") line = `大小 ${text(ou)}`;
  else if (type === "讓分") line = pos === 1 ? `主讓 ${text(h || a)}` : pos === 0 ? `客讓 ${text(a || h)}` : `讓分 ${text(h || a)}`;
  return { label: `${state.scope === "half" ? "上半場" : "全場"}${type}`, line, odds: `主 @${text(homeOdds)} ／ 客 @${text(awayOdds)}`, wager: text(first(row,["WagerTypeID","wagerTypeId"])) };
}
function gameTitle(items, gameId) {
  for (const row of items) {
    const home = first(row,["HomeTeamName","HomeName","HomeTeam","homeTeamName","home_name"]), away = first(row,["AwayTeamName","AwayName","AwayTeam","awayTeamName","away_name"]);
    if (home || away) return `${text(away,"客隊")}（客） vs ${text(home,"主隊")}（主）`;
  }
  return `賽事 #${gameId}`;
}
function renderMarkets() {
  const rows = collectRows(state.raw?.data ?? state.raw, []), filtered = rows.filter(r => state.scope === "half" ? isHalf(r) : !isHalf(r));
  const grouped = new Map(); for (const r of filtered) { const id = text(first(r,["GameID","game_id","gameId"]),"unknown"); if (!grouped.has(id)) grouped.set(id,[]); grouped.get(id).push(r); }
  el.scopeMetric.textContent = state.scope === "half" ? "上半場" : "全場"; el.countMetric.textContent = String(filtered.length);
  if (!state.raw || !filtered.length) {
    el.markets.className = "markets empty-state";
    el.markets.innerHTML = `<div><strong>${state.raw ? `目前沒有${state.scope === "half" ? "上半場" : "全場"}可辨識盤口` : "等待 SUPER 資料"}</strong><p>${state.raw ? "來源資料已取得，但此區間暫無符合資料。" : "綁定後按「更新盤口」。"}</p></div>`;
    return;
  }
  el.markets.className = "markets";
  el.markets.innerHTML = [...grouped.entries()].map(([gameId,items]) => `<article class="game"><div class="game-head"><div><div class="game-title">${escapeHtml(gameTitle(items,gameId))}</div><div class="game-meta">SUPER ・ GameID ${escapeHtml(gameId)}</div></div><div class="game-meta">${items.length} 筆</div></div><div class="market-grid">${items.slice(0,12).map(row => { const v=marketView(row); return `<div class="market"><h3>${escapeHtml(v.label)}</h3><div class="market-line">${escapeHtml(v.line)}</div><div class="market-odds">${escapeHtml(v.odds)}</div><span class="tag">Wager ${escapeHtml(v.wager)}</span></div>`; }).join("")}</div></article>`).join("");
}
function renderSession() {
  const logged = Boolean(state.user); show(el.authView,!logged); show(el.appView,logged); show(el.memberActions,logged);
  if (!logged) return;
  el.memberName.textContent = `${state.user.username}${state.user.role === "admin" ? "・管理員" : ""}`;
  const bound = Boolean(state.binding?.bound); el.bindingText.textContent = bound ? `已綁定自己的 SUPER 帳號${state.binding.updatedAt ? `・${new Date(state.binding.updatedAt).toLocaleString("zh-TW",{hour12:false})}` : ""}` : "尚未綁定自己的 SUPER 帳號";
  el.refresh.disabled = !bound;
  renderMarkets();
}
async function loadMe() {
  try { const data = await request("/api/me"); state.user = data.user; state.binding = data.binding; }
  catch (e) { if (e.status === 401) { state.user = null; state.binding = null; } else throw e; }
  renderSession();
}
async function submitAuth(form, endpoint) {
  try { const data = formData(form); await request(endpoint,{method:"POST",body:JSON.stringify(data)}); form.reset(); await loadMe(); setNotice(); }
  catch (e) { alert(e.message); }
}
async function refresh() {
  el.refresh.disabled = true; setNotice("正在連線 SUPER…");
  try {
    const result = await request("/api/refresh",{method:"POST",body:"{}"}); state.raw = result.data; el.raw.textContent = JSON.stringify(result.data,null,2);
    const now = new Date(); el.updatedMetric.textContent = now.toLocaleTimeString("zh-TW",{hour12:false}); el.subline.textContent = `SUPER ・ 賽前盤 ・ ${now.toLocaleString("zh-TW",{hour12:false})}`; setNotice(); renderMarkets();
  } catch (e) { setNotice(e.message,"error"); }
  finally { el.refresh.disabled = !state.binding?.bound; }
}

el.loginForm.addEventListener("submit", e => { e.preventDefault(); submitAuth(e.currentTarget,"/api/login"); });
el.registerForm.addEventListener("submit", e => { e.preventDefault(); submitAuth(e.currentTarget,"/api/register"); });
el.setupForm.addEventListener("submit", e => { e.preventDefault(); submitAuth(e.currentTarget,"/api/setup-admin"); });
el.logout.addEventListener("click", async () => { await request("/api/logout",{method:"POST",body:"{}"}); state.user=null; state.binding=null; state.raw=null; renderSession(); });
el.toggleBind.addEventListener("click", () => show(el.bindForm, el.bindForm.classList.contains("hidden")));
el.bindForm.addEventListener("submit", async e => { e.preventDefault(); try { await request("/api/source/bind",{method:"POST",body:JSON.stringify(formData(e.currentTarget))}); e.currentTarget.reset(); show(el.bindForm,false); await loadMe(); setNotice("SUPER 綁定已加密保存。"); } catch(err) { setNotice(err.message,"error"); } });
el.unbind.addEventListener("click", async () => { try { await request("/api/source/unbind",{method:"POST",body:"{}"}); state.raw=null; show(el.bindForm,false); await loadMe(); setNotice("已解除 SUPER 綁定。"); } catch(e) { setNotice(e.message,"error"); } });
el.refresh.addEventListener("click", refresh);
for (const tab of el.tabs) tab.addEventListener("click",() => { state.scope=tab.dataset.scope; for (const t of el.tabs) t.classList.toggle("active",t===tab); renderMarkets(); });

(async function init(){
  try { const meta = await request("/api/meta"); show(el.setupCard,meta.setupRequired); await loadMe(); }
  catch(e) { alert(`Arena 尚未完成 Render 設定：${e.message}`); }
})();
