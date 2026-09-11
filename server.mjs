import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT || 10000);
const CONNECTOR_URL = String(process.env.CONNECTOR_URL || "https://arena-connector.onrender.com").replace(/\/$/, "");
const CONNECTOR_KEY = process.env.CONNECTOR_KEY || "";
const CONNECTOR_ORIGIN = process.env.CONNECTOR_ORIGIN || "https://arena-sports-board.poias45652.chatgpt.site";
const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, "public");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

async function proxyConnector() {
  if (!CONNECTOR_KEY) {
    return {
      ok: false,
      status: 503,
      error: "CONNECTOR_KEY 尚未設定",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 35000);
  try {
    const response = await fetch(`${CONNECTOR_URL}/connect`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Origin: CONNECTOR_ORIGIN,
        "X-Connector-Key": CONNECTOR_KEY,
      },
      signal: controller.signal,
    });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text || `HTTP ${response.status}` };
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: data?.message || `SUPER 連線失敗 (${response.status})`,
        upstream: data,
      };
    }
    return { ok: true, status: 200, data };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: error?.name === "AbortError" ? "SUPER 連線逾時" : "SUPER 連線失敗",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function serveStatic(req, res) {
  const requestPath = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const fullPath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  try {
    const body = await readFile(fullPath);
    res.writeHead(200, {
      "Content-Type": mime[path.extname(fullPath)] || "application/octet-stream",
      "Cache-Control": path.extname(fullPath) === ".html" ? "no-store" : "public, max-age=300",
    });
    res.end(body);
  } catch {
    try {
      const body = await readFile(path.join(PUBLIC_DIR, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  if (req.method === "GET" && url.pathname === "/health") {
    return sendJson(res, 200, {
      ok: true,
      service: "arena-sports-board",
      connectorConfigured: Boolean(CONNECTOR_KEY),
      connectorUrl: CONNECTOR_URL,
    });
  }

  if (req.method === "GET" && url.pathname === "/api/source-status") {
    return sendJson(res, 200, {
      ok: true,
      source: "SUPER",
      connectorConfigured: Boolean(CONNECTOR_KEY),
      connectorUrl: CONNECTOR_URL,
    });
  }

  if (req.method === "POST" && url.pathname === "/api/refresh") {
    const result = await proxyConnector();
    return sendJson(res, result.status, result);
  }

  if (req.method === "GET") return serveStatic(req, res);

  res.writeHead(405, { Allow: "GET, POST" });
  res.end("Method Not Allowed");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Arena Sports Board listening on ${PORT}`);
});
