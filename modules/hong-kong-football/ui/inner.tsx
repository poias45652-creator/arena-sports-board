import { createRoot } from 'react-dom/client';
import FootballTeamProfile from './components/football-team-profile';
import SportPlayerProfile from './components/sport-player-profile';
import FootballLiveCenter,{FootballGameStrip} from './components/football-live-center';
import FootballStandings from './components/football-standings';

const league='hkg.1';
let boardRoot, boardTarget;
function BoardContent({view,day,filter,selected,onNavigate,games}){
  const filtered=games.filter(g=>filter==='all'||filter===g.state||filter==='other'&&['pending','postponed','cancelled','unknown'].includes(g.state));
  if(view==='overview')return <>
    <div className="football-overview-stats">{[[day?'當日賽事':'本輪賽事',games.length],['進行中',games.filter(g=>g.state==='live').length],['未開賽',games.filter(g=>g.state==='scheduled').length],['已完場',games.filter(g=>g.state==='final').length]].map(([label,n])=><div key={label}><span>{label}</span><strong>{n}</strong></div>)}</div>
    <div className="football-overview-links">{[['scores','查看比分與賽事紀錄'],['analysis','查看賽前分析'],['standings','查看戰績排名']].map(([id,label])=><button key={id} onClick={()=>onNavigate(id)}>{label} ›</button>)}</div>
    {filtered.length>0&&<FootballGameStrip games={filtered} selected="" onSelect={id=>onNavigate('scores',id)}/>}
  </>;
  return filtered.length?<FootballLiveCenter key={day+':'+selected} games={filtered} initialGameId={selected}/>:<p className="football-panel-empty">這個日期及篩選條件沒有收錄賽事。</p>;
}
export function unmountBoard(){
 if(boardRoot){boardRoot.unmount();boardRoot=null;boardTarget=null;}
}
export function mountBoard(target,props){
 if(boardTarget!==target){unmountBoard();boardTarget=target;boardRoot=createRoot(target);}
 if(props.view==='standings')boardRoot.render(<FootballStandings league={league}/>);
 else boardRoot.render(<BoardContent {...props}/>);
}
export function mountDeep(){
 const hit=location.pathname.match(/^\/(teams|players)\/football\/hkg\.1\/([^/]+)\/?$/);
 if(!hit)return false;
 const id=decodeURIComponent(hit[2]),q=new URLSearchParams(location.search);
 const el=document.getElementById('inner-page');
 document.querySelector('main.football-board').hidden=true; el.hidden=false;
 const root=createRoot(el);
 if(hit[1]==='teams')root.render(<FootballTeamProfile teamId={id} league={league} returnDay={q.get('date')||undefined}/>);
 else root.render(<SportPlayerProfile id={id} league={league} team={q.get('team')||''} initialSeason={Number(q.get('season'))||2026}/>);
 return true;
}
