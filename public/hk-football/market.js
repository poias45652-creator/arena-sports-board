const msg={loading:'正在讀取賽前預測…',noQuote:'這場暫無賽前預測。',unavailable:'賽前預測暫時無法更新。',unconfirmed:'開球時間待定。',closed:'賽前預測已截止。'};
let data={},busy=false,lastRead=0;
const pct=p=>(p*100).toFixed(1)+'%';
function quoteFor(id,kickoff,home,away){
  if(!kickoff)return {status:'unconfirmed'};
  if(Date.now()>=kickoff)return {status:'closed'};
  const q=data[id];
  if(!q || q.status!=='priced')return q || {status: lastRead?'noQuote':'loading'};
  if(q.kickoff!==kickoff || q.home!==home || q.away!==away)return {status:'noQuote'};
  const age=Date.now()-Date.parse(q.checkedAt);
  return Number.isFinite(age) && age>=-300000 && age<12*3600000 ? q : {status:'unavailable'};
}
function predictionMarkup(q){
  const a=q.prediction;
  if(q.status!=='priced' || !a){
    const message=q.status==='priced'?'等待主客和或大小球報價。':msg[q.status]||msg.unavailable;
    return '<p class="football-analysis-pending">'+message+'</p>';
  }
  const result=a.result, total=a.total, estimate=a.estimate;
  const three=['主勝','和局','客勝'];
  let html='';
  if(result){
    html+='<div class="football-probabilities">'+three.map((label,i)=>'<div><span>'+label+'</span><strong>'+pct(result[i])+'</strong></div>').join('')+'</div>'+
      '<div class="football-probability-bar" aria-hidden="true">'+result.map(p=>'<span style="width:'+pct(p)+'"></span>').join('')+'</div>';
  }else html+='<p class="football-analysis-pending">等待主客和報價。</p>';
  const goals=[['大 '+(total?.line??'—')+' 球',total?.over],['小 '+(total?.line??'—')+' 球',total?.under],['雙方進球推算',estimate?.btts]];
  html+='<div class="football-goals">'+goals.map(([k,p])=>'<div><span>'+k+'</span><b>'+(p==null?'—':pct(p))+'</b></div>').join('')+'</div>';
  if(estimate){
    html+='<div class="football-scores"><span>盤口推算比分<small>主：客</small></span>'+estimate.scores.map((s,i)=>'<div><small class="football-score-label">'+['首選','次選','第三組'][i]+'</small><b>'+s.home+' : '+s.away+'</b><small>'+pct(s.probability)+'</small></div>').join('')+'</div>';
  }
  return html;
}
export function predictionPanel(match,kickoff){
  const q=quoteFor(match.id,kickoff,match.home,match.away);
  return '<div data-quote-part="forecast" data-market="'+match.id+'" data-kickoff="'+(kickoff||0)+'" data-home="'+match.home+'" data-away="'+match.away+'">'+predictionMarkup(q)+'</div>';
}
let expiryTimer;
function paint(){
  clearTimeout(expiryTimer);
  const now=Date.now();
  let nextCheck=Infinity;
  for(const p of document.querySelectorAll('[data-quote-part]')){
    const {market,home,away}=p.dataset, kickoff=Number(p.dataset.kickoff);
    const q=quoteFor(market,kickoff,home,away);
    const html=predictionMarkup(q);
    if(p.innerHTML!==html)p.innerHTML=html;
    if(kickoff>now)nextCheck=Math.min(nextCheck,kickoff);
    if(q.status==='priced')nextCheck=Math.min(nextCheck,Date.parse(q.checkedAt)+12*3600000);
  }
  if(nextCheck-now<2147483647)expiryTimer=setTimeout(paint,Math.max(1,nextCheck-now));
}
export async function refreshMarkets(){
  paint();
  if(busy||document.hidden||Date.now()-lastRead<60000||!document.querySelector('[data-market]'))return;
  busy=true;
  try{
    const response=await fetch('/api/hong-kong/football/odds',{cache:'no-store'});
    if(!response.ok)throw Error();
    const feed=await response.json();if(feed.bookmaker!=='bet365'||!feed.matches)throw Error();
    data=feed.matches;
  }catch{data=Object.fromEntries([...document.querySelectorAll('[data-market]')].map(p=>[p.dataset.market,{status:'unavailable'}]));}
  finally{busy=false;lastRead=Date.now();paint();}
}
if(typeof document!=='undefined'){
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshMarkets();});
  setInterval(refreshMarkets,60000);
}
