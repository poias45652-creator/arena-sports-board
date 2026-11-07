import {e,num,pct,teamFor,name,logo,tabBtn} from './shared.js';
const positions={G:'後衛',F:'前鋒',C:'中鋒',PG:'控球後衛',SG:'得分後衛',SF:'小前鋒',PF:'大前鋒',FC:'前鋒／中鋒',GF:'後衛／前鋒',GC:'後衛／中鋒',FG:'前鋒／後衛',CF:'中鋒／前鋒'};
const position=p=>positions[p.position]||p.position||'位置未公布';
const countries={'Republic of Korea':'韓國','South Korea':'韓國','United States of America':'美國','United States':'美國',Australia:'澳洲','New Zealand':'紐西蘭',Philippines:'菲律賓',AUS:'澳洲',NZL:'紐西蘭',USA:'美國',KOR:'韓國',PHI:'菲律賓',CAN:'加拿大',FRA:'法國',GBR:'英國',JPN:'日本',SUD:'蘇丹',SSD:'南蘇丹'};
const columns=[['gp','出賽'],['min','場均分鐘'],['pts','場均得分'],['reb','場均籃板'],['ast','場均助攻'],['stl','場均抄截'],['blk','場均阻攻'],['tov','場均失誤'],['fgPct','投籃命中率'],['threePct','三分命中率'],['ftPct','罰球命中率']];
const overviewCols=[columns[2],columns[3],columns[4],columns[1],columns[8],columns[0]];
const currentScope=s=>({season:s.activeRosterSeason||s.info.season,league:s.league,phase:'例行賽'});
const leagueTitle=l=>({'KBL D-League':'韓國發展聯盟','NBL':'NBL','KBL':'KBL'}[l]||l);
const scope=r=>[r.season,leagueTitle(r.league),r.phase].filter(Boolean).join(' · ');
const displayName=p=>p.zh||p.name||p.en||p.native;
const photo=(s,p)=>p.photo?.startsWith('https://')?p.photo:p.photo?'/regional-basketball/players/'+s.league.toLowerCase()+'/'+p.photo.split('/').at(-1):p.photoUrl||p.photoSource||'';
const stat=(r,k)=>k.endsWith('Pct')?pct(r?.[k]):num(r?.[k],k==='gp'?0:1);
const teamHref=(s,t)=>'?'+new URLSearchParams({league:s.league,view:'teams',team:t,section:'roster'});
function bioFields(p){
 return [
  ['原文姓名',p.native||p.en||p.name],['其他登錄姓名',Array.isArray(p.aliases)?p.aliases.join('、'):p.aliases],['英文姓名',p.native&&p.en?p.en:null],
  ['位置',position(p)],[p.numberLabel||(p.rosterStatus==='season_registration'?'本季登錄背號':'本季例行賽背號'),p.number??(p.numberNote?'未公布':null)],
  ...(p.numberHistory||[]).map(h=>[h.season+' '+h.phase+'背號',h.team+' #'+h.number]),
  ['生日',p.birthDate],[p.heightContext?'登錄身高':'身高',p.height?p.height+' 公分':null],
  [p.weightContext?'登錄體重':'體重',p.weight?p.weight+' 公斤':(p.bioReviewed?'尚無可核實紀錄':null)],
  ['國籍',countries[p.country]||p.country],['出生地',p.birthPlace],
  ['就讀學校',p.school||(p.bioReviewed?'尚無可核實紀錄':null),p.schoolContext],['高中',p.highSchool],['青訓單位',p.academy,p.academyType],
  ['加盟前所屬',p.previousTeam],['選秀年',p.draftYear],['本季登錄狀態',p.currentStatus||p.statusNote],['季前登錄日期',p.registrationDate]
 ].filter(([,v])=>v!=null&&v!=='');
}
function bioPanel(p){
 return bioFields(p).map(([label,value,note])=>'<div><dt>'+e(label)+'</dt><dd>'+e(value)+(note?'<small class="sp-bio-note">'+e(note)+'</small>':'')+'</dd></div>').join('');
}
export function rosterPlayer(s,raw){const a=s.peopleIndex?.[raw.id]||{};return {...raw,...Object.fromEntries(Object.entries(a).filter(([k,v])=>v!=null))};}
function mainRecord(s,p){return p.gp>0?{...p,...currentScope(s)}:p.supplement||null;}
function shortStatus(s,p){
 if(p.gp>0)return '';
 if(p.rosterStatus==='season_registration')return '本季曾登錄，未查到一隊例行賽出賽紀錄';
 if(p.dnpGameLog?.length)return '本季曾登錄，尚無上場紀錄';
 if(p.noAppearance||p.gp===0||p.statsStatus==='no_regular_season_record')return '本季一隊例行賽尚無出賽紀錄';
 return '本季一隊例行賽場均尚未公布';
}
export function tradingCard(s,raw,clickable=true,chosen=null){
 const p=rosterPlayer(s,raw),t=teamFor(s,s.teamCode),r=chosen||mainRecord(s,p);
 const src=photo(s,p),dname=displayName(p),href=teamHref(s,s.teamCode)+'&player='+encodeURIComponent(p.id);
 const leagues=r&&r.league!==s.league,caption=r?[r.season,leagues?leagueTitle(r.league):'',r.phase!=='例行賽'?r.phase:''].filter(Boolean).join(' · '):currentScope(s).season;
 const recordTeam=r?.team?teamLabel(s,r.team):t.name;
 const bio=[clickable&&p.zh?(p.native||p.name):null,countries[p.country]||p.country,p.height?p.height+' 公分':null,p.weight?p.weight+' 公斤'+(p.weightContext?'（登錄值）':''):null].filter(Boolean).join(' · ');
 const metrics=r&&r.gp>0&&[r.pts,r.reb,r.ast].some(x=>x!=null)?'<dl class="xz-card-stats">'+(clickable?overviewCols.slice(0,3):overviewCols).map(([k,l])=>'<div><dt>'+l+'</dt><dd>'+stat(r,k)+'</dd></div>').join('')+'</dl>':'<p class="xz-card-stats-note">'+e(r?.gp===0?'此範圍尚無出賽紀錄':shortStatus(s,p)||'此範圍無已公布場均')+'</p>';
 const attrs=clickable?'a href="'+e(href)+'" data-player="'+e(p.id)+'" data-club="'+e(s.teamCode)+'" aria-label="查看 '+e(dname)+' 球員資料"':'article';
 return '<'+attrs+' class="xz-player-card"><div class="xz-card-top"><div class="xz-card-number"><small>背號</small><strong>'+e(p.number??'—')+'</strong><span>'+e(position(p))+'</span></div><span class="xz-card-league">'+e(s.league)+'</span></div><span class="xz-card-photo">'+(src?'<img width="300" height="280" loading="lazy" decoding="async" src="'+e(src)+'" alt="'+e(dname)+' 球員照片">':'')+'</span><div class="xz-card-copy"><h3>'+e(dname)+'</h3><p class="xz-card-team">'+e(recordTeam+' · '+caption)+'</p>'+metrics+'<p class="xz-card-bio">'+e([!p.gp&&r&&r.gp?shortStatus(s,p):null,bio].filter(Boolean).join(' ｜ '))+'</p><div class="xz-card-footer"><span class="xz-card-badge">'+logo(t)+'</span><span>'+(clickable?'查看資料 ↗':'球員資料')+'</span></div></div></'+(clickable?'a':'article')+'>';
}
function table(headers,rows,label){return '<div class="sp-scroll" tabindex="0" role="region" aria-label="'+e(label)+'"><table><thead><tr>'+headers.map(x=>'<th>'+e(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map((v,i)=>i?'<td>'+v+'</td>':'<th>'+v+'</th>').join('')+'</tr>').join('')+'</tbody></table></div>';}
const select=(attribute,label,choices,value)=>'<label>'+e(label)+'<select data-'+attribute+' aria-label="'+e(label)+'">'+choices.map(([v,l])=>'<option value="'+e(v)+'" '+(v===value?'selected':'')+'>'+e(l)+'</option>').join('')+'</select></label>';
function teamLabel(s,value){
 if(!value)return '—';
 const alias=s.league==='KBL'?{SAMSUNG:'SAM','HYUNDAI MOBIS':'MOB',KOGAS:'KOG',SONO:'SON','JUNG KWAN JANG':'JJK','DAEGU KOREAGASCORPORATION PEGASUS':'KOG','GOYANG SONO SKY GUNNERS':'SON'}:{};
 const key=alias[value]||value;
 const match=s.info.teams.find(t=>t.code===key||t.en?.toUpperCase()===String(key).toUpperCase());
 return match?.name||value;
}
function gameLink(s,g){
 const entry=Object.values(s.detailIndex||{}).find(d=>d.date===g.date&&[d.home,d.away].includes(g.team)&&[d.home,d.away].includes(g.opp));
 if(!entry)return e(g.date);
 const q=new URLSearchParams({league:s.league,view:'live',date:g.date,game:entry.id});
 return '<a class="sp-reference" href="?'+e(q)+'#boxscore">'+e(g.date)+'</a>';
}
function logTable(s,rows){
 if(!rows.length)return '<p class="sp-empty">此賽事範圍尚無可核對的逐場紀錄。</p>';
 const pairs=[['fgm','fga','投籃'],['threeMade','threeAttempted','三分'],['ftm','fta','罰球']].filter(([m,a])=>rows.some(g=>g[m]!=null&&g[a]!=null));
 const extras=[['tov','失誤'],['oreb','進攻籃板'],['dreb','防守籃板'],['pf','犯規'],['plusMinus','正負值']].filter(([k])=>rows.some(g=>g[k]!=null));
 return table(['日期','對手','上場時間','得分','籃板','助攻','抄截','阻攻',...pairs.map(x=>x[2]),...extras.map(x=>x[1])],rows.map(g=>[gameLink(s,g)+(g.partialBoxscore?'<small class="sp-bio-note">部分數據</small>':''),e(teamLabel(s,g.opp||g.opponent)),e(g.minutes??'—'),...['pts','reb','ast','stl','blk'].map(k=>num(g[k])),...pairs.map(([m,a])=>g[m]!=null&&g[a]!=null?num(g[m])+' / '+num(g[a]):'—'),...extras.map(([k])=>num(g[k]))]),'逐場紀錄');
}
export function playerProfile(s){
 const raw=[...(s.rosters[s.teamCode]||[]),...(s.extras?.[s.teamCode]||[])].find(p=>String(p.id)===s.playerId);
 if(!raw)return '<div class="sp-inner"><a class="nba-back" href="'+e(teamHref(s,s.teamCode))+'">← 返回球員名單</a><p>'+(!s.rostersLoaded?'正在載入球員名單…':'此球員目前未列入本隊名單。')+'</p></div>';
 const p=rosterPlayer(s,raw),t=teamFor(s,s.teamCode),record=s.playerFiles?.[p.id],base=currentScope(s),own={...base,...Object.fromEntries(columns.map(([k])=>[k,p[k]])),gp:p.gp??(p.noAppearance?0:null)};
 const saved=record?.seasons||[],rows=[own,...saved.filter(r=>scope(r)!==scope(base)||r.split)];
 const initial=mainRecord(s,p)||own;
 const selectedYear=rows.some(r=>r.season===s.playerYear)?s.playerYear:initial.season;
 const years=[...new Set(rows.map(r=>r.season))].sort((a,b)=>Number(b.slice(0,4))-Number(a.slice(0,4)));
 const choices=rows.map((row,id)=>({row,id})).filter(x=>x.row.season===selectedYear);
 let option=choices.find(x=>String(x.id)===s.playerRecord)||choices.find(x=>scope(x.row)===scope(initial))||choices[0]||{row:initial,id:0};
 const r=option.row,isCurrent=scope(r)===scope(own)&&!r.split;
 const archivedCurrent=new Map((record?.games||[]).filter(g=>scope(g)===scope(own)).map(g=>[g.date+'|'+g.opp,g]));
 let logs=isCurrent?(p.gameLog||[]).map(g=>({...archivedCurrent.get(g.date+'|'+g.opp),...g})):(record?.games||[]).filter(g=>scope(g)===scope(r)&&(!r.sourceSeasonId||(r.sourceSeasonId===g.sourceSeasonId&&(!r.team||g.team===r.team)))&&(!r.split||g.team===r.team||r.logTeams?.includes(g.team)));
 logs=[...logs].sort((a,b)=>b.date.localeCompare(a.date));const mode=s.playerTab||'overview';
 const phaseTitle=r=>[leagueTitle(r.league),r.conference||'',r.phase].filter(Boolean).join(' · ');
 const phaseLabel=x=>{
  const repeated=choices.some(y=>y.id!==x.id&&phaseTitle(y.row)===phaseTitle(x.row));
  return [phaseTitle(x.row),(x.row.split||repeated)&&x.row.team?teamLabel(s,x.row.team):null].filter(Boolean).join(' · ');
 };
 const photoUrl=photo(s,p);
 const coverage=g=>r.gp>0?(' · '+g.length+' 筆可核對逐場／'+r.gp+' 場出賽'):'';
 const head='<div class="sp-page"><div class="sp-nav"><a href="?league='+s.league+'&view=teams" data-backteams>← 星準</a><a data-backroster href="'+e(teamHref(s,s.teamCode))+'">返回球隊</a></div><div class="sp-inner"><div class="sp-heading"><div class="sp-photo">'+(photoUrl?'<img src="'+e(photoUrl)+'" alt="'+e(displayName(p))+'">':'照片待補')+'</div><div class="sp-identity"><p>'+s.league+'／球員資料</p><h1>'+e(displayName(p))+'</h1><p>'+e([p.zh?(p.en||p.native||p.name):p.native,'#'+(p.number??'—'),position(p)].filter(Boolean).join(' · '))+'</p><a data-backroster href="'+e(teamHref(s,s.teamCode))+'">'+e(t.name)+'</a></div><button class="sp-refresh" data-refresh>⟳ 更新</button></div>'+
 '<section class="sp-filters">'+select('pyear','年度',years.map(y=>[y,y]),selectedYear)+select('precord','賽事類型',choices.map(x=>[String(x.id),phaseLabel(x)]),String(option.id))+'</section><nav class="sp-tabs" aria-label="球員數據分類">'+[['overview','概覽'],['history','歷年成績'],['games','逐場紀錄']].map(([v,l])=>tabBtn('data-playertab',v,l,v===mode)).join('')+'</nav>';
 const note=shortStatus(s,p);const label=scope(r);
 const caption=note&&(!isCurrent||!p.gp)?'<p class="scope-note">'+e(note.replace(/。$/,'')+'。'+(!isCurrent?'下列成績為 '+label+'。':''))+'</p>':'';
 const historyRows=rows.filter(v=>v.gp>0);
 let body;
 if(mode==='history')body='<section class="sp-panel"><h2>歷年成績</h2>'+caption+(historyRows.length?table(['球季','聯盟／賽事','當季球隊',...columns.map(([,l])=>l)],historyRows.map(v=>[e(v.season),e([leagueTitle(v.league),v.phase].join(' · ')),e(v.team?teamLabel(s,v.team):t.name),...columns.map(([k])=>stat(v,k))]),'歷年成績'):e(record?'此球員尚無已核實的逐季場均。':'正在讀取歷年紀錄…'))+'</section>';
 else if(mode==='games')body='<section class="sp-panel"><h2>逐場紀錄</h2>'+caption+'<p class="sp-caption">'+e(label+coverage(logs))+'</p>'+(r.gameCoverageNote?'<p class="scope-note">逐場紀錄與球季總計有差異，場均依球季總計顯示。</p>':'')+logTable(s,logs)+'</section>';
 else body='<div class="xz-profile-card">'+tradingCard(s,p,false,r)+'</div>'+(r.gp>0?'<section class="sp-metrics">'+overviewCols.filter(([k])=>r[k]!=null).map(([k,l])=>'<div><span>'+l+'</span><strong>'+stat(r,k)+'</strong><small>'+e(label)+'</small></div>').join('')+'</section>':'')+
 '<section class="sp-panel"><h2>個人資料</h2>'+caption+'<dl class="sp-bio">'+bioPanel(p)+'</dl></section><section class="sp-panel"><h2>近期出賽</h2><p class="sp-caption">'+e(label)+'</p>'+logTable(s,logs.slice(0,10))+'</section>';
 if(mode==='history'&&p.career?.gp>0)body+='<section class="sp-panel"><h2>'+e(s.league)+' 例行賽生涯場均</h2>'+table(columns.filter(([k])=>p.career[k]!=null).map(([,l])=>l),[columns.filter(([k])=>p.career[k]!=null).map(([k])=>stat(p.career,k))],'生涯場均')+'</section>';
 if(p.dnpGameLog?.length)body+='<section class="sp-panel"><h2>本季登錄未上場</h2>'+table(['日期','對手','賽事','狀態'],p.dnpGameLog.map(g=>[gameLink(s,g),e(teamLabel(s,g.opp)),e(g.phase), '未上場']),'登錄紀錄')+'</section>';
 const asOf=s.rosterTimestamps?.[s.teamCode]||s.playerAsOf;
 const updated=asOf?'<footer class="sp-caption">本季一隊資料截至 '+e(asOf.slice(0,10))+'</footer>':'';
 return head+body+updated+'</div></div>';
}
