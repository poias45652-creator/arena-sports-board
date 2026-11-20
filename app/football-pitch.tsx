'use client';
import type {FootballPitchReading,PitchAction} from '../lib/football-pitch';

type Side={id:string;name:string};
type PitchGame={state:string;statusLabel:string;home:Side;away:Side;homeScore:number|null;awayScore:number|null};
type Stat={label:string;home:number|string;away:number|string};
type Props={game:PitchGame;reading?:FootballPitchReading & {notice?:PitchAction|null};stats?:Stat[];logo:(id:string)=>string;unavailable?:boolean};
function Field({action,side}:{action?:PitchAction;side?:'home'|'away'}){
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
    {location&&<g key={action?.id} className="xz-field-play">
      {end&&<line x1={location.x} y1={location.y*.6} x2={end.x} y2={end.y*.6} stroke="#fff" strokeWidth=".55" strokeDasharray="1.1 .8"/>}
      <circle cx={location.x} cy={location.y*.6} r="1.08" fill="#ffda45" stroke="#fff" strokeWidth=".44"/>
    </g>}
  </svg>;
}
export default function FootballPitch({game,reading,stats=[],logo,unavailable}:Props){
  const live=game.state==='live', actions=reading?.actions||[];
  const action=live?(reading?.notice||actions[0]):game.state==='final'?actions[0]:undefined;
  const side=action?.teamId===game.home.id?'home':action?.teamId===game.away.id?'away':undefined;
  const clock=live?(reading?.clock||game.statusLabel):game.statusLabel;
  const zone=side&&action&&!action.point&&['corner','corner-awarded','goal-kick'].includes(action.type);
  const total=(label:string,team:'home'|'away')=>stats.find(row=>row.label===label)?.[team]??'—';
  const team=(which:'home'|'away')=>{
    const t=game[which],src=logo(t.id);
    return <div className={'xz-field-team xz-'+which}>{src&&<img src={src} alt="" width="28" height="28"/>}<div><small>{which==='home'?'主隊':'客隊'}</small><strong>{t.name}</strong></div></div>;
  };
  return <section className="xz-pitch" aria-label="即時球場">
    <header><h3>即時球場</h3><span>{unavailable?'更新暫停':reading?.delayed?'上次回報 '+clock:clock}</span></header>
    <div className="xz-turf"><Field action={action} side={side}/>
      <div className={'xz-action'+(action?.point?' measured':side?' '+side:'')}
        style={action?.point?{left:`clamp(3.8rem, ${2+.96*action.point.x}%, calc(100% - 3.8rem))`,top:action.point.y>50?'8%':undefined}:undefined} aria-live="polite" aria-atomic="true">
        {action?<><small>{action.clock}{zone?' · 區域示意':action.point?' · 事件位置':''}</small><b>{action.label}</b>{side&&<span>{game[side].name}</span>}</>
        :<b>{live?'等待場上事件':game.state==='scheduled'?'等待開賽':game.statusLabel}</b>}
      </div>
    </div>
    <div className="xz-field-score">{team('home')}<b aria-label="主隊對客隊比分">{game.homeScore??'—'} : {game.awayScore??'—'}</b>{team('away')}</div>
    <div className="xz-field-totals">{[['角球','corner'],['黃牌','yellow'],['紅牌','red']].map(([label,kind])=>
      <div key={kind}><strong>{total(label,'home')}</strong><span><i className={'xz-stat-'+kind} aria-hidden="true"/>{label}</span><strong>{total(label,'away')}</strong></div>)}</div>
    {actions.length>0&&<div className="xz-recent"><strong>最近事件</strong>{actions.slice(0,3).map(e=><span key={e.id}><time>{e.clock}</time> {e.teamId===game.home.id?game.home.name:e.teamId===game.away.id?game.away.name:''} {e.label}</span>)}</div>}
  </section>;
}
