'use client';
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import type {FootballPitchReading,PitchAction} from '../lib/football-pitch';

type Side={id:string;name:string};
type PitchGame={state:string;statusLabel:string;home:Side;away:Side;homeScore:number|null;awayScore:number|null};
type Stat={label:string;home:number|string;away:number|string};
type Props={game:PitchGame;reading?:FootballPitchReading & {notice?:PitchAction|null};stats?:Stat[];logo:(id:string)=>string;unavailable?:boolean};
function Field({action,side,animate}:{action?:PitchAction;side?:'home'|'away';animate:boolean}){
  const location=action?.point, end=action?.end;
  const corner=!!side&&!!action&&['corner','corner-awarded'].includes(action.type);
  const kick=!!side&&action?.type==='goal-kick';
  const targetRight=corner?side==='home':side==='away';
  return <svg aria-hidden="true" viewBox="0 0 100 60" preserveAspectRatio="none" className="xz-field-lines">
    <g fill="none" stroke="currentColor" strokeWidth=".28">
      <rect x=".4" y=".4" width="99.2" height="59.2"/><path d="M50 .4v59.2"/>
      <circle cx="50" cy="30" r="8"/><circle cx="50" cy="30" r=".48" fill="currentColor"/>
      {[false,true].map(flipped=><g key={String(flipped)} transform={flipped?'translate(100 60) rotate(180)':undefined}>
        <path d="M.4 12h16v36H.4 M.4 22h5v16h-5 M16.4 23q5.2 7 0 14 M.4 2.3a1.9 1.9 0 0 0 1.9-1.9 M.4 57.7a1.9 1.9 0 0 1 1.9 1.9"/>
        <circle cx="11" cy="30" r=".42" fill="currentColor"/></g>)}
    </g>
    {!location&&side&&(corner||kick)&&<g transform={targetRight?'translate(100 60) rotate(180)':undefined} className="xz-field-zone">
      {corner?<path d="M.5 .5h5.5a5.5 5.5 0 0 1-5.5 5.5z M.5 59.5H6A5.5 5.5 0 0 0 .5 54z"/>:<rect x=".5" y="22" width="5" height="16"/>}
    </g>}
    {location&&<g key={action?.id} className={animate?'xz-field-play is-moving':'xz-field-play'}>
      {end&&<line className="xz-play-trail" x1={location.x} y1={location.y*.6} x2={end.x} y2={end.y*.6} pathLength="1"/>}
      <g transform={`translate(${end?.x??location.x} ${(end?.y??location.y)*.6})`}>
        <g className="xz-moving-ball" style={{'--from-x':(location.x-(end?.x??location.x))+'px',
          '--from-y':((location.y-(end?.y??location.y))*.6)+'px'} as CSSProperties}>
          <circle className="xz-ball-ring" r="1.65"/><circle r="1.05" fill="#ffce41" stroke="#fff" strokeWidth=".44"/>
        </g>
      </g>
    </g>}
  </svg>;
}
function matchMinute(label?:string){
  const parts=/^(\d+)(?:['′’]?\+(\d+))?/.exec(label||'');
  return parts?Number(parts[1])+Number(parts[2]||0):null;
}
export default function FootballPitch({game,reading,stats=[],logo,unavailable}:Props){
  const live=game.state==='live', actions=reading?.actions||[];
  const latest=actions[0];
  const clock=live?(reading?.clock||game.statusLabel):game.statusLabel;
  const paused=/中場|半場休息/.test(clock);
  const showPlay=live&&!paused&&!reading?.delayed&&!unavailable;
  const previous=useRef<string|undefined>(undefined);
  const [frame,setFrame]=useState<PitchAction>();
  // Each poll may contain several real touches. Play a short batch in match order.
  const head=latest?.id;
  useEffect(()=>{
    const last=previous.current;
    previous.current=showPlay?head:undefined;
    if(!showPlay||!latest){setFrame(undefined);return;}
    const index=actions.findIndex(action=>action.id===last);
    const batch=index>0?actions.slice(0,Math.min(index,4)).reverse():[latest];
    const newest=Date.parse(latest.occurredAt||'');
    const recent=batch.filter(action=>action===latest||(action.occurredAt&&newest-Date.parse(action.occurredAt)<15000));
    setFrame(recent[0]);
    const timers=recent.slice(1).map((action,i)=>setTimeout(()=>setFrame(action),(i+1)*900));
    timers.push(setTimeout(()=>setFrame(undefined),25000));
    return ()=>timers.forEach(clearTimeout);
  },[head,showPlay]);
  const nowMinute=matchMinute(clock);
  const candidate=frame||latest;
  const lastMinute=matchMinute(candidate?.clock);
  const recentMinute=nowMinute===null||lastMinute===null||nowMinute-lastMinute<=1;
  const eventAge=Date.now()-Date.parse(candidate?.occurredAt||'');
  const fresh=eventAge>=0&&eventAge<60000;
  const replaying=!!frame?.occurredAt;
  const action=showPlay?(reading?.notice||(fresh||recentMinute||replaying?candidate:undefined)):game.state==='final'?latest:undefined;
  const animate=!!action&&showPlay&&(action===reading?.notice||action===frame&&(fresh||recentMinute||replaying));
  const side=action?.teamId===game.home.id?'home':action?.teamId===game.away.id?'away':undefined;
  const anchor=action?.end??action?.point;
  const attack=!!action&&['attack','dangerous-attack','shot-on-target','shot-off-target','shot-blocked'].includes(action.type);
  const possession=!!action&&['possession','ball_safe'].includes(action.type);
  const eventTime=action?.occurredAt;
  const stamp=Date.parse(eventTime||reading?.updatedAt||'');
  const syncTime=Number.isFinite(stamp)?new Date(stamp).toLocaleTimeString('zh-TW',{timeZone:'Asia/Taipei',hour12:false}):'';
  const zone=side&&action&&!action.point&&['corner','corner-awarded','goal-kick'].includes(action.type);
  const total=(label:string,team:'home'|'away')=>stats.find(row=>row.label===label)?.[team]??'—';
  const team=(which:'home'|'away')=>{
    const t=game[which],src=logo(t.id);
    return <div className={'xz-field-team xz-'+which}>{src&&<img src={src} alt="" width="28" height="28"/>}<div><small>{which==='home'?'主隊':'客隊'}</small><strong>{t.name}</strong></div></div>;
  };
  return <section className="xz-pitch" aria-label="即時球場">
    <header><h3>即時球場</h3>{live&&syncTime&&<small className="xz-sync">{eventTime?'事件時間':'資料時間'} {syncTime}</small>}<span>{unavailable?'更新暫停':reading?.delayed?'上次回報 '+clock:clock}</span></header>
    <div className="xz-turf">{action&&!action.point&&side&&<div key={action.id} aria-hidden="true"
        className={`xz-team-signal ${side}${animate?' is-moving':''}`}/>}
      <Field action={action} side={side} animate={animate}/>
      {side&&action&&!action.point&&(attack||possession)&&<div aria-hidden="true" key={'symbol:'+action.id}
        className={`xz-play-symbol ${side} ${attack?'attack':'possession'}${animate?' is-moving':''}`}>
        {attack?<><i/><i/><i/></>:<i/>}</div>}
      <div key={action?.id||'waiting'} className={'xz-action'+(animate?' is-moving':'')+(action?.point?' measured':side?' '+side:'')}
        style={anchor?{left:`clamp(3.8rem, ${2+.96*anchor.x}%, calc(100% - 3.8rem))`,
          top:`clamp(.35rem, calc(${5+.9*anchor.y}% ${anchor.y>50?'- 4.3rem':'+ .7rem'}), calc(100% - 3.9rem))`}:undefined} aria-live="polite" aria-atomic="true">
        {action?<><small>{live&&!recentMinute&&!fresh?'較早回報 · ':live&&!animate?'最近回報 · ':''}{action.clock}{zone?' · 區域示意':side&&!action.point&&(attack||possession)?' · 動作示意':action.point?' · 事件位置':''}</small><b>{action.label}</b>{side&&<span>{logo(game[side].id)&&<img src={logo(game[side].id)} width="18" height="18" alt=""/>}{game[side].name}</span>}</>
        :<b>{live?(paused?clock:unavailable||reading?.delayed?'等待場況更新':'等待下一筆場況'):game.state==='scheduled'?'等待開賽':game.statusLabel}</b>}
      </div>
    </div>
    <div className="xz-field-score">{team('home')}<b aria-label="主隊對客隊比分">{game.homeScore??'—'} : {game.awayScore??'—'}</b>{team('away')}</div>
    <div className="xz-field-totals">{[['角球','corner'],['黃牌','yellow'],['紅牌','red']].map(([label,kind])=>
      <div key={kind}><strong>{total(label,'home')}</strong><span><i className={'xz-stat-'+kind} aria-hidden="true"/>{label}</span><strong>{total(label,'away')}</strong></div>)}</div>
    {actions.length>0&&<div className="xz-recent"><strong>最近事件</strong>{actions.slice(0,3).map(e=><span key={e.id}><time>{e.clock}</time> {e.teamId===game.home.id?game.home.name:e.teamId===game.away.id?game.away.name:''} {e.label}</span>)}</div>}
  </section>;
}
