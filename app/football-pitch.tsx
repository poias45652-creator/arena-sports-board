'use client';
import {useEffect,useState,type CSSProperties} from 'react';
import {createPitchPlayback,pitchPlaybackActions,type FootballPitchReading,type PitchAction,type PitchPoint} from '../lib/football-pitch';

type Side={id:string;name:string};
type PitchGame={state:string;statusLabel:string;home:Side;away:Side;homeScore:number|null;awayScore:number|null};
type Stat={label:string;home:number|string;away:number|string};
type Props={game:PitchGame;reading?:FootballPitchReading & {notice?:PitchAction|null};stats?:Stat[];logo:(id:string)=>string;unavailable?:boolean};
function Field({action,side,animate,held}:{action?:PitchAction;side?:'home'|'away';animate:boolean;held?:PitchPoint}){
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
    {!location&&held&&<circle cx={held.x} cy={held.y*.6} r="1.05" fill="#ffce41" stroke="#fff" strokeWidth=".44"/>}
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
const eventFormatter=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',hourCycle:'h23',hour:'2-digit',minute:'2-digit',second:'2-digit'});
function eventClock(iso:string){
  const time=Date.parse(iso);
  return Number.isFinite(time)?eventFormatter.format(time):'';
}
function matchMinute(label?:string){
  const parts=/^(\d+)(?:['′’]?\+(\d+))?/.exec(label||'');
  return parts?Number(parts[1])+Number(parts[2]||0):null;
}
export default function FootballPitch({game,reading,stats=[],logo,unavailable}:Props){
  const live=game.state==='live', actions=reading?.actions||[];
  const latest=actions[0];
  const paused=live&&[game.statusLabel,reading?.clock].some(label=>/中場|半場休息/.test(label||''));
  const clock=paused?'中場休息':live?(reading?.clock||game.statusLabel):game.statusLabel;
  const showPlay=live&&!paused&&!reading?.delayed&&!unavailable;
  const [frame,setFrame]=useState<{action:PitchAction;moving:boolean;position?:PitchPoint}>();
  const [playback]=useState(()=>createPitchPlayback((action,moving)=>{
    setFrame(previous=>({action,moving,position:action.end??action.point??previous?.position}));
  }));
  useEffect(()=>()=>playback.stop(),[playback]);
  useEffect(()=>{
    if(showPlay)playback.update(pitchPlaybackActions(reading?.actions||[]));
    else playback.stop();
  },[playback,reading?.actions,showPlay]);
  const action=live&&!paused?((showPlay&&reading?.notice)||frame?.action||latest):game.state==='final'?latest:undefined;
  const nowMinute=matchMinute(clock), lastMinute=matchMinute(action?.clock);
  const recentMinute=nowMinute===null||lastMinute===null||nowMinute-lastMinute<=1;
  const age=Date.now()-Date.parse(action?.occurredAt||'');
  const fresh=age>=0&&age<60000;
  const animate=!!action&&showPlay&&(action===reading?.notice||
    action===frame?.action&&frame.moving&&(!!action.occurredAt||recentMinute));
  const index=action?actions.findIndex(a=>a.id===action.id):-1;
  const lastLocated=action&&!action.point&&index>=0?actions.slice(index).find(a=>a.point):undefined;
  const held=action&&!action.point?(frame?.position??lastLocated?.end??lastLocated?.point):undefined;
  const side=action?.teamId===game.home.id?'home':action?.teamId===game.away.id?'away':undefined;
  const anchor=action?.end??action?.point;
  const attack=!!action&&['attack','dangerous-attack','shot-on-target','shot-off-target','shot-blocked'].includes(action.type);
  const possession=!!action&&['possession','ball_safe'].includes(action.type);
  const eventTime=action?.occurredAt;
  const stamp=Date.parse(eventTime||reading?.updatedAt||'');
  const syncTime=Number.isFinite(stamp)?eventFormatter.format(stamp):'';
  const latestTime=actions.find(a=>a.occurredAt)?.occurredAt;
  const lagSeconds=Math.floor((Date.now()-Date.parse(latestTime||''))/1000);
  const lag=showPlay&&lagSeconds>=30?`上次逐球回報 ${lagSeconds} 秒前`:'';

  const zone=side&&action&&!action.point&&['corner','corner-awarded','goal-kick'].includes(action.type);
  const total=(label:string,team:'home'|'away')=>stats.find(row=>row.label===label)?.[team]??'—';
  const team=(which:'home'|'away')=>{
    const t=game[which],src=logo(t.id);
    return <div className={'xz-field-team xz-'+which}>{src&&<img src={src} alt="" width="28" height="28"/>}<div><small>{which==='home'?'主隊':'客隊'}</small><strong>{t.name}</strong></div></div>;
  };
  return <section className="xz-pitch" aria-label="即時球場">
    <header><h3>即時球場</h3>{live&&syncTime&&<small className="xz-sync">{eventTime?'事件時間':'資料時間'} {syncTime}{lag&&<span>{lag}</span>}</small>}<span>{unavailable?'重新連線中 · '+clock:reading?.delayed?'上次回報 '+clock:clock}</span></header>
    <div className="xz-turf">{action&&!action.point&&side&&<div key={action.id} aria-hidden="true"
        className={`xz-team-signal ${side}${animate?' is-moving':''}`}/>}
      <Field action={action} side={side} animate={animate} held={held}/>
      {held&&<small className="xz-last-position">上次定位</small>}
      {side&&action&&!action.point&&(attack||possession)&&<div aria-hidden="true" key={'symbol:'+action.id}
        className={`xz-play-symbol ${side} ${attack?'attack':'possession'}${animate?' is-moving':''}`}>
        {attack?<><i/><i/><i/></>:<i/>}</div>}
      <div key={action?.id||'waiting'} className={'xz-action'+(animate?' is-moving':'')+(action?.point?' measured':side?' '+side:'')}
        style={anchor?{left:`clamp(3.8rem, ${2+.96*anchor.x}%, calc(100% - 3.8rem))`,
          top:`clamp(.35rem, calc(${5+.9*anchor.y}% ${anchor.y>50?'- 4.3rem':'+ .7rem'}), calc(100% - 3.9rem))`}:undefined} aria-live="polite" aria-atomic="true">
        {action?<><small>{live&&!recentMinute&&!fresh?'較早回報 · ':live&&!animate?'最近回報 · ':''}{action.clock}{zone?' · 區域示意':side&&!action.point&&(attack||possession)?' · 動作示意':action.point?(animate?' · 事件位置':' · 最後回報位置'):''}</small><b>{action.label}</b>{side&&<span>{logo(game[side].id)&&<img src={logo(game[side].id)} width="18" height="18" alt=""/>}{game[side].name}</span>}</>
        :<b>{live?(paused?clock:unavailable||reading?.delayed?'等待場況更新':'等待下一筆場況'):game.state==='scheduled'?'等待開賽':game.statusLabel}</b>}
      </div>
    </div>
    <div className="xz-field-score">{team('home')}<b aria-label="主隊對客隊比分">{game.homeScore??'—'} : {game.awayScore??'—'}</b>{team('away')}</div>
    <div className="xz-field-totals">{[['角球','corner'],['黃牌','yellow'],['紅牌','red']].map(([label,kind])=>
      <div key={kind}><strong>{total(label,'home')}</strong><span><i className={'xz-stat-'+kind} aria-hidden="true"/>{label}</span><strong>{total(label,'away')}</strong></div>)}</div>
    {actions.length>0&&<div className="xz-recent"><strong>最近事件</strong>{actions.slice(0,3).map(e=><span key={e.id}><time>{e.clock}</time> {e.teamId===game.home.id?game.home.name:e.teamId===game.away.id?game.away.name:''} {e.label}{e.occurredAt&&<small>（{eventClock(e.occurredAt)}）</small>}</span>)}</div>}
  </section>;
}
