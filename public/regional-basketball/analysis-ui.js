import {marketCards, quotesFor} from './market-cards.js';
import {analyzeGame,WEIGHT_LABELS} from './model.mjs';
import {e,num,link,logo,teamFor,name,teamButton,results,record,recentRun,key,stamp,smallDate,timeTW,readStore,writeStore,empty,panelHeading,tabBtn} from './shared.js';
import {noGames} from './live-ui.js';
import {matchup,quarters,form,gameLabel,gameTime} from './match.js';
const defaults=[20,20,20,20,20];
const valid=a=>Array.isArray(a)&&a.length===5&&a.every(v=>typeof v==='number'&&v>=0&&v<=100)&&a.some(v=>v>0);
export function weights(s,code){const w=readStore('xz:ratio:'+s.league,{});return valid(w[code])?w[code]:valid(w.league)?w.league:defaults;}
export function storeWeights(s,target,values,clear=false){if(!clear&&!valid(values))return false;const k='xz:ratio:'+s.league,all=readStore(k,{});if(clear)delete all[target];else all[target]=values;return writeStore(k,all);}
export function weightsForm(s,target='league'){
 const w=weights(s,target),sum=w.reduce((a,b)=>a+b,0),options=[['league','聯盟預設'],...s.info.teams.map(t=>[t.code,t.name])];
 return '<div class="dialog-inner weight-editor"><button class="close" aria-label="關閉">×</button><span class="dtag">'+s.league+'</span><h2>模型比例</h2><p class="dsub">可設定整個聯盟，或替單一球隊設定比例。套用後會重算賽前分析。</p><label>套用範圍　<select id="weight-target">'+options.map(([v,l])=>'<option value="'+v+'" '+(v===target?'selected':'')+'>'+e(l)+'</option>').join('')+'</select></label><div class="sliders">'+WEIGHT_LABELS.map((l,i)=>'<label>'+l+'<output>'+num(w[i]/sum*100,1)+'%</output><input aria-label="'+l+'" data-weight="'+i+'" type="range" min="0" max="100" value="'+w[i]+'"></label>').join('')+'</div><p class="dsub" id="weight-note">依總和換算為 100%，設定儲存在此瀏覽器。</p><button class="date-btn" data-resetweights>'+(target==='league'?'還原預設':'沿用聯盟設定')+'</button> <button class="official" data-applyweights>套用比例</button></div>';
}
export function injuries(s,g){
 const rows=s.context.injuries.filter(i=>i.league===s.league&&[g.home,g.away].includes(i.team)&&(Array.isArray(i.appliesToDates)?i.appliesToDates.includes(g.date):i.reportedAt&&Math.abs(stamp(g)-Date.parse(i.reportedAt))<7*86400000&&Date.parse(i.reportedAt)<=stamp(g)));
 const seen=new Set();return rows.filter(i=>{const k=i.team+':'+i.player.toLowerCase();if(seen.has(k))return false;seen.add(k);return true;});
}
function ticketKey(s,g){return 'xz:pregame:v2:'+s.league+':'+key(g)}
export function reportFor(s,g){
 const hw=weights(s,g.home),aw=weights(s,g.away),sig=hw.join(',')+'|'+aw.join(','),k=ticketKey(s,g);
 const saved=s.saved[k]||readStore(k,null)||s.frozen?.[key(g)];
 if((g.status!=='scheduled'&&g.status!=='fixture')||stamp(g)<=Date.now())return saved?.ready&&Date.parse(saved.asOf)<stamp(g)?{...saved,frozen:true}:{ready:false,reason:'此場開賽前未收錄模型預測。'};
 const memo=s.projections.get(k);if(memo&&memo.sig===sig&&memo.rev===s.version&&Date.now()-memo.time<30000)return memo.value;
 const model=analyzeGame({game:{...g,league:s.league},games:s.all,gamesAsOf:s.asOf,boxes:s.boxes,homeWeights:hw,awayWeights:aw,injuries:injuries(s,g),rosters:s.rosters,asOf:Date.now()});
 if(model.ready){const frozen={...model,weightSignature:sig};s.saved[k]=frozen;writeStore(k,frozen);}
 s.projections.set(k,{sig,rev:s.version,time:Date.now(),value:model});
 return model;
}
function integerScore(r){
 if(r.homeProb===r.awayProb)return null;
 let h=Math.round(r.homeScore),a=Math.round(r.awayScore),home=r.homeProb>r.awayProb;
 if(home?h<=a:a<=h){const opts=home?[[a+1,a],[h,Math.max(0,h-1)]]:[[h,h+1],[Math.max(0,a-1),a]];opts.sort((x,y)=>(x[0]-r.homeScore)**2+(x[1]-r.awayScore)**2-(y[0]-r.homeScore)**2-(y[1]-r.awayScore)**2);[h,a]=opts[0];}
 return {home:h,away:a};
}
function marketFor(s,g){
 const tip=stamp(g),now=Date.now();
 const matches=m=>m?.league===s.league&&m.date===g.date&&m.home===g.home&&m.away===g.away&&
   (!m.startsAt||Math.abs(Date.parse(m.startsAt)-tip)<=600000);
 const all=s.context.markets.filter(matches);
 const live=all.filter(m=>m.kind==='public_pregame'&&m.startsAt&&Date.parse(m.checkedAt)<tip&&
   now>=Date.parse(m.checkedAt)&&now-Date.parse(m.checkedAt)<=150000&&now<tip);
 const k='xz:market:'+s.league+':'+key(g);
 if(live.length===1){
   if(s.saved[k]?.checkedAt!==live[0].checkedAt){s.saved[k]=live[0];writeStore(k,live[0]);}
   return live[0];
 }
 const archived=all.filter(m=>m.kind==='archived_pregame');
 if(now>=tip){
   const saved=s.saved[k]||readStore(k,null);
   if(matches(saved)&&saved.startsAt&&Date.parse(saved.checkedAt)<tip)archived.push({...saved,kind:'archived_pregame'});
 }
 const quoteTime=m=>Date.parse(m.quotedAt||m.checkedAt);
 return archived.sort((a,b)=>quoteTime(b)-quoteTime(a))[0]||null;
}
function numbers(r){
 if(!r.ready)return '<div class="nba-analysis-heading"><span>賽前預測</span></div><p class="basketball-empty">'+e(r.reason||'因分析資料不足無法分析')+'</p>';
 const sc=integerScore(r),h=Math.round(r.homeProb*1000)/10,a=100-h;
 return '<small class="nba-updated">分析更新 '+e(timeTW(r.asOf))+'</small><div class="nba-analysis-numbers"><div class="nba-analysis-heading"><span>賽前預測</span><small>'+(r.frozen?'賽前存檔':'效率模擬')+'</small></div><div class="nba-forecast-score"><span>預估比分<small>客：主</small></span><b>'+(sc?sc.away:'—')+'<i>:</i>'+(sc?sc.home:'—')+'</b></div><div class="nba-probabilities"><div><span>客勝</span><strong>'+num(a,1)+'%</strong></div><div><span>主勝</span><strong>'+num(h,1)+'%</strong></div></div><div class="nba-probability-bar"><i style="width:'+a+'%"></i><i style="width:'+h+'%"></i></div><div class="nba-estimates"><div><span>預估總分</span><b>'+(sc?sc.home+sc.away:num(r.total))+'</b></div><div><span>預估分差</span><b>'+(sc?(sc.home>sc.away?'主':'客')+' +'+Math.abs(sc.home-sc.away):'勝負未定')+'</b></div></div></div>';
}
function breakdown(s,g,r){
 const m=marketFor(s,g),quotes=quotesFor(m),inj=injuries(s,g),id=e(key(g));
 const table=(head,body)=>'<div class="nba-table-scroll"><table><thead><tr>'+head.map(h=>'<th>'+e(h)+'</th>').join('')+'</tr></thead><tbody>'+body.map(row=>'<tr>'+row.map(x=>'<td>'+e(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 const model=r.ready?'<h4>模型依據</h4><p>40 分鐘制・10,000 次模擬。預估主隊分差的第 10 至 90 百分位為 '+num(r.marginP10,1)+' 至 '+num(r.marginP90,1)+'。</p>'+table(['因子',name(s,g.away),name(s,g.home)],[...WEIGHT_LABELS.map((l,i)=>[l,num(r.awayWeights[i]*100,1)+'%',num(r.homeWeights[i]*100,1)+'%']),['對手平均淨分',num(r.awayOpponentNet,1),num(r.homeOpponentNet,1)],['技術統計場數',r.awayMetrics.games,r.homeMetrics.games]])+(g.status==='final'&&r.homeProb!==r.awayProb&&g.homeScore!==g.awayScore?'<p>'+((r.homeProb>r.awayProb)===(g.homeScore>g.awayScore)?'勝方命中':'勝方未命中')+'</p>':''):'';
 const prices=marketCards(s,g,r,m,quotes);
 const flags={confirmed_out:'確認缺陣',fitness_test:'賽前測試',listed:'列入傷停報告',questionable:'出賽存疑'};
 const injuriesText=inj.length?'<ul>'+inj.map(x=>'<li>'+e(name(s,x.team)+'・'+x.player+'・'+(flags[x.status]||'待確認')+' '+(x.reason||''))+' '+link(x.url,'來源')+'</li>').join('')+'</ul>':'<p>此場尚無已核實的傷停名單。</p>';
 const impact=r.ready&&r.injuryAdjustmentApplied?'<p>缺陣與替補調整　客隊 '+num(r.awayInjuryPoints,1)+' 分，主隊 '+num(r.homeInjuryPoints,1)+' 分。</p>':'';
 return '<details class="match-market-details sport-market-details" data-persist="market:'+id+'"><summary><strong>查看分析</strong><span>'+(quotes.length?quotes.length+' 種玩法':'盤口待確認')+'</span></summary>'+prices+'<div class="xz-market-body">'+model+'<h4>傷停與出賽狀態</h4>'+injuriesText+impact+'<button class="official" data-open-game="'+e(g.id||g.home)+'">查看本場比分與球員數據 →</button></div></details>';
}
export function analysis(s){
 if(!s.visible.length)return noGames(s);
 return '<section id="game-cards" class="nba-games" data-view="analysis" aria-label="逐場賽前分析">'+s.visible.map(g=>{
  const r=reportFor(s,g),live=g.status==='in_progress'&&s.isLive;
  return '<article class="nba-card" data-state="'+(live?'live':e(g.status))+'"><header><div class="nba-card-labels"><span class="nba-phase-tag">'+e(({1:'熱身賽',2:'例行賽',3:'季後賽',4:'盃賽'})[g.phase??2]||'聯盟賽事')+'</span><span class="'+(live?'nba-live':'nba-game-status')+'"><i></i>'+gameLabel(s,g)+'</span></div><time>'+gameTime(g)+'</time></header><div class="nba-card-layout" data-analysis="true"><div class="nba-match-overview">'+matchup(s,g)+quarters(s,g)+form(s,g)+'</div><div class="nba-card-analysis">'+numbers(r)+breakdown(s,g,r)+'</div></div></article>';
 }).join('')+'</section>';
}

export function singleGameRecommendations(s){
 const rows=[];
 for(const g of s.games){
  if(g.status!=='scheduled'||stamp(g)<=Date.now()||marketFor(s,g)?.kind!=='public_pregame')continue;
  const report=reportFor(s,g);
  if(!report.ready||report.homeProb===report.awayProb)continue;
  const team=report.homeProb>report.awayProb?g.home:g.away;
  rows.push({label:name(s,team)+' 獨贏（'+name(s,g.away)+' vs '+name(s,g.home)+'）'});
 }
 return rows;
}
