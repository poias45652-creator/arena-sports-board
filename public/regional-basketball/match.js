import {e,num,teamFor,name,logo,stateName,smallDate,key,stamp} from './shared.js';
export function teamAnchor(s,code,content){
 const url=new URLSearchParams({league:s.league,view:'teams',team:code,section:'summary',date:s.date});
 return '<a href="?'+e(url)+'" data-team="'+e(code)+'">'+content+'</a>';
}
export function matchup(s,g){
 const side=(code,label)=>teamAnchor(s,code,'<span class="nba-team-logo">'+logo(teamFor(s,code))+'</span><strong>'+e(name(s,code))+'</strong><small>'+label+(g.neutral?'・中立場':'')+'</small>').replace('<a ','<a class="nba-team" ');
 return '<div class="nba-match">'+side(g.away,'客隊')+'<b class="nba-match-score">'+(g.awayScore!=null&&g.homeScore!=null?num(g.awayScore)+'<span>:</span>'+num(g.homeScore):'VS')+'</b>'+side(g.home,'主隊')+'</div>';
}
export function periodName(n){const match=/^(?:Q)?(\d+)$/.exec(String(n));return match?(+match[1]>4?'延長 '+(+match[1]-4):'第 '+match[1]+' 節'):String(n||'');}
export function quarters(s,g,ps=g.periods||[]){
 if(!ps.length)return '';
 return '<div class="nba-table-scroll"><table class="nba-quarter-table nba-period-scores" aria-label="逐節比分"><thead><tr><th>球隊</th>'+ps.map((p,i)=>'<th>'+e(periodName(p.label||p.period||i+1))+'</th>').join('')+'<th>總分</th></tr></thead><tbody>'+['away','home'].map(k=>'<tr><th>'+teamAnchor(s,g[k],e(g[k]))+'</th>'+ps.map(p=>'<td><span>'+num(p[k])+'</span></td>').join('')+'<td><span>'+num(g[k+'Score'])+'</span></td></tr>').join('')+'</tbody></table></div>';
}
export function gameLabel(s,g){return g.status==='in_progress'?(s.isLive?'LIVE・':'場中快照・')+[periodName(g.period),g.clock].filter(Boolean).map(e).join(' '):e(stateName(g));}
export const gameTime=g=>e(smallDate(g.date)+' '+(g.time||'時間待定'));
export function form(s,g){
 const complete=new Map(),cut=Math.min(stamp(g),Date.now());
 for(const x of [...s.teamGames,...s.all]){
  if((x.phase??2)!==2||x.status!=='final'||stamp(x)>=cut||x.homeScore==null||x.awayScore==null||x.homeScore===x.awayScore||x.countsForWinLoss===false)continue;
  complete.set(key(x),x);
 }
 const recent=[...complete.values()].sort((a,b)=>stamp(b)-stamp(a));
 return '<div class="nba-form"><span>近期正式賽</span>'+['away','home'].map(side=>{
  const club=g[side],rows=recent.filter(x=>x.home===club||x.away===club).slice(0,20).map(x=>{const h=x.home===club;return [Number(h?x.homeScore:x.awayScore),Number(h?x.awayScore:x.homeScore)]});
  const wins=rows.filter(([a,b])=>a>b).length;
  const average=k=>rows.length?num(rows.reduce((sum,r)=>sum+r[k],0)/rows.length):'—';
  return '<div><small>'+(side==='away'?'客隊':'主隊')+'・近 '+rows.length+' 場</small><strong>'+(rows.length?wins:'—')+' <em>勝</em> '+(rows.length?rows.length-wins:'—')+' <em>負</em></strong><span>得 '+average(0)+' ／ 失 '+average(1)+'</span><div class="nba-streak">'+rows.slice(0,5).map(([a,b])=>'<i data-result="'+(a>b?'W':'L')+'">'+(a>b?'勝':'負')+'</i>').join('')+'</div></div>';
 }).join('')+'</div>';
}
