import {internationalTeam} from './international-teams';
import type {PregameData,PregameSide} from './international-pregame';
export function supplementBullpens(data:PregameData,result:any,now=Date.now()):PregameData{
 if(!['NPB','KBO'].includes(data.league))return data;
 return {...data,games:data.games.map(g=>{
  const start=Date.parse(g.start.replace(' ','T')+'+08:00');if(g.date!==data.date||!Number.isFinite(start)||start<=now)return g;
  const valid=(r:any)=>{const at=Date.parse(r?.source?.observedAt);return r&&Number.isFinite(at)&&at<=now&&at<start&&now-at<=36*3600000&&r.source.throughDate<g.date&&r.source.throughDate.slice(0,4)===g.date.slice(0,4);};
  const enrich=(side:PregameSide):PregameSide=>{const rows=(result.rows||[]).filter((r:any)=>internationalTeam(r.team,data.league)===side.team&&valid(r));if(rows.length!==1)return side;const row=rows[0];if(side.bullpenSource&&Date.parse(side.bullpenSource.observedAt)>Date.parse(row.source.observedAt))return side;
   if(!/^\d+(\.\d+)?$/.test(row.stats?.era)||!/^\d+(\.[012])?$/.test(row.stats?.innings)||Number(row.stats.innings)<=0)return side;return {...side,bullpen:row.stats,bullpenSource:row.source};};
  const out={...g,away:enrich(g.away),home:enrich(g.home)};
  if(data.league==='NPB'){
   const records=[g.away,g.home].map(side=>(result.teamRuns||[]).filter((r:any)=>internationalTeam(r.team,'NPB')===side.team&&valid(r)));
   if(records.every(r=>r.length===1)){
    const rows=records.map(r=>r[0]);const at=rows.map(r=>r.source.observedAt).sort()[0];
    if(!g.comparisonSource||Date.parse(g.comparisonSource.observedAt)<=Date.parse(at)){
     out.comparison={title:'NPB 官方本季團隊得失分',headers:['球隊','類別','勝敗','得/失分'],rows:rows.map(r=>[r.team,'本季',`${r.wins}-${r.losses}-${r.games-r.wins-r.losses}`,`${(r.scored/r.games).toFixed(6)} / ${(r.allowed/r.games).toFixed(6)}`])};
     out.comparisonSource={name:'NPB 官方團隊攻守成績',url:rows[0].source.url,observedAt:at,throughDate:rows.map(r=>r.throughDate).sort()[0],games:Math.min(...rows.map(r=>r.games))};
    }
   }
  }return out;
 })};
}
