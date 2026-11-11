const connect=document.getElementById('trial-connect'),reconnect=document.getElementById('trial-reconnect'),status=document.getElementById('trial-status'),player=document.getElementById('trial-player'),frame=document.getElementById('trial-frame'),open=document.getElementById('trial-open');
let busy=false;
async function launch(){
 if(busy)return;busy=true;connect.disabled=true;reconnect.disabled=true;status.textContent='正在取得 MT 測試遊戲授權…';
 try{
  const response=await fetch('/mt-trial/launch',{method:'POST',credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(40000)});
  const data=await response.json();
  if(!response.ok)throw Error(data.message||'目前無法連線，請稍後再試。');
  const url=new URL(data.gameUrl);
  if(url.protocol!=='https:'||!['gsa.ofalive99.net','gs1.ofalive99.net'].includes(url.hostname)||url.username||url.password||url.port)throw Error('遊戲入口無效，請稍後重試。');
  frame.src=url.href;open.href=url.href;open.hidden=false;player.hidden=false;status.textContent='已取得遊戲授權。若畫面顯示登入到期，請按「重新連接」。';
  player.scrollIntoView({block:'start'});
 }catch(error){status.textContent=error.name==='TimeoutError'?'連線逾時，請稍後重新連接。':error.message;}
 finally{busy=false;connect.disabled=false;reconnect.disabled=false;}
}
connect.addEventListener('click',launch);reconnect.addEventListener('click',launch);
