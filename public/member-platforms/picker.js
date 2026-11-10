(() => {
  const byId = id => document.getElementById(id);
  const selector=byId('xz-platform');
  const form=byId('launch');
  function target(){form.target=selector.value==='SPORTS'?'_blank':'_self';}
  selector.addEventListener('change',target);
  target();
  function updateStatus() {
    byId('connection-status').textContent = navigator.onLine ? '裝置已連網' : '目前離線';
  }
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();

  const notice=byId('table-status');
  if (notice) {
    const retryLink=notice.querySelector('a');
    async function recheck() {
      notice.replaceChildren('正在確認百家樂權限…');
      try {
        const response=await fetch('/platforms?check=baccarat',{cache:'no-store'});
        if(response.status===401){location.replace('/login?portal=1');return;}
        if(!response.ok)throw Error();
        const {allowed}=await response.json();
        if(typeof allowed!=='boolean')throw Error();
        const selected=selector.value;
        for(const option of selector.options){
          if(option.value==='SPORTS')continue;
          option.disabled=!allowed;
          option.textContent=option.dataset.label+(allowed?'':'（未開通）');
        }
        const preferred=new URLSearchParams(location.search).get('platform');
        const available=Array.from(selector.options).filter(option=>!option.disabled);
        const choice=available.find(option=>option.value===selected)||
          available.find(option=>option.value===preferred)||available[0];
        if(choice)selector.value=choice.value;
        form.querySelector('button[type="submit"]').disabled=!choice;
        target();
        if(allowed)notice.remove();
        else notice.textContent='此帳號尚未開通百家樂。';
      } catch {
        for(const option of selector.options){
          if(option.value!=='SPORTS')option.textContent=option.dataset.label+'（無法確認）';
        }
        notice.replaceChildren('百家樂授權服務暫時未回應。',retryLink);
      }
    }
    retryLink.addEventListener('click',event=>{event.preventDefault();void recheck();});
    void recheck();
  }

  function drawStarChart() {
    const ctx = byId('star-chart').getContext('2d');
    if (!ctx) return;
    const w = 560, h = 644;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.clearRect(0, 0, w, h);

    // A repeatable star field without animation timers or network assets.
    let seed = 17;
    const sample = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 145; i++) {
      const x = sample() * w, y = sample() * h;
      ctx.fillStyle = i % 6 === 0 ? '#e1c484a6' : '#b2e6da73';
      ctx.beginPath();
      ctx.arc(x, y, 0.28 + sample() * 0.72, 0, Math.PI * 2);
      ctx.fill();
    }

    // Celestial grid lines cross at the lower edge of the chart.
    ctx.lineWidth = 0.8;
    ctx.strokeStyle = '#7ec5aa33';
    for (const radius of [115, 156, 202, 252, 308]) {
      ctx.beginPath();
      ctx.arc(530, 743, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (const degrees of [216, 233, 250, 267]) {
      const angle = degrees * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(530, 743);
      ctx.lineTo(530 + 307 * Math.cos(angle), 743 + 307 * Math.sin(angle));
      ctx.stroke();
    }

    // A seven-star dipper on the left margin.
    const dipper = [[11, 164], [29, 148], [41, 132], [68, 122], [102, 98], [116, 119], [85, 143]];
    ctx.strokeStyle = '#a8d9c16b';
    ctx.beginPath();
    ctx.moveTo(...dipper[0]);
    for (const [x, y] of dipper.slice(1)) ctx.lineTo(x, y);
    ctx.lineTo(...dipper[3]);
    ctx.stroke();
    for (const [x, y] of dipper) {
      ctx.fillStyle = '#b9e4d6';
      ctx.beginPath();
      ctx.arc(x, y, 1.65, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  drawStarChart();

})();
