(() => {
  const homepage = document.querySelector('main').dataset.homepage;
  const status = document.getElementById('trial-status');

  if (window.parent === window) {
    status.textContent = '請從星準首頁的 MT 試玩區進入。';
    return;
  }

  let connecting = false;
  async function start(event) {
    if (event.source !== window.parent || event.origin !== homepage ||
        event.data !== 'xingzhun:mt:start' || connecting) return;
    connecting = true;
    status.textContent = '正在取得 MT 試玩授權…';
    try {
      const response = await fetch('/mt-trial/launch', {
        method: 'POST', credentials: 'omit', cache: 'no-store',
        signal: AbortSignal.timeout(40000),
      });
      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        status.textContent = failure?.message || '無法連接 MT，請點「重新連線」再試。';
        return;
      }
      const {gameUrl} = await response.json();
      const url = new URL(gameUrl);
      if (url.protocol !== 'https:' || url.username || url.password || url.port ||
          !['gs1.ofalive99.net', 'gsa.ofalive99.net'].includes(url.hostname) ||
          !url.searchParams.get('token')) throw new Error('invalid game URL');
      status.textContent = '正在開啟 MT 牌桌…';
      window.location.replace(url.href);
    } catch {
      status.textContent = '無法載入 MT 牌桌，請點「重新連線」再試。';
    }
  }

  window.addEventListener('message', start);
  window.parent.postMessage('xingzhun:mt:ready', homepage);
})();
