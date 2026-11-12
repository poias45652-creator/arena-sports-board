const brand = 'https://xingzhun-sports-home.poias45652.chatgpt.site';
// Immutable assets built from the original MT workspace. SRI pins the exact code
// that may run on the trial origin. Launch credentials never reach the asset host.
const assets = {
  js:{file:'mt-native-f917531096953d4a.js',integrity:'sha384-p3CXvu4ts1x0lGfRH0O6mJlTbrl5abvm4fUGG27Q3/Dok9aUGLyORzUtuOQJzXAi'},
  css:{file:'mt-native-63b84b803feb4e7a.css',integrity:'sha384-Bovic5U8efRHeslOEFcd9IX7QC1j8X8OTPusNJ1HWeq3XbjV3gDIdXHyIkjHxHRe'}
};
export function mtTrialWorkspace(embedded:boolean) {
  const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="referrer" content="no-referrer"><title>星準｜MT 共用試玩</title>
<link rel="stylesheet" href="${brand}/native/${assets.css.file}" integrity="${assets.css.integrity}" crossorigin="anonymous">
<script defer src="${brand}/native/${assets.js.file}" integrity="${assets.js.integrity}" crossorigin="anonymous"></script>
</head><body><div id="root"><p role="status">正在載入星準 MT 試玩…</p></div><noscript>請啟用 JavaScript 開啟星準 MT 試玩。</noscript></body></html>`;
  return new Response(html,{headers:{
    'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff',
    ...(!embedded?{'X-Frame-Options':'DENY'}:{}),
    'Content-Security-Policy':`default-src 'none'; script-src '${assets.js.integrity}'; style-src 'unsafe-inline' ${brand}/native/; img-src data:; connect-src 'self' ${brand}/api/mt-trial/public-roads; frame-src 'self' https://xingzhun-mt-trial-screen.onrender.com; base-uri 'none'; form-action 'none'; frame-ancestors ${embedded?brand+' https://chatgpt.com':"'none'"}`
  }});
}
