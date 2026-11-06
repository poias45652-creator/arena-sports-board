'use client';
import {useEffect,useState,type CSSProperties,type ReactNode} from 'react';
import {UserRound} from 'lucide-react';
import './player-trading-card.css';

export type PlayerCardStat={label:string;value:string|number|null|undefined};
type Props={
 name:string;number?:string|number|null;position:string;league:string;team?:string;
 season?:string|number;photo?:string;photoAlternatives?:string[];portraitStyle?:CSSProperties;
 statsNote?:string;stats?:PlayerCardStat[];bio?:string[];badge?:ReactNode;href?:string;detail?:ReactNode;
};

function Portrait({name,urls,style}:{name:string;urls:string[];style?:CSSProperties}){
 const [index,setIndex]=useState(0),[failed,setFailed]=useState(false),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(!failed)return;
  const src=urls[index];
  if(src?.startsWith('/api/football-player-photo?')&&retry<2){const timer=setTimeout(()=>{setRetry(n=>n+1);setFailed(false);},2000*(retry+1));return()=>clearTimeout(timer);}
  setIndex(n=>n+1);setRetry(0);setFailed(false);
 },[failed,retry,index,urls.join('|')]);
 return urls[index]?<span className={`xz-card-photo${style?' xz-card-photo--framed':''}`}><img
  key={`${urls[index]}:${retry}`} src={urls[index]+(retry?`&retry=${retry}`:'')} alt={`${name} 球員照片`} style={{...style,...(failed?{visibility:'hidden' as const}:{})}}
  width={300} height={280} loading="lazy" decoding="async" referrerPolicy="no-referrer"
  onError={()=>setFailed(true)}/></span>:<span className="xz-card-photo xz-card-photo--missing" role="img" aria-label={`${name} 照片待補`}><UserRound aria-hidden="true"/><span>照片待補</span></span>;
}

/** One roster presentation for every team; numbers are source stats, never invented ratings. */
export default function PlayerTradingCard(p:Props){
 const urls=[...new Set([p.photo,...p.photoAlternatives||[]].filter((u):u is string=>!!u))];
 const content=<>
  <div className="xz-card-top"><div className="xz-card-number"><small>背號</small><strong>{p.number===null||p.number===undefined||p.number===''?'—':p.number}</strong><span>{p.position||'位置未公布'}</span></div><span className="xz-card-league">{p.league}</span></div>
  <Portrait key={`${p.name}:${urls.join('|')}`} name={p.name} urls={urls} style={p.portraitStyle}/>
  <div className="xz-card-copy"><h3>{p.name}</h3><p className="xz-card-team">{p.team||p.league}{p.season?` · ${p.season}`:''}</p>
   {p.statsNote?<p className="xz-card-stats-note">{p.statsNote}</p>:!!p.stats?.length&&<dl className="xz-card-stats">{p.stats.map(s=><div key={s.label}><dt>{s.label}</dt><dd>{s.value??'—'}</dd></div>)}</dl>}
   <p className="xz-card-bio">{p.bio?.filter(Boolean).join(' · ')||'\u00a0'}</p>
   <div className="xz-card-footer"><span className="xz-card-badge">{p.badge}</span><span>{p.href?'查看資料 ↗':p.detail?'完整數據 ＋':'球員資料'}</span></div>
  </div>
 </>;
 if(p.href)return <a className="xz-player-card" href={p.href} aria-label={`查看 ${p.name} 球員資料`}>{content}</a>;
 if(p.detail)return <details className="xz-player-card xz-player-card--expand"><summary aria-label={`展開 ${p.name} 完整數據`}>{content}</summary><div className="xz-card-details">{p.detail}</div></details>;
 return <article className="xz-player-card">{content}</article>;
}
