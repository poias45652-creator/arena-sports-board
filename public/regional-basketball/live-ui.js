import {e,num,link,logo,teamFor,name,teamButton,smallDate,stateName,status,empty,tabBtn,panelHeading} from './shared.js';
import {matchup,quarters,periodName,gameLabel,gameTime,teamAnchor} from './match.js';
import {rosterPlayer} from './player-profile.js';
function miniCard(s,g){
 const live=g.status==='in_progress'&&s.isLive;
 return '<article class="nba-card" data-state="'+(live?'live':e(g.status))+'"><header><div class="nba-card-labels"><span class="nba-phase-tag">'+e(({1:'熱身賽',2:'例行賽',3:'季後賽',4:'盃賽'})[g.phase??2]||'聯盟賽事')+'</span><span class="'+(live?'nba-live':'nba-game-status')+'"><i></i>'+gameLabel(s,g)+'</span></div><time>'+gameTime(g)+'</time></header><div class="nba-card-layout" data-analysis="false"><div class="nba-match-overview">'+matchup(s,g)+quarters(s,g)+'<button class="xz-game-link" data-open-game="'+e(g.id||g.home)+'">比分與球員數據 →</button></div></div></article>';
}
export function overview(s){
 const stats=[['當日賽事',s.games.length],['進行中',s.games.filter(g=>g.status==='in_progress').length],['已完賽',s.games.filter(g=>g.status==='final').length],['聯盟球隊',s.info.teams.length]];
 return '<div class="basketball-overview">'+stats.map(([l,v])=>'<div><span>'+l+'</span><strong>'+v+'</strong></div>').join('')+'<nav aria-label="籃球功能捷徑">'+[['live','查看比分與球員成績'],['analysis','查看賽前分析'],['standings','查看戰績排名']].map(([v,l])=>'<button data-view="'+v+'">'+l+'<span>→</span></button>').join('')+'</nav></div>'+(s.visible.length?'<div class="nba-games" data-view="overview">'+s.visible.map(g=>miniCard(s,g)).join('')+'</div>':noGames(s));
}
export function noGames(s){
  if(s.filter!=='all'&&s.games.length)return empty('沒有符合篩選條件的場次。');
  return '<div class="empty">'+(s.busy?'正在取得官方賽程…':s.isLive?'當天沒有收錄賽事。':'此日期尚無已核實的賽程。')+'<br><button class="official" data-nextday>下一個比賽日 →</button></div>';
}
export function strip(s){
 return '<div class="game-strip-picker"><div class="game-strip-controls"><span>選擇比賽・'+s.visible.length+' 場</span><div><button aria-label="往前滑動比賽" data-slides="-1">‹</button><button aria-label="往後滑動比賽" data-slides="1">›</button></div></div><div tabindex="0" aria-label="選擇比賽" class="basketball-game-strip game-strip-scroll" data-scroll="strip">'+s.visible.map(g=>'<button data-game="'+e(g.id||g.home)+'" aria-pressed="'+(g===s.game)+'"><span>'+gameLabel(s,g)+'</span><div>'+logo(teamFor(s,g.away))+'<b>'+(g.awayScore!=null&&g.homeScore!=null?num(g.awayScore)+' : '+num(g.homeScore):'VS')+'</b>'+logo(teamFor(s,g.home))+'</div><strong>'+e(name(s,g.away))+'<br>對 '+e(name(s,g.home))+'</strong><time>'+gameTime(g)+'（台灣）</time></button>').join('')+'</div></div>';
}
const shooting={fg:['fgm','fga'],three:['threeMade','threeAttempted'],ft:['ftm','fta']};
function stat(p,k){
 if(!p||p.dnp||p.didNotPlay)return '—';
 if(p[k]!=null&&p[k]!=='')return e(p[k]);
 const pair=shooting[k];return pair&&pair.every(x=>p[x]!=null)?pair.map(x=>num(p[x])).join(' / '):'—';
}
function compare(s,g,d){
 const stats=d.teamStats||{};
 return '<section class="basketball-team-comparison" aria-label="兩隊技術統計"><h3>球隊數據</h3><div><span>'+e(g.away)+'</span><span>項目</span><span>'+e(g.home)+'</span></div>'+[['fg','投籃'],['three','三分'],['ft','罰球'],['reb','籃板'],['ast','助攻'],['turnovers','失誤']].map(([k,l])=>'<div><b>'+stat(stats.away,k)+'</b><span>'+l+'</span><b>'+stat(stats.home,k)+'</b></div>').join('')+'</section>';
}
function person(s,club,entry){
 const alias=s.aliases?.[entry.playerId||entry.id],ids=[alias,entry.playerId,entry.id].filter(Boolean).map(String);
 const players=[...(s.rosters[club]||[]),...(s.extras?.[club]||[])];
 const raw=players.find(p=>ids.includes(String(p.id)))||players.find(p=>[p.name,p.native,p.en].filter(Boolean).some(n=>[entry.name,entry.native,entry.actor].filter(Boolean).some(x=>String(x).toLowerCase()===String(n).toLowerCase())));
 if(raw)return rosterPlayer(s,raw);
 return null;
}
function playerLabel(s,p,entry,club){
 const n=e(p?.zh||p?.name||entry.name||entry.actor||entry.native||'球員');
 if(!p)return n;
 club=p.profileClub||club;
 const params=new URLSearchParams({league:s.league,view:'teams',team:club,section:'roster',player:p.id,date:s.date});
 return '<a href="?'+e(params)+'" data-player="'+e(p.id)+'" data-club="'+e(club)+'">'+n+'</a>';
}
function portrait(s,p){
 if(!p)return '';const src=p.photo&&!p.photo.startsWith('https:')?'/regional-basketball/players/'+s.league.toLowerCase()+'/'+p.photo.split('/').at(-1):p.photo||p.photoUrl;
 return src?'<span class="basketball-player-photo"><img width="48" height="48" loading="lazy" alt="" src="'+e(src)+'"></span>':'';
}
function playerCard(s,g,club,x){
 const p=person(s,club,x),fields=[['fg','投籃'],['three','三分'],['ft','罰球'],['stl','抄截'],['blk','阻攻'],['turnovers','失誤'],['oreb','進攻籃板'],['dreb','防守籃板'],['fouls','犯規'],['plusMinus','正負值']];
 const ident=e([x.number!=null&&x.number!==''?'#'+x.number:null,p?.position||x.position,x.dnp||x.didNotPlay?'未上場':x.starter?'先發':x.played===false||x.participated===false?'尚未上場':null].filter(Boolean).join('・'));
 return '<article class="basketball-player-card"><header>'+portrait(s,p)+'<div><strong>'+playerLabel(s,p,x,club)+'</strong><small>'+ident+'</small></div></header><div class="basketball-player-numbers">'+[['pts','得分'],['reb','籃板'],['ast','助攻'],['minutes','上場時間']].map(([k,l])=>'<div><span>'+l+'</span><b>'+stat(x,k)+'</b></div>').join('')+'</div><details data-persist="box:'+e([g.date,club,x.playerId||x.id||x.name].join('/'))+'"><summary>展開資料 ﹀</summary><dl>'+fields.map(([k,l])=>'<div><dt>'+l+'</dt><dd>'+stat(x,k)+'</dd></div>').join('')+'</dl></details></article>';
}
function box(s,g,d,pre){
 const club=g[s.boxSide],entries=d.players?.[s.boxSide]||[];
 return '<section class="basketball-boxscore" id="boxscore"><h3>球員數據 <small>BOX SCORE</small></h3><div class="nba-filters" role="group" aria-label="選擇球隊">'+['away','home'].map(k=>'<button data-boxside="'+k+'" aria-pressed="'+(s.boxSide===k)+'">'+logo(teamFor(s,g[k]))+e(name(s,g[k]))+'</button>').join('')+'</div>'+(entries.length?entries.map(x=>playerCard(s,g,club,x)).join(''):'<p class="basketball-empty">'+(pre?'開賽後顯示球員本場成績':s.detailBusy?'正在讀取本場球員成績…':'來源尚未提供本場球員成績')+'</p>')+'<a class="xz-roster-link" href="?'+e(new URLSearchParams({league:s.league,view:'teams',team:club,section:'roster'}))+'" data-roster="'+e(club)+'">查看'+e(name(s,club))+'球員名單 →</a></section>';
}
function eventRows(s,g,d,pre){
 const all=d.plays||[],periods=[...new Set(all.map(x=>x.period).filter(Boolean))].sort((a,b)=>(/OT/i.test(a)?10:0)+parseInt(String(a).replace(/\D/g,''))-( (/OT/i.test(b)?10:0)+parseInt(String(b).replace(/\D/g,''))));
 const rows=all.filter(x=>s.playPeriod==='all'||String(x.period)===s.playPeriod);
 return '<section class="basketball-playbyplay"><h3>逐球紀錄 <small>PLAY BY PLAY</small></h3><div class="nba-filters" role="group" aria-label="逐球節次">'+[['all','全部'],...periods.map(n=>[n,periodName(n)])].map(([n,l])=>'<button data-period="'+e(n)+'" aria-pressed="'+(s.playPeriod===String(n))+'">'+e(l)+'</button>').join('')+'</div><p class="basketball-play-order">最新紀錄在上・'+rows.length+' 筆</p>'+
 (rows.length?rows.slice(0,s.playLimit).map(x=>{const club=x.team||x.teamCode,actor=x.actorType==='coach'?null:person(s,club,x),t=teamFor(s,club),scoring=x.points>0||x.scoring===true;
 return '<article class="basketball-play" data-scoring="'+scoring+'"><header><span>'+logo(t)+'<b>'+e(t?.name||'比賽紀錄')+'</b></span><time>'+e(periodName(x.period)+' '+(x.clock||''))+'</time></header><div>'+(actor?'<div class="basketball-play-player">'+portrait(s,actor)+'<strong>'+playerLabel(s,actor,x,club)+'</strong></div>':'')+'<p>'+e(x.text)+'</p><small>'+num(x.awayScore)+' : '+num(x.homeScore)+(scoring?'・得分':'')+'</small></div></article>';}).join(''):'<p class="basketball-empty">'+(pre?'開賽後顯示逐球紀錄':s.detailBusy?'正在讀取逐球紀錄…':'來源尚未提供本場逐球紀錄')+'</p>')+(rows.length>s.playLimit?'<button class="basketball-load-more" data-moreplays>再看 60 筆</button>':'')+'</section>';
}
export function liveCenter(s){
 if(!s.game)return noGames(s);
 const board=s.game,d=s.detail?.home===board.home&&s.detail?.away===board.away&&s.detail?.date===board.date?s.detail:{};
 const aligned=['home','away'].every(k=>Number.isFinite(d[k+'Score'])&&d[k+'Score']>=(board[k+'Score']??0));
 const g=aligned?{...board,...d,venue:d.venue||board.venue}:board, pre=['fixture','scheduled'].includes(g.status);
 const ps=aligned&&d.periods?.length?d.periods:g.periods||[];
 return '<div class="basketball-live-center">'+strip(s)+'<section class="basketball-detail" id="scoreboard" aria-label="比賽詳細資料"><div class="basketball-scoreboard"><h2>比分看板 <small>SCOREBOARD</small></h2><div class="basketball-score-meta"><span>'+gameLabel(s,g)+'</span><span>'+gameTime(g)+'（台灣）</span><button data-detailrefresh aria-label="更新比賽明細">⟳</button></div>'+matchup(s,g)+quarters(s,g,ps)+(g.venue?'<p class="basketball-venue">'+e(g.venue)+'</p>':'')+'</div>'+compare(s,g,d)+'<div class="basketball-live-columns">'+box(s,g,d,pre)+eventRows(s,g,d,pre)+'</div><p class="xz-data-source">'+link(g.url,'官方比賽紀錄')+'</p></section></div>';
}
