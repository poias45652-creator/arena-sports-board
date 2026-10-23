import {validProbabilities,type AiMatch,type AiSnapshot,type AiSuggestion,type AiEvidence} from './ai-assistant';
const pct=(n:number)=>(100*n).toFixed(1)+'%';
const num=(n:number)=>Number(n.toFixed(2)).toString();
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function buildAiFacts(match:AiMatch,analysis:any,suggestion:AiSuggestion,kind:'baseball'|'basketball'|'football'):AiSnapshot|null {
 const p=analysis.probabilities;
 if(!validProbabilities(p)||!Number.isFinite(Date.parse(analysis.capturedAt)))return null;
 const facts:AiEvidence[]=[];
 const add=(id:string,topic:AiEvidence['topic'],text:string)=>facts.push({id,topic,text});
 const choices=[{name:match.home,p:p.home},{name:match.away,p:p.away},...(p.draw===undefined?[]:[{name:'和局',p:p.draw}])].sort((a,b)=>b.p-a.p);
 add('result','analysis',`${match.away} 對 ${match.home}：${Math.abs(choices[0].p-choices[1].p)<.00001?'目前沒有單一明確傾向':`模型較偏向${choices[0].name}`}。\n主隊 ${match.home} ${pct(p.home)}／客隊 ${match.away} ${pct(p.away)}${p.draw===undefined?'':`／和局 ${pct(p.draw)}`}。`);
 add('uncertainty','risk',`模型仍估計${choices[0].name}以外的結果合計為 ${pct(1-choices[0].p)}，目前的傾向不代表確定賽果。`);
 if(analysis.retained)add('retained','analysis','以上解釋使用本場保存的賽前分析，沒有用開賽後的比分回填預測。');
 if(finite(analysis.expected?.home)&&finite(analysis.expected?.away))add('expected','analysis',`模型預期${match.home} ${num(analysis.expected.home)}、${match.away} ${num(analysis.expected.away)}${kind==='football'?'球':'分'}。這是計算期望值。`);
 if(kind==='baseball'){
  const factors=(analysis.factors||[]).filter((f:any)=>finite(f.home)&&finite(f.away)&&finite(f.score)&&finite(f.contribution)&&f.weight>0).sort((a:any,b:any)=>Math.abs(b.contribution)-Math.abs(a.contribution));
  factors.forEach((f:any,i:number)=>{
   const text=`${f.name}：主隊 ${num(f.home)}、客隊 ${num(f.away)}，設定權重 ${num(f.weight)}%。${f.contribution===0?'此項對雙方沒有形成差距。':`此項使多因子主隊估值${f.contribution>0?'增加':'減少'} ${num(Math.abs(f.contribution))} 個百分點。`}`;
   add('factor-'+i,'analysis',text);
   if((p.home>p.away&&f.contribution<0)||(p.away>p.home&&f.contribution>0))add('against-'+i,'risk',text);
  });
  if(!factors.length&&analysis.inputs?.home&&analysis.inputs?.away){
   for(const side of ['home','away'] as const){const t=analysis.inputs[side];if([t.offense,t.defense,t.starterEra,t.bullpenEra].every(finite))add('runs-'+side,'analysis',`${match[side]}的逐局模型輸入：進攻 ${num(t.offense)}、失分 ${num(t.defense)}、先發 ${num(t.starterEra)}、牛棚 ${num(t.bullpenEra)}。這些是經樣本修正的計算值，依所選比例合成逐局得分。`);}
  }
 } else {
  for(const side of ['home','away'] as const){
   const f=analysis[side+'Form'],scored=kind==='basketball'?f?.pointsFor:f?.scored,conceded=kind==='basketball'?f?.pointsAgainst:f?.conceded;
   if(f&&[f.games,scored,conceded].every(finite))add('form-'+side,'analysis',`${match[side]}的分析樣本 ${f.games} 場，模型使用的場均${kind==='basketball'?'得分':'進球'} ${num(scored)}、${kind==='basketball'?'失分':'失球'} ${num(conceded)}。`);
  }
  if(kind==='football')add('method','analysis','星準依本場啟用的攻防模型計算雙方預期進球，再換算主勝、和局與客勝機率；範圍為正規 90 分鐘含補時。');
  if(kind==='basketball'){
   const labels=[['ortg','進攻效率'],['drtg','防守效率'],['threePct','三分命中率'],['ftRate','罰球出手率'],['pace','節奏']];
   for(const [key,label] of labels){const h=analysis.inputs?.home?.[key],a=analysis.inputs?.away?.[key];if(finite(h)&&finite(a))add('efficiency-'+key,'analysis',`${label}：${match.home} ${key==='threePct'||key==='ftRate'?pct(h):num(h)}，${match.away} ${key==='threePct'||key==='ftRate'?pct(a):num(a)}。${key==='drtg'?'防守效率數值較低代表每百回合失分較少。':key==='pace'?'節奏用於調整比賽回合與得分預估。':''}`);}
   const c=analysis.playerContext;
   if(c?.status==='applied'){
    const labels=['主場項','預估輪替球員強度','球隊淨效率','對手強度','休息時間'];
    if(Array.isArray(c.features)&&Array.isArray(c.coefficients))c.features.slice(0,5).forEach((x:number,i:number)=>{if(!finite(x)||!finite(c.coefficients[i]))return;const contribution=x*c.coefficients[i];add('player-factor-'+i,'analysis',`${labels[i]}在本場球員模型中，對主隊預期分差的貢獻為 ${contribution>=0?'+':''}${num(contribution)} 分。`);if((p.home>.5&&contribution<0)||(p.home<.5&&contribution>0))add('player-risk-'+i,'risk',`${labels[i]}對目前較看好的一方不利，對主隊預期分差的貢獻為 ${contribution>=0?'+':''}${num(contribution)} 分。`);});
    const statuses:Record<string,string>={out:'缺陣',doubtful:'出賽機率偏低',questionable:'出賽存疑',probable:'可能出賽',expected:'預期出賽'};
    for(const side of ['home','away'] as const)for(const player of (c[side]||[]).slice(0,20)){if(!statuses[player.status]||!player.publishedAt)continue;add(`player-${side}-${player.id}`,'risk',`${match[side]} ${player.name}：來源標示${statuses[player.status]}（${new Date(player.publishedAt).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'})}）。`);}
   }
  }
 }
 add('weights','weights',`目前建議使用「${suggestion.label}」。\n${suggestion.weights.map(w=>`${w.name} ${num(w.value)}%`).join('、')}。\n這是星準現行基準配置，並非宣稱所有場次的最佳比例。`);
 add('weights-reason','weights','建議先沿用基準配置，讓同聯賽的分析保持一致；修改權重會改變模型估值，不能只為了把某隊勝率調高而認定更準。');
 return {match,capturedAt:analysis.capturedAt,model:analysis.model||analysis.version||'',evidence:facts,suggestion};
}
