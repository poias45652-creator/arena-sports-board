import {FOOTBALL_LEAGUES, type FootballLeague} from '@/lib/football';

export const hongKongBoardHref = '/?league=FOOTBALL&competition=hkg.1&view=analysis';
const leagues = [...FOOTBALL_LEAGUES, {code:'hkg.1',name:'香港超級聯賽'}] as const;
export default function FootballCompetitionNav({selected,onSelect}:{selected:string;onSelect?:(league:FootballLeague)=>void}) {
  function select(code:FootballLeague|'hkg.1') {
    if(code==='hkg.1') {
      const url=new URL(hongKongBoardHref,window.location.origin);
      if(code===selected)url.searchParams.set('view',new URLSearchParams(window.location.search).get('view')||'analysis');
      window.location.assign(url.href);
      return;
    }
    if(code===selected)return;
    if(onSelect) onSelect(code);
    else window.location.assign('/?'+new URLSearchParams({league:'FOOTBALL',competition:code,view:'analysis'}));
  }
  return <nav className="football-leagues" aria-label="足球聯賽">{leagues.map(item=><button
    type="button" key={item.code} onClick={()=>select(item.code)} aria-pressed={item.code===selected}>{item.name}</button>)}</nav>;
}
