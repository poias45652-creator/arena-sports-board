import {e,num,pct,logo,teamFor,name,teamButton,results,record,recentRun,smallDate,stateName,stamp,panelHeading,tabBtn,empty,standingsRows} from './shared.js';
import {teamAnchor} from './match.js';
import {tradingCard} from './player-profile.js';
export {playerProfile} from './player-profile.js';
const cells=(labels,rows)=>'<div class="table-wrap"><table><thead><tr>'+labels.map(l=>'<th>'+e(l)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
const paths=(s,t,section='summary')=>'?'+new URLSearchParams({league:s.league,view:'teams',team:t,section});
function identity(s,t){return '<a class="nba-team" href="'+e(paths(s,t.code))+'" data-team="'+e(t.code)+'" aria-label="查看'+e(t.name)+'球隊數據"><span class="nba-team-logo">'+logo(t)+'</span><strong>'+e(t.name)+'</strong><small>'+e(t.code)+'</small></a>';}
export function teams(s){return '<div class="nba-team-directory">'+s.info.teams.map(t=>identity(s,t)).join('')+'</div>';}
const phaseName={1:'熱身賽',2:'例行賽',3:'季後賽',4:'盃賽'};
const yearTag=y=>(y-1)+'–'+String(y).slice(-2);
const seasonOf=g=>g.season!=null&&Number(g.season)>=2000?Number(g.season):Number(g.date.slice(0,4))+(Number(g.date.slice(5,7))>=8?1:0);
function selectTeam(key,label,choices,value){return '<label>'+label+'<select aria-label="'+label+'" data-teamfilter="'+key+'">'+choices.map(([k,v])=>'<option value="'+e(k)+'" '+(String(k)===String(value)?'selected':'')+'>'+e(v)+'</option>').join('')+'</select></label>';}
function profileGame(s,g,t){
 const home=g.home===t.code,opp=home?g.away:g.home,pf=home?g.homeScore:g.awayScore,pa=home?g.awayScore:g.homeScore,final=g.status==='final';
 const opponent=teamFor(s,opp),opponentLabel=opponent?.name||(home?g.awayName:g.homeName)||opp;
 const opponentLink=opponent?'<a href="'+e(paths(s,opp))+'" data-team="'+e(opp)+'">'+e(opponentLabel)+'</a>':'<span>'+e(opponentLabel)+'</span>';
 return '<article class="nba-profile-game"><div><time>'+e(g.date+' '+(g.time||''))+'</time><span>'+e(phaseName[g.phase]||'')+'</span></div><div><small>'+(home?'主場':'客場')+'</small>'+opponentLink+'<b>'+(final?e(pf+' : '+pa):'VS')+'</b>'+(final&&pf!==pa?'<span class="nba-result" data-result="'+(pf>pa?'W':'L')+'">'+(pf>pa?'勝':'負')+'</span>':'')+'</div></article>';
}
export function teamProfile(s){
 const t=teamFor(s,s.teamCode);if(!t)return teams(s);
 const players=s.rosters[t.code]||[],mode=s.teamView||'summary';
 const tabs=[['summary','概覽'],['trends','月度趨勢'],['games','近期賽事'],['roster','球員']];
 const head='<div class="nba-profile"><div class="nba-profile-inner"><a class="nba-back" data-backteams href="?league='+s.league+'&view=teams">← 返回 '+s.league+' 球隊一覽</a><div class="nba-profile-heading">'+identity(s,t)+'<div><span class="nba-eyebrow">'+s.league+' 球隊數據</span><h1>'+e(t.name)+'</h1><p>'+e([t.code,t.en].filter(Boolean).join(' · '))+'</p></div></div><nav class="nba-profile-tabs" aria-label="球隊數據分頁">'+tabs.map(([v,l])=>tabBtn('data-teamview',v,l,v===mode)).join('')+'</nav>';
 const end='</div></div>';
 const additional=(s.extras?.[t.code]||[]).filter(p=>!players.some(x=>x.id===p.id));
 if(mode==='roster'){
  const group=(title,caption,list)=>'<section class="nba-profile-panel"><div class="nba-panel-title"><h2>'+e(title)+'</h2><span>'+e(caption)+'</span></div><div class="xz-player-grid">'+list.map(p=>tradingCard(s,p)).join('')+'</div></section>';
  const registered=additional.filter(p=>p.rosterStatus==='season_registration');
  const other=additional.filter(p=>!registered.includes(p));
  const bench=other.filter(p=>p.dnpGameLog?.length&&!p.gp&&!p.phaseGameLog?.length&&p.rosterStatus!=='historical_appearance'),appeared=other.filter(p=>!bench.includes(p));
  return head+group('球員名單',s.info.season+'・'+(s.rostersLoaded?players.length+' 位球員':'讀取中'),players)+(appeared.length?group('本季曾代表本隊出賽','現役名單以外・'+appeared.length+' 位',appeared):'')+(bench.length?group('本季登錄未上場','現役名單以外・'+bench.length+' 位',bench):'')+(registered.length?group('本季曾登錄球員','現役名單以外・'+registered.length+' 位',registered):'')+end;
 }
 const completeGames=new Map();
 for(const g of [...(s.teamGames||[]),...s.all]){
  if(g.home!==t.code&&g.away!==t.code)continue;const k=g.date+g.home+g.away,prev=completeGames.get(k);
  if(prev?.status==='final'&&g.status!=='final')continue;
  completeGames.set(k,{...prev,...g,phase:prev?.phase??g.phase??2,season:prev?.season??g.season});
 }
 const games=[...completeGames.values()].sort((a,b)=>b.date.localeCompare(a.date));
 const years=[...new Set([s.seasonEnd,...games.map(seasonOf)])].sort((a,b)=>b-a);
 const y=Number(s.teamYear)||s.seasonEnd,ph=Number(s.teamPhase)||2,ven=s.venue||'all',limit=Number(s.teamLimit)||0;
 const subset=games.filter(g=>seasonOf(g)===y&&g.phase===ph&&(ven==='home'?g.home===t.code:ven==='away'?g.away===t.code:true));
 const finals=subset.filter(g=>g.status==='final'&&g.awayScore!=null&&g.homeScore!=null);
 const rows=(limit?finals.slice(0,limit):finals).map(g=>{const home=g.home===t.code,pf=home?g.homeScore:g.awayScore,pa=home?g.awayScore:g.homeScore;return {g,pf,pa,win:pf>pa,opp:home?g.away:g.home};});
 const heading='<div class="nba-profile-selects">'+selectTeam('teamYear','球季',years.map(y=>[y,yearTag(y)]),y)+selectTeam('teamPhase','賽事',Object.entries(phaseName).sort((a,b)=>[2,3,1,4].indexOf(+a[0])-[2,3,1,4].indexOf(+b[0])),ph)+selectTeam('venue','場地',[['all','全部'],['home','主場'],['away','客場']],ven)+selectTeam('teamLimit','場次',[[0,'整季'],[5,'近 5 場'],[10,'近 10 場'],[20,'近 20 場']],limit)+'</div>';
 const avg=(arr,k)=>arr.length?arr.reduce((a,r)=>a+r[k],0)/arr.length:null;
 const decisions=rows.filter(r=>r.g.countsForWinLoss!==false&&r.pf!==r.pa),wins=decisions.filter(r=>r.win).length,winsPct=decisions.length?wins*100/decisions.length:null,gp=rows.length;
 const summary='<div class="nba-profile-stats nba-profile-summary">'+[['戰績',gp?wins+' 勝 '+(decisions.length-wins)+' 負':'—'],['勝率',pct(winsPct)],['場均得分',num(avg(rows,'pf'),1)],['場均失分',num(avg(rows,'pa'),1)],['場均淨勝分',gp?num(avg(rows,'pf')-avg(rows,'pa'),1):'—']].map(([l,v],i)=>'<div><span>'+l+'</span><strong>'+v+'</strong>'+(i?'':'<small>'+gp+' 場'+phaseName[ph]+'</small>')+'</div>').join('')+'</div>';
 const panel=(l,b)=>'<section class="nba-profile-panel"><h2>'+l+'</h2>'+b+'</section>';
 const caption=e(yearTag(y)+' · '+phaseName[ph]);
 let content='';
 if(mode==='games')content='<div class="nba-profile-columns">'+panel('賽事紀錄',rows.map(r=>profileGame(s,r.g,t)).join('')||empty('此範圍尚無賽果'))+panel('接下來的賽程',subset.filter(g=>stamp(g)>Date.now()&&g.status!=='final').reverse().slice(0,5).map(g=>profileGame(s,g,t)).join('')||empty('此範圍尚無後續賽程'))+'</div>';
 else if(mode==='trends'){
  const months=new Map();for(const r of rows){const k=r.g.date.slice(0,7);if(!months.has(k))months.set(k,[]);months.get(k).push(r);}
  content=panel('月度戰績',months.size?cells(['月份','場次','勝','負','勝率','場均得分','場均失分','淨勝分'],[...months].map(([k,rr])=>{const decided=rr.filter(v=>v.g.countsForWinLoss!==false&&v.pf!==v.pa),w=decided.filter(v=>v.win).length;return [k,rr.length,w,decided.length-w,pct(decided.length?w*100/decided.length:null),num(avg(rr,'pf'),1),num(avg(rr,'pa'),1),num(avg(rr,'pf')-avg(rr,'pa'),1)];})):empty('此範圍尚無賽果'));
 }else{
  const groups=new Map();for(const r of decisions){if(!groups.has(r.opp))groups.set(r.opp,[]);groups.get(r.opp).push(r);}
  content='<div class="nba-profile-columns">'+panel('對各隊戰績',[...groups].map(([c,rr])=>{const w=rr.filter(r=>r.win).length,wp=w*100/rr.length;return '<div class="nba-opponent"><a data-team="'+e(c)+'" href="'+e(paths(s,c))+'">'+logo(teamFor(s,c))+'<strong>'+e(name(s,c))+'</strong></a><span>'+w+' 勝 '+(rr.length-w)+' 負</span><b>'+pct(wp)+'</b><div class="nba-win-bar"><i style="width:'+wp+'%"></i></div></div>';}).join('')||empty('此範圍尚無對戰紀錄'))+
  panel('球隊資訊','<p class="nba-profile-caption">'+caption+'</p><dl class="nba-facts">'+[['統計場次',gp+' 場'],['比賽日期',gp?rows.at(-1).g.date+' ～ '+rows[0].g.date:null],['主場城市',t.city],['目前球員人數',s.rostersLoaded?players.length+' 位':null]].filter(([,v])=>v).map(([l,v])=>'<dt>'+e(l)+'</dt><dd>'+e(v)+'</dd>').join('')+'</dl><button class="nba-source-link" data-teamview="roster">查看球員名單 →</button>')+'</div>';
 }
 return head+heading+summary+content+end;
}

export function standings(s){
 const rows=standingsRows(s),years=Object.keys(s.rankArchive||{}).map(Number).sort((a,b)=>b-a);
 const select=(attr,options,value)=>'<select '+attr+'>'+options.map(([v,l])=>'<option value="'+e(v)+'" '+(v===value?'selected':'')+'>'+e(l)+'</option>').join('')+'</select>';
 const signed=n=>n==null?'—':(n>0?'+':'')+num(n,1);
 const labels=['排名','球隊','勝','負','勝率','勝差','主場','客場','近十場','連勝敗','場均得分','場均失分','淨勝分'];
 const rankOnly=s.phase===2;
 const table=rows.length?'<section><h3>'+(rankOnly?'全聯盟':'各隊戰績')+'</h3><div class="nba-table-scroll" data-scroll="ranks" tabindex="0" role="region" aria-label="左右滑動查看戰績表"><table><thead><tr>'+labels.map(l=>'<th scope="col">'+l+'</th>').join('')+'</tr></thead><tbody>'+rows.map(x=>{
  const place=rankOnly&&x.gp>0?x.rank:null,streak=String(x.streak??'—').replace(/^([WL勝敗負])(\d+)$/,(_,a,n)=>n+' 連'+(['W','勝'].includes(a)?'勝':'敗'));
  return '<tr><td><span class="standings-rank" '+(place?'data-place="'+e(place)+'"':'')+'>'+e(place??'—')+'</span></td><th scope="row">'+(teamFor(s,x.code)?teamAnchor(s,x.code,logo(teamFor(s,x.code))+'<span>'+e(name(s,x.code))+'</span>'):e(({ORI:'高陽獵戶座',CAR:'高陽胡蘿蔔'})[x.code]||x.teamName||x.code))+'</th><td>'+num(x.wins)+'</td><td>'+num(x.losses)+'</td><td class="standings-key-stat">'+pct(x.winPct)+'</td>'+[x.gb==null?'—':Number(x.gb),x.homeRecord,x.awayRecord,x.last10,streak,num(x.pf,1),num(x.pa,1),signed(x.pf!=null&&x.pa!=null?x.pf-x.pa:null)].map(v=>'<td>'+e(v)+'</td>').join('')+'</tr>';
 }).join('')+'</tbody></table></div></section>':'';
 return '<section class="basketball-standings sport-standings" id="rankings"><header><div><h2>戰績排名</h2><p>'+e(s.league+'・'+yearTag(s.rankSeason)+'・'+phaseName[s.phase])+'</p></div><div><label>球季'+select('data-rankseason',(years.length?years:[s.seasonEnd,s.seasonEnd-1,s.seasonEnd-2]).map(y=>[y,yearTag(y)]),s.rankSeason)+'</label><label>賽季'+select('data-phase',[[2,'例行賽'],[1,'熱身賽'],[3,'季後賽']],s.phase)+'</label><button data-rankrefresh>更新</button></div></header><p class="nba-updated">'+e(s.rankLabel||'已保存排名')+'（台灣）</p>'+
 table+(s.rankSeries?.length?cells(['階段','對戰','系列賽勝場'],s.rankSeries.map(v=>[e(v.round),e(name(s,v.home)+' vs '+name(s,v.away)),e(v.homeWins+'–'+v.awayWins)])):'')+(!rows.length&&!s.rankSeries?.length?empty(s.rankBusy?'正在查詢聯盟戰績…':s.rankNote||'此球季及階段尚無已完成賽事。'):'')+'</section>';
}
