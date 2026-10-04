'use client';
import {useEffect,useState} from 'react';
import {trialDay,trialPick,trialScorePredictions,type TrialData} from '@/lib/free-trial';
const sports={baseball:'棒球',basketball:'籃球',football:'足球'};
const backgrounds={baseball:'/backgrounds/yankee-stadium.jpg',basketball:'/backgrounds/basketball-dunk-v1.webp',football:'/backgrounds/football-stadium-v1.webp'};
const results={hit:'推薦命中',miss:'推薦未命中',draw:'和局',no_pick:'本場無賽前推薦',ungraded:'賽果待核對'};
export default function Trial(){
 const [data,setData]=useState<TrialData|null>(null),[loading,setLoading]=useState(true),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  const controller=new AbortController();let active=true,busy=false;
  async function load(){
   if(busy)return;busy=true;setLoading(true);
   try{
    const response=await fetch('/api/free-trial',{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error();const value:TrialData=await response.json();
    if(value.status==='unavailable')throw Error();
    if(active)setData(value);
   }catch{
    if(active)setData(old=>old?.day===trialDay()&&old.game?{...old,progress:old.progress?{...old.progress,stale:true}:undefined}:{day:trialDay(),status:'unavailable',updatedAt:''});
   }finally{busy=false;if(active)setLoading(false);}
  }
  load();const timer=setInterval(load,60000);
  return()=>{active=false;controller.abort();clearInterval(timer);};
 },[attempt]);
 const current=data?.day===trialDay()?data:null,g=current?.game,p=current?.probabilities,s=current?.progress;
 if(!current)return <section className="trial-empty" role="status">正在選取當日賽事…</section>;
 if(!g)return <section className="trial-empty"><p>{current.day} · 台灣時間</p><h2>{current.status==='empty'?'今日暫無未開賽賽事':'賽程暫時無法取得'}</h2>{current.status==='unavailable'&&<button onClick={()=>setAttempt(n=>n+1)} disabled={loading}>{loading?'更新中…':'重新載入'}</button>}</section>;
 const side=trialPick(p),pick=side==='draw'?'和局':side?g[side]:null;
 const predictions=g.sport==='football'?trialScorePredictions(current):[];
 const started=s?.state!=='scheduled'&&!!s||Date.now()>=Date.parse(g.start);
 const hasScore=s?.home!==null&&s?.home!==undefined&&s?.away!==null&&s?.away!==undefined;
 return <article className="trial-match">
  <div className="trial-match-cover" style={{backgroundImage:`linear-gradient(180deg,#08131f85,#0c192af5),url('${backgrounds[g.sport]}')`}}>
   <div className="trial-match-meta"><span>{sports[g.sport]} · {g.leagueName}</span><span>免費精選</span></div>
   <p className="trial-time">{new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(g.start))}（台灣）</p>
   <div className="trial-state" aria-live="polite">{s?.state==='live'&&!s.stale&&<b className="trial-live">LIVE</b>}<span>{s?.label||'未開賽'}</span>{s?.stale&&<small>資料更新暫時中斷</small>}</div>
   <div className="trial-teams">{(['away','home'] as const).map((side,i)=><div className="trial-team" key={side}>
    {g[`${side}Logo`]&&<img src={g[`${side}Logo`]} alt="" width="64" height="64" onError={e=>{e.currentTarget.style.visibility='hidden';}}/>}
    <small>{i===0?'客隊':'主隊'}</small><h2>{g[side]}</h2>
    {started&&hasScore?<strong className="trial-actual-score">{s![side]}</strong>:!started&&p?<strong>{Math.round(p[side]*100)}<small>%</small></strong>:null}
   </div>)}</div>
   {hasScore&&started&&<p className="trial-score-caption">{s?.state==='final'?'最終比分':'目前比分'}</p>}
  </div>
  <div className="trial-match-body">
   {current.result&&<div className={`trial-result trial-result-${current.result}`} role="status">{results[current.result]}</div>}
   {p?<>
    <div className="trial-win-label"><span>賽前模型勝率{started?` · 客 ${Math.round(p.away*100)}% ／ 主 ${Math.round(p.home*100)}%`:''}</span>{p.draw!==undefined&&<span>和局 {Math.round(p.draw*100)}%</span>}</div>
    <div className="trial-probability" role="img" aria-label={`${g.away} ${Math.round(p.away*100)}%，${g.home} ${Math.round(p.home*100)}%${p.draw!==undefined?`，和局 ${Math.round(p.draw*100)}%`:''}`}><i style={{width:`${p.away*100}%`}}/>{p.draw!==undefined&&<i className="trial-draw" style={{width:`${p.draw*100}%`}}/>}<i style={{width:`${p.home*100}%`}}/></div>
    <div className="trial-pick"><span>賽前推薦</span><strong>{pick?pick+(pick==='和局'?'':' 勝'):'雙方接近'}</strong></div>
   </>:!current.result&&<p className="trial-pending">{started?'本場無賽前推薦':'本場分析更新中'}</p>}
   {g.sport!=='football'&&current.expected&&<div className="trial-score"><span>賽前預估比分（客／主）</span><strong>{Math.round(current.expected.away)} : {Math.round(current.expected.home)}</strong></div>}
   {!!predictions.length&&<section className="trial-score-predictions" aria-label="三組賽前預測比分"><h3>賽前預測比分（客／主）</h3><ol>{predictions.map((score,i)=><li key={`${score.away}:${score.home}`}><span>預測 {i+1}</span><strong>{score.away} : {score.home}</strong></li>)}</ol></section>}
  </div>
 </article>;
}
