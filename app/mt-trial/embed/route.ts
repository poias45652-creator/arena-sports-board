const homepage = 'https://xingzhun-sports-home.poias45652.chatgpt.site';

export function GET() {
  const html = `<!doctype html>
<html lang="zh-Hant"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>MT 測試牌桌</title>
<link rel="stylesheet" href="/ui/mt-trial.css">
<script src="/ui/mt-trial-embed.js" defer></script>
</head><body><main data-homepage="${homepage}">
<p id="trial-status" role="status" aria-live="polite">正在連接星準試玩區…</p>
<noscript>請啟用 JavaScript 以顯示 MT 牌桌。</noscript>
</main></body></html>`;

  return new Response(html, {headers: {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': `default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors ${homepage} https://chatgpt.com`,
  }});
}
