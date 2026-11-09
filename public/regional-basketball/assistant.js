import {e,name,stamp,results,record,smallDate,timeTW,tabBtn} from './shared.js';
import {reportFor,injuries} from './analysis-ui.js';
export function assistantPanel(s,mode='why',id=''){
 const sorted=s.all.filter(g=>stamp(g)>=Date.now()&&['scheduled','fixture'].includes(g.status)).sort((a,b)=>stamp(a)-stamp(b));
 const g=s.all.find(g=>id&&(g.id===id||[g.date,g.home,g.away].join('/')===id))||sorted.find(g=>g.date===s.date)||sorted[0]||s.game;
 const choice=g?[g.date,g.home,g.away].join('/'):'';
 const prefix='<div class="dialog-inner"><button class="close" aria-label="關閉">×</button><span class="dtag">'+s.league+'</span><h2>AI星準助手</h2><p class="dsub">依站內模型與已核實賽事資料解讀</p>';
 if(!g)return prefix+'<p>因分析資料不足無法分析</p></div>';
 const r=reportFor(s,g),next=sorted.find(v=>stamp(v)>stamp(g));
 let answer='';
 if(mode==='why'){
   if(!r.ready)answer='因分析資料不足無法分析';
   else {const pick=r.homeProb>r.awayProb?g.home:g.away;answer=(r.replay?'依比賽日前資料回算，':'模型估計')+name(s,pick)+'勝率 '+(Math.max(r.homeProb,r.awayProb)*100).toFixed(1)+'%。'+
   '主隊近 '+r.homeMetrics.games+' 場每百回合得 '+r.homeMetrics.ortg.toFixed(1)+' 分、失 '+r.homeMetrics.drtg.toFixed(1)+' 分；客隊近 '+r.awayMetrics.games+' 場每百回合得 '+r.awayMetrics.ortg.toFixed(1)+' 分、失 '+r.awayMetrics.drtg.toFixed(1)+' 分。'+(r.opponentAdjusted?'已將近期對手強度納入比較。':'');}
 } else if(mode==='risk'){
  const rows=injuries(s,g);answer=rows.length?rows.map(i=>name(s,i.team)+' '+i.player+'（'+(i.status==='confirmed_out'?'確認缺陣':i.status==='fitness_test'?'賽前測試':'列入報告')+'）').join('、')+'。':'因分析資料不足無法分析';
 } else if(mode==='ratio'){
  answer=r.ready?'依序為進攻效率、防守效率、三分、罰球出手率與節奏。主隊使用 '+r.homeWeights.map(x=>(x*100).toFixed(0)+'%').join('／')+'，客隊使用 '+r.awayWeights.map(x=>(x*100).toFixed(0)+'%').join('／')+'。可在「模型比例」個別套用球隊設定。':'因分析資料不足無法分析';
 }
 return prefix+'<h3>'+e(name(s,g.away)+' vs '+name(s,g.home))+'</h3><p class="dsub">'+smallDate(g.date)+'　'+e(g.time)+' 台灣時間</p><div class="switches">'+[['why','為什麼這樣分析'],['risk','傷停因素'],['ratio','球隊權重']].map(([v,l])=>'<button class="date-btn" data-ask="'+v+'" data-fixture="'+e(choice)+'" aria-pressed="'+(mode===v)+'">'+l+'</button>').join('')+'</div><p class="answer">'+e(answer)+'</p>'+(next?'<button class="official" data-ask="why" data-fixture="'+e([next.date,next.home,next.away].join('/'))+'">找下一場賽事 →</button>':'')+'</div>';
}
