import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const { Pool } = pg;
const scrypt = promisify(crypto.scrypt);
const PORT = Number(process.env.PORT || 10000);
const DATABASE_URL = process.env.DATABASE_URL || "";
const BINDING_KEY_RAW = process.env.TZ_BINDING_KEY || "";
const SETUP_TOKEN = process.env.ARENA_SETUP_TOKEN || "";
const CONNECTOR_URL = String(process.env.CONNECTOR_URL || "https://arena-connector.onrender.com").replace(/\/$/, "");
const CONNECTOR_KEY = process.env.CONNECTOR_KEY || "";
const APP_ORIGIN = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || "http://localhost:10000";
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, "public");
const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } }) : null;

const mime = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
};

function json(res, status, value, extra = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra });
  res.end(JSON.stringify(value));
}
function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || "").split(";").map(x => x.trim()).filter(Boolean).map(x => {
    const i = x.indexOf("="); return i < 0 ? [x, ""] : [x.slice(0, i), decodeURIComponent(x.slice(i + 1))];
  }));
}
async function body(req) {
  let size = 0, raw = "";
  for await (const chunk of req) {
    size += chunk.length; if (size > 64 * 1024) throw new Error("payload_too_large");
    raw += chunk.toString("utf8");
  }
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new Error("invalid_json"); }
}
function normalizeUsername(v) { return String(v || "").trim().toLowerCase(); }
function validArenaUsername(v) { return /^[a-z0-9_.-]{3,32}$/.test(v); }
function sha256(v) { return crypto.createHash("sha256").update(v).digest("hex"); }
async function passwordHash(password, salt) { return (await scrypt(password, salt, 64)).toString("hex"); }
function bindingKey() {
  const key = Buffer.from(BINDING_KEY_RAW, "base64");
  if (key.length !== 32) throw new Error("binding_key_invalid");
  return key;
}
function encrypt(value) {
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv("aes-256-gcm", bindingKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}
function decrypt(value) {
  const buf = Buffer.from(value, "base64"), iv = buf.subarray(0, 12), tag = buf.subarray(12, 28), data = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", bindingKey(), iv); decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

async function migrate() {
  if (!pool) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS arena_users (
      id text PRIMARY KEY, username text UNIQUE NOT NULL, password_salt text NOT NULL,
      password_hash text NOT NULL, role text NOT NULL DEFAULT 'member', created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS arena_sessions (
      token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES arena_users(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS arena_sessions_user_idx ON arena_sessions(user_id);
    CREATE TABLE IF NOT EXISTS source_bindings (
      user_id text PRIMARY KEY REFERENCES arena_users(id) ON DELETE CASCADE,
      source_username_enc text NOT NULL, source_password_enc text NOT NULL, device_id_enc text NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await pool.query("DELETE FROM arena_sessions WHERE expires_at < now()");
}
async function userFromRequest(req) {
  if (!pool) return null;
  const token = parseCookies(req).arena_session;
  if (!token) return null;
  const { rows } = await pool.query(`SELECT u.id,u.username,u.role FROM arena_sessions s JOIN arena_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`, [sha256(token)]);
  return rows[0] || null;
}
function sessionCookie(token, maxAge = 60 * 60 * 24 * 14) {
  return `arena_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${APP_ORIGIN.startsWith("https://") ? "; Secure" : ""}`;
}
async function createSession(res, userId) {
  const token = crypto.randomBytes(32).toString("base64url");
  await pool.query("INSERT INTO arena_sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '14 days')", [sha256(token), userId]);
  res.setHeader("Set-Cookie", sessionCookie(token));
}
async function bindingStatus(userId) {
  const { rows } = await pool.query("SELECT updated_at FROM source_bindings WHERE user_id=$1", [userId]);
  return rows[0] ? { bound: true, updatedAt: rows[0].updated_at } : { bound: false, updatedAt: null };
}
async function getBinding(userId) {
  const { rows } = await pool.query("SELECT * FROM source_bindings WHERE user_id=$1", [userId]);
  if (!rows[0]) return null;
  return { username: decrypt(rows[0].source_username_enc), password: decrypt(rows[0].source_password_enc), deviceId: decrypt(rows[0].device_id_enc) };
}
async function connectorRefresh(credentials) {
  if (!CONNECTOR_KEY) return { ok: false, status: 503, error: "Render 尚未設定 CONNECTOR_KEY" };
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`${CONNECTOR_URL}/connect-user`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", Origin: APP_ORIGIN, "X-Connector-Key": CONNECTOR_KEY },
      body: JSON.stringify(credentials), signal: controller.signal,
    });
    const raw = await response.text(); let data;
    try { data = JSON.parse(raw); } catch { data = { message: raw || `HTTP ${response.status}` }; }
    return response.ok ? { ok: true, status: 200, data } : { ok: false, status: response.status, error: data?.message || "SUPER 來源連線失敗", upstream: data };
  } catch (e) {
    return { ok: false, status: 502, error: e?.name === "AbortError" ? "SUPER 來源連線逾時" : "SUPER 來源連線失敗" };
  } finally { clearTimeout(timer); }
}

async function api(req, res, url) {
  if (!pool) return json(res, 503, { ok: false, error: "DATABASE_URL 尚未設定" });
  if (url.pathname === "/api/meta" && req.method === "GET") {
    const count = Number((await pool.query("SELECT count(*)::int AS n FROM arena_users")).rows[0].n);
    return json(res, 200, { ok: true, setupRequired: count === 0, source: "SUPER" });
  }
  if (url.pathname === "/api/setup-admin" && req.method === "POST") {
    const d = await body(req), username = normalizeUsername(d.username), password = String(d.password || "");
    if (!SETUP_TOKEN || String(d.setupToken || "") !== SETUP_TOKEN) return json(res, 403, { ok: false, error: "管理員設定碼不正確" });
    if (!validArenaUsername(username) || password.length < 10) return json(res, 400, { ok: false, error: "帳號需 3-32 字元；密碼至少 10 字元" });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const count = Number((await client.query("SELECT count(*)::int AS n FROM arena_users")).rows[0].n);
      if (count) { await client.query("ROLLBACK"); return json(res, 409, { ok: false, error: "管理員已建立" }); }
      const salt = crypto.randomBytes(16).toString("hex"), hash = await passwordHash(password, salt), id = crypto.randomUUID();
      await client.query("INSERT INTO arena_users(id,username,password_salt,password_hash,role) VALUES($1,$2,$3,$4,'admin')", [id, username, salt, hash]);
      await client.query("COMMIT"); await createSession(res, id);
      return json(res, 201, { ok: true, user: { id, username, role: "admin" } });
    } finally { client.release(); }
  }
  if (url.pathname === "/api/register" && req.method === "POST") {
    const d = await body(req), username = normalizeUsername(d.username), password = String(d.password || "");
    if (!validArenaUsername(username) || password.length < 10) return json(res, 400, { ok: false, error: "帳號需 3-32 字元；密碼至少 10 字元" });
    const salt = crypto.randomBytes(16).toString("hex"), hash = await passwordHash(password, salt), id = crypto.randomUUID();
    try { await pool.query("INSERT INTO arena_users(id,username,password_salt,password_hash) VALUES($1,$2,$3,$4)", [id, username, salt, hash]); }
    catch (e) { if (e.code === "23505") return json(res, 409, { ok: false, error: "帳號已存在" }); throw e; }
    await createSession(res, id); return json(res, 201, { ok: true, user: { id, username, role: "member" } });
  }
  if (url.pathname === "/api/login" && req.method === "POST") {
    const d = await body(req), username = normalizeUsername(d.username), password = String(d.password || "");
    const { rows } = await pool.query("SELECT * FROM arena_users WHERE username=$1", [username]); const u = rows[0];
    if (!u || !crypto.timingSafeEqual(Buffer.from(await passwordHash(password, u.password_salt), "hex"), Buffer.from(u.password_hash, "hex"))) return json(res, 401, { ok: false, error: "帳號或密碼錯誤" });
    await createSession(res, u.id); return json(res, 200, { ok: true, user: { id: u.id, username: u.username, role: u.role } });
  }
  if (url.pathname === "/api/logout" && req.method === "POST") {
    const token = parseCookies(req).arena_session; if (token) await pool.query("DELETE FROM arena_sessions WHERE token_hash=$1", [sha256(token)]);
    return json(res, 200, { ok: true }, { "Set-Cookie": sessionCookie("", 0) });
  }

  const user = await userFromRequest(req);
  if (!user) return json(res, 401, { ok: false, error: "請先登入 Arena" });
  if (url.pathname === "/api/me" && req.method === "GET") return json(res, 200, { ok: true, user, binding: await bindingStatus(user.id) });
  if (url.pathname === "/api/source/bind" && req.method === "POST") {
    const d = await body(req), sourceUsername = String(d.username || "").trim(), sourcePassword = String(d.password || ""), deviceId = String(d.deviceId || "").trim();
    if (!sourceUsername || !sourcePassword || !deviceId) return json(res, 400, { ok: false, error: "SUPER 帳號、密碼與 Device ID 都要填" });
    try {
      await pool.query(`INSERT INTO source_bindings(user_id,source_username_enc,source_password_enc,device_id_enc,updated_at) VALUES($1,$2,$3,$4,now()) ON CONFLICT(user_id) DO UPDATE SET source_username_enc=excluded.source_username_enc,source_password_enc=excluded.source_password_enc,device_id_enc=excluded.device_id_enc,updated_at=now()`, [user.id, encrypt(sourceUsername), encrypt(sourcePassword), encrypt(deviceId)]);
      return json(res, 200, { ok: true, binding: await bindingStatus(user.id) });
    } catch (e) { if (e.message === "binding_key_invalid") return json(res, 503, { ok: false, error: "TZ_BINDING_KEY 設定錯誤" }); throw e; }
  }
  if (url.pathname === "/api/source/unbind" && req.method === "POST") {
    await pool.query("DELETE FROM source_bindings WHERE user_id=$1", [user.id]); return json(res, 200, { ok: true });
  }
  if (url.pathname === "/api/refresh" && req.method === "POST") {
    let credentials; try { credentials = await getBinding(user.id); } catch { return json(res, 503, { ok: false, error: "來源授權無法解密，請重新綁定" }); }
    if (!credentials) return json(res, 409, { ok: false, error: "請先綁定自己的 SUPER 帳號" });
    const result = await connectorRefresh(credentials); return json(res, result.status, result);
  }
  return json(res, 404, { ok: false, error: "找不到 API" });
}

async function serve(req, res, url) {
  const safe = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const full = path.normalize(path.join(PUBLIC_DIR, safe));
  if (!full.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end("Forbidden"); }
  try { const data = await readFile(full); res.writeHead(200, { "Content-Type": mime[path.extname(full)] || "application/octet-stream", "Cache-Control": path.extname(full) === ".html" ? "no-store" : "public,max-age=300" }); res.end(data); }
  catch { const data = await readFile(path.join(PUBLIC_DIR, "index.html")); res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }); res.end(data); }
}

await migrate();
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/health") {
      let database = false; try { if (pool) { await pool.query("SELECT 1"); database = true; } } catch {}
      return json(res, database ? 200 : 503, { ok: database, service: "arena-sports-board", database, connectorConfigured: Boolean(CONNECTOR_KEY), bindingKeyConfigured: (() => { try { return bindingKey().length === 32; } catch { return false; } })() });
    }
    if (url.pathname.startsWith("/api/")) return await api(req, res, url);
    if (req.method === "GET") return await serve(req, res, url);
    res.writeHead(405); res.end("Method Not Allowed");
  } catch (e) { console.error(e); json(res, e.message === "payload_too_large" ? 413 : 500, { ok: false, error: "伺服器處理失敗" }); }
});
server.listen(PORT, "0.0.0.0", () => console.log(`Arena Sports Board v2 listening on ${PORT}`));
