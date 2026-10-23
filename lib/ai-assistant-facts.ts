import {validProbabilities,type AiMatch,type AiSnapshot,type AiSuggestion,type AiEvidence} from './ai-assistant';
const pct=(n:number)=>(100*n).toFixed(1)+'%';
const num=(n:number)=>Number(n.toFixed(2)).toString();
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
type Side='home'|'away';
type Metric={label:string;lower:boolean;good:string;bad:string;format?:(n:number)=>string;max?:number};
// Shared presentation: named team, both measured values, then the meaning of
// that comparison. A difference hidden by display rounding is never a risk.
function comparison(match:AiMatch,side:Side,home:unknown,away:unknown,metric:Metric){
 if(!finite(home)||!finite(away)||home<0||away<0||(metric.max!==undefined&&(home>metric.max||away>metric.max)))return null;
 const other=side==='home'?'away':'home',own=side==='home'?home:away,opp=side==='home'?away:home,format=metric.format||num;
 const equal=format(own)===format(opp),better=!equal&&(metric.lower?own<opp:own>opp);
 return {adverse:!equal&&!better,text:`${match[side]}的${metric.label}${equal?'相近':better?'較有利':'較不利'}：${format(own)}，${match[other]}為 ${format(opp)}。${equal?'以目前顯示精度，這項數據沒有明顯差距。':better?metric.good:metric.bad}`};
}
function baseballMetric(name:string):Metric|null{
 if(name==='本季戰績')return {label:'本季戰績（修正勝率）',lower:false,format:pct,max:1,good:'經樣本修正後的戰績比較值較高，這項表現較有利。',bad:'經樣本修正後的戰績比較值較低，這項表現較弱。'};
 if(['先發 ERA','先發本季 ERA','先發投手本季防禦率 ERA'].includes(name))return {label:'先發本季 ERA',lower:true,good:'這組本季紀錄中，先發投手平均每九局的責失分較少。',bad:'這組本季紀錄中，先發投手平均每九局的責失分較多。'};
 if(['先發本季 WHIP','先發投手本季每局被上壘率 WHIP'].includes(name))return {label:'先發本季 WHIP',lower:true,good:'先發投手平均每局被安打與保送的合計較少，控制上壘較有利。',bad:'先發投手平均每局被安打與保送的合計較多，讓對手上壘的情況較多。'};
 if(['先發近期 ERA','先發投手近期防禦率 ERA'].includes(name))return {label:'先發近期 ERA',lower:true,good:'近期登板紀錄中，先發投手平均每九局的責失分較少。',bad:'近期登板紀錄中，先發投手平均每九局的責失分較多。'};
 if(name==='九棒對左右投 wRC+')return {label:'九棒對左右投打擊指數 wRC+',lower:false,good:'已確認九棒對這類投手的打擊指數較高，這項打線比較較有利。',bad:'已確認九棒對這類投手的打擊指數較低，這項打線比較較弱。'};
 if(name==='牛棚近三日用球數')return {label:name,lower:true,good:'牛棚近三日的用球量較少，模型在使用負荷這一項給較高評價。',bad:'牛棚近三日的用球量較多，模型在使用負荷這一項給較低評價；這不是實際疲勞程度的量測。'};
 if(name==='牛棚連日登板人數')return {label:name,lower:true,good:'連續兩天登板的投手較少，這項牛棚使用負荷較低。',bad:'連續兩天登板的投手較多，這項牛棚使用負荷較高。'};
 return null;
}
export function buildAiFacts(match:AiMatch,analysis:any,suggestion:AiSuggestion|null,kind:'baseball'|'basketball'|'football'):AiSnapshot|null {
 const p=analysis.probabilities;
 if(!validProbabilities(p)||!Number.isFinite(Date.parse(analysis.capturedAt)))return null;
 const facts:AiEvidence[]=[];
 const add=(id:string,topic:AiEvidence['topic'],text:string)=>facts.push({id,topic,text});
 const choices=[{name:match.home,p:p.home},{name:match.away,p:p.away},...(p.draw===undefined?[]:[{name:'和局',p:p.draw}])].sort((a,b)=>b.p-a.p);
 const favored:'home'|'away'|null=Math.abs(choices[0].p-choices[1].p)<.00001?null:choices[0].name===match.home?'home':choices[0].name===match.away?'away':null;
 const opponent=favored==='home'?'away':'home',focus=favored||'home';
 add('result','analysis',`${match.away} 對 ${match.home}：${Math.abs(choices[0].p-choices[1].p)<.00001?'目前沒有單一明確傾向':`模型較偏向${choices[0].name}`}。\n主隊 ${match.home} ${pct(p.home)}／客隊 ${match.away} ${pct(p.away)}${p.draw===undefined?'':`／和局 ${pct(p.draw)}`}。`);
 // Outcome probabilities are not adverse factors. Without a concrete disadvantage,
 // the risk answer must use the user's exact insufficient-data response.
 if(analysis.retained)add('retained','analysis','以上解釋使用本場保存的賽前分析，沒有用開賽後的比分回填預測。');
 if(finite(analysis.expected?.home)&&finite(analysis.expected?.away))add('expected','analysis',`模型預期${match.home} ${num(analysis.expected.home)}、${match.away} ${num(analysis.expected.away)}${kind==='football'?'球':'分'}。這是計算期望值。`);
 if(kind==='baseball'){
  const factors=(analysis.factors||[]).filter((f:any)=>finite(f.home)&&finite(f.away)&&finite(f.score)&&finite(f.contribution)&&finite(f.weight)&&f.weight>0).sort((a:any,b:any)=>Math.abs(b.contribution)-Math.abs(a.contribution));
  factors.forEach((f:any,i:number)=>{
   const metric=baseballMetric(f.name),plain=metric?comparison(match,focus,f.home,f.away,metric):null;
   add('factor-'+i,'analysis',plain?.text||`${f.name}：${match.home} ${num(f.home)}，${match.away} ${num(f.away)}。`);
   add('factor-detail-'+i,'data',`${f.name}的設定權重為 ${num(f.weight)}%。${f.contribution===0?'此項沒有改變雙方估值的差距。':`此項使${match.home}的多因子估值${f.contribution>0?'增加':'減少'} ${num(Math.abs(f.contribution))} 個百分點。`}`);
   if(favored&&plain?.adverse&&((favored==='home'&&f.contribution<0)||(favored==='away'&&f.contribution>0)))add('against-'+i,'risk',plain.text);
  });
  if(!factors.length&&analysis.inputs?.home&&analysis.inputs?.away){
   const metrics:Record<string,Metric>={offense:{label:'得分能力（修正值）',lower:false,good:'本場採用的得分能力較高，進攻這一項較有利。',bad:'本場採用的得分能力較低，進攻這一項較弱。'},defense:{label:'失分能力（修正值）',lower:true,good:'本場採用的失分數值較低，防守這一項較有利。',bad:'本場採用的失分數值較高，防守這一項較弱。'},starterEra:{label:'先發 ERA（修正值）',lower:true,good:'經樣本修正後，先發投手每九局責失分的計算值較低。',bad:'經樣本修正後，先發投手每九局責失分的計算值較高。'}};
   for(const [key,metric] of Object.entries(metrics)){const plain=comparison(match,focus,analysis.inputs.home[key],analysis.inputs.away[key],metric);if(!plain)continue;add('runs-'+key,'analysis',plain.text);if(favored&&plain.adverse)add('runs-risk-'+key,'risk',plain.text);}
  }
 } else {
  for(const side of ['home','away'] as const){
   const f=analysis[side+'Form'],scored=kind==='basketball'?f?.pointsFor:f?.scored,conceded=kind==='basketball'?f?.pointsAgainst:f?.conceded;
   if(f&&[f.games,scored,conceded].every(finite))add('form-'+side,'data',`${match[side]}的分析樣本 ${f.games} 場，模型使用的場均${kind==='basketball'?'得分':'進球'} ${num(scored)}、${kind==='basketball'?'失分':'失球'} ${num(conceded)}。`);
  }
  if(kind==='football'){
   add('method','analysis','星準依本場啟用的攻防模型計算雙方預期進球，再換算主勝、和局與客勝機率；範圍為正規 90 分鐘含補時。');
   if(analysis.homeForm?.games>0&&analysis.awayForm?.games>0){
    const metrics:[string,string,Metric][]=[['scored','attack',{label:'場均進球',lower:false,good:'這組分析採用的進球數據較高，進攻表現較有利。',bad:'這組分析採用的進球數據較低，進攻表現較弱。'}],['conceded','defense',{label:'場均失球',lower:true,good:'這組分析採用的失球數據較低，防守表現較有利。',bad:'這組分析採用的失球數據較高，防守表現較弱。'}]];
    for(const [key,id,metric] of metrics){const plain=comparison(match,focus,analysis.homeForm[key],analysis.awayForm[key],metric);if(!plain)continue;add('football-'+id,'analysis',plain.text);if(favored&&plain.adverse)add('football-'+id+'-risk','risk',plain.text);}
   }
  }
  if(kind==='basketball'){
   const metrics:Record<string,Metric>={ortg:{label:'進攻效率',lower:false,good:'每百回合得分較多，進攻效率較有利。',bad:'每百回合得分較少，進攻效率較弱。'},drtg:{label:'防守效率',lower:true,good:'每百回合失分較少，防守表現較有利。',bad:'每百回合失分較多，防守表現較弱。'},threePct:{label:'三分命中率',lower:false,format:pct,max:1,good:'外線命中率較高，這項投籃表現較有利。',bad:'外線命中率較低。'},ftRate:{label:'罰球出手率',lower:false,format:pct,good:'相對投籃出手，取得罰球的比例較高。',bad:'相對投籃出手，取得罰球的比例較低。'}};
   for(const [key,metric] of Object.entries(metrics)){
    const h=analysis.inputs?.home?.[key],a=analysis.inputs?.away?.[key];
    const plain=comparison(match,focus,h,a,metric);if(!plain)continue;
    add('efficiency-'+key,'analysis',plain.text);
    if(favored&&plain.adverse)add('efficiency-risk-'+key,'risk',plain.text);
   }
   const hp=analysis.inputs?.home?.pace,ap=analysis.inputs?.away?.pace;
   if(finite(hp)&&finite(ap))add('efficiency-pace','analysis',`比賽節奏：${match.home} ${num(hp)}，${match.away} ${num(ap)}。這項用來估計比賽回合數，節奏快慢本身不代表哪一隊較強。`);
   const c=analysis.playerContext;
   if(c?.status==='applied'){
    const labels=['主場項','預估輪替球員強度','球隊淨效率','對手強度','休息時間'];
    if(Array.isArray(c.features)&&Array.isArray(c.coefficients))c.features.slice(0,5).forEach((x:number,i:number)=>{if(!finite(x)||!finite(c.coefficients[i]))return;const contribution=x*c.coefficients[i];add('player-factor-'+i,'analysis',`${labels[i]}在本場球員模型中，對主隊預期分差的貢獻為 ${contribution>=0?'+':''}${num(contribution)} 分。`);if(favored&&((favored==='home'&&contribution<0)||(favored==='away'&&contribution>0)))add('player-risk-'+i,'risk',`${labels[i]}對模型較看好的${match[favored]}不利，使該隊的預期分差減少 ${num(Math.abs(contribution))} 分。`);});
    const statuses:Record<string,string>={out:'缺陣',doubtful:'出賽機率偏低',questionable:'出賽存疑',probable:'可能出賽',expected:'預期出賽'};
    for(const side of ['home','away'] as const)for(const player of (c[side]||[]).slice(0,20)){
     if(!statuses[player.status]||!Number.isFinite(Date.parse(player.publishedAt)))continue;
     const text=`${match[side]} ${player.name}：來源標示${statuses[player.status]}（${new Date(player.publishedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}）。`;
     add(`player-${side}-${player.id}`,'analysis',text);
     if(side===favored&&['out','doubtful','questionable'].includes(player.status))add(`player-status-risk-${side}-${player.id}`,'risk',text);
    }
   }
  }
 }
 if(suggestion?.teams?.length){
  for(const [i,team] of suggestion.teams.entries())add('weights-team-'+i,'weights',`${team.teamName}建議權重：\n${team.weights.map(w=>`${w.name} ${num(w.value)}%`).join('、')}。\n${team.reason}`);
  add('weights-reason','weights','兩隊分別保存設定；對戰時取雙方權重的平均值運算。這是依各隊表現與可用數據調整的試算配置，尚未經各隊獨立回測。');
 }else if(suggestion){
  add('weights','weights',`目前建議使用「${suggestion.label}」。\n${suggestion.weights.map(w=>`${w.name} ${num(w.value)}%`).join('、')}。`);
 }

 return {match,capturedAt:analysis.capturedAt,model:analysis.model||analysis.version||'',evidence:facts,suggestion};
}
