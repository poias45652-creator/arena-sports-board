export const pickerHtml = `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="theme-color" content="#09101a">
  <title>星準｜選擇平台</title>
  <link rel="icon" href="/brand/xingzhun-icon-192-v1.png">
  <link rel="stylesheet" href="/member-platforms/background.css">
  <link rel="stylesheet" href="/member-platforms/platform-picker.css">
  <script defer src="/member-platforms/picker.js?v=20261110"></script>
</head>
<body>
  <main id="member-portal">
    <picture class="login-background" aria-hidden="true">
      <source media="(min-width:1024px) and (hover:hover) and (pointer:fine) and (prefers-reduced-motion:reduce)" srcset="/brand/xingzhun-desktop-background-v1.webp">
      <source media="(min-width:1024px) and (hover:hover) and (pointer:fine)" srcset="/brand/xingzhun-desktop-background-v1.gif">
      <source media="(prefers-reduced-motion:reduce)" srcset="/brand/xingzhun-background-still-v1.webp">
      <img src="/brand/xingzhun-background-v1.gif" width="540" height="960" alt="" decoding="async" fetchpriority="high">
    </picture>
    <section id="xz-gate" class="xz-welcome-stage" aria-label="選擇平台">
      <div class="xz-welcome-card v104-mobile-card">
        <div class="xz-welcome-sky" aria-hidden="true">
          <canvas id="star-chart" width="1120" height="1288"></canvas>
          <i class="xz-sky-sweep"></i>
        </div>
        <div class="v103-status"><i aria-hidden="true"></i><span id="connection-status">裝置已連網</span></div>
        <div class="xz-welcome-brand">
          <div class="xz-welcome-dial" aria-hidden="true">
            <i class="xz-dial-ticks"></i><i class="xz-dial-scan"></i><i class="xz-dial-orbit"></i>
            <img src="/member-platforms/picker-mark.png" alt="" width="256" height="256">
          </div>
          <h1>星準</h1>
          <p>體育/百家樂輔助系統</p>
        </div>
        <form class="v103-welcome-body" method="post" action="/platforms/launch" id="launch">
          <div class="metrix-platform-picker"><select name="platform" id="xz-platform" aria-label="選擇平台">PLATFORM_OPTIONS</select></div>
          <button type="submit" class="v103-submit" SUBMIT_STATE>進入系統 <b aria-hidden="true">→</b></button>
          ACCESS_STATUS
        </form>
        <form method="post" action="/platforms/logout"><button class="gate-logout" type="submit">登出</button></form>
        <p class="xz-welcome-caption">即時牌路・逐局驗證</p>
      </div>
    </section>
  </main>
</body></html>`;
