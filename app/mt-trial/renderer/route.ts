export const dynamic='force-dynamic';

// The rendering service opens this same first-party document and then sets the
// child frame to its server-held provider grant. This route holds no grant.
export function GET() {
  return new Response(`<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>星準｜MT 牌桌</title><meta name="viewport" content="width=device-width, initial-scale=1"><style>*{box-sizing:border-box}html,body,iframe{margin:0;width:100%;height:100%;background:#0b1524;border:0;display:block}</style><iframe title="MT 原廠牌桌" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-forms allow-same-origin allow-presentation allow-pointer-lock" allow="autoplay; fullscreen"></iframe></html>`,{headers:{
    'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'strict-origin-when-cross-origin',
    'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-src https://gs1.ofalive99.net https://gsa.ofalive99.net; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'
  }});
}
