import {validProbabilities,type AiMatch,type AiSnapshot,type AiSuggestion,type AiEvidence} from './ai-assistant';
const pct=(n:number)=>(100*n).toFixed(1)+'%';
const num=(n:number)=>Number(n.toFixed(2)).toString();
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
export function buildAiFacts(match:AiMatch,analysis:any,suggestion:AiSuggestion|null,kind:'baseball'|'basketball'|'football'):AiSnapshot|null {
 const p=analysis.probabilities;
 if(!validProbabilities(p)||!Number.isFinite(Date.parse(analysis.capturedAt)))return null;
 const facts:AiEvidence[]=[];
 const add=(id:string,topic:AiEvidence['topic'],text:string)=>facts.push({id,topic,text});
 const choices=[{name:match.home,p:p.home},{name:match.away,p:p.away},...(p.draw===undefined?[]:[{name:'和局',p:p.draw}])].sort((a,b)=>b.p-a.p);
 const favored:'home'|'away'|null=Math.abs(choices[0].p-choices[1].p)<.00001?null:choices[0].name===match.home?'home':choices[0].name===match.away?'away':null;
 const opponent=favored==='home'?'away':'home';
 add('result','analysis',`${match.away} 對 ${match.home}：${Math.abs(choices[0].p-choices[1].p)<.00001?'目前沒有單一明確傾向':`模型較偏向${choices[0].name}`}。\n主隊 ${match.home} ${pct(p.home)}／客隊 ${match.away} ${pct(p.away)}${p.draw===undefined?'':`／和局 ${pct(p.draw)}`}。`);
 // Outcome probabilities are not adverse factors. Without a concrete disadvantage,
 // the risk answer must use the user's exact insufficient-data response.
 if(analysis.retained)add('retained','analysis','以上解釋使用本場保存的賽前分析，沒有用開賽後的比分回填預測。');
 if(finite(analysis.expected?.home)&&finite(analysis.expected?.away))add('expected','analysis',`模型預期${match.home} ${num(analysis.expected.home)}、${match.away} ${num(analysis.expected.away)}${kind==='football'?'球':'分'}。這是計算期望值。`);
 if(kind==='baseball'){
  const factors=(analysis.factors||[]).filter((f:any)=>finite(f.home)&&finite(f.away)&&finite(f.score)&&finite(f.contribution)&&f.weight>0).sort((a:any,b:any)=>Math.abs(b.contribution)-Math.abs(a.contribution));
  factors.forEach((f:any,i:number)=>{
   const text=`${f.name}：主隊 ${num(f.home)}、客隊 ${num(f.away)}，設定權重 ${num(f.weight)}%。${f.contribution===0?'此項對雙方沒有形成差距。':`此項使多因子主隊估值${f.contribution>0?'增加':'減少'} ${num(Math.abs(f.contribution))} 個百分點。`}`;
   add('factor-'+i,'analysis',text);
   if(favored&&((favored==='home'&&f.contribution<0)||(favored==='away'&&f.contribution>0)))add('against-'+i,'risk',`對模型較看好的${match[favored]}，${f.name}這項數據較不利。${text}`);
  });
  if(!factors.length&&analysis.inputs?.home&&analysis.inputs?.away){
   for(const side of ['home','away'] as const){const t=analysis.inputs[side];if([t.offense,t.defense,t.starterEra,t.bullpenEra].every(finite))add('runs-'+side,'analysis',`${match[side]}的逐局模型輸入：進攻 ${num(t.offense)}、失分 ${num(t.defense)}、先發 ${num(t.starterEra)}、牛棚 ${num(t.bullpenEra)}。這些是經樣本修正的計算值，依所選比例合成逐局得分。`);}
  }
 } else {
  for(const side of ['home','away'] as const){
   const f=analysis[side+'Form'],scored=kind==='basketball'?f?.pointsFor:f?.scored,conceded=kind==='basketball'?f?.pointsAgainst:f?.conceded;
   if(f&&[f.games,scored,conceded].every(finite))add('form-'+side,'analysis',`${match[side]}的分析樣本 ${f.games} 場，模型使用的場均${kind==='basketball'?'得分':'進球'} ${num(scored)}、${kind==='basketball'?'失分':'失球'} ${num(conceded)}。`);
  }
  if(kind==='football'){
   add('method','analysis','星準依本場啟用的攻防模型計算雙方預期進球，再換算主勝、和局與客勝機率；範圍為正規 90 分鐘含補時。');
   if(favored){
    const f=analysis[favored+'Form'],o=analysis[opponent+'Form'];
    const comparable=(key:string)=>f?.games>0&&o?.games>0&&finite(f[key])&&finite(o[key])&&f[key]>=0&&o[key]>=0;
    // Describe the actual analysis inputs, not invented injuries or a causal
    // attribution to a particular coefficient. Some models adjust these rates.
    if(comparable('scored')&&Number(num(f.scored))<Number(num(o.scored)))add('football-attack-risk','risk',`${match[favored]}的進攻數據較弱：本場分析採用的場均進球為 ${num(f.scored)}，低於${match[opponent]}的 ${num(o.scored)}；這項進攻比較對${match[favored]}不利。`);
    if(comparable('conceded')&&Number(num(f.conceded))>Number(num(o.conceded)))add('football-defense-risk','risk',`${match[favored]}的失球數據較不利：本場分析採用的場均失球為 ${num(f.conceded)}，高於${match[opponent]}的 ${num(o.conceded)}；代表這組分析數據中的防守表現較弱。`);
   }
  }
  if(kind==='basketball'){
   const labels=[['ortg','進攻效率'],['drtg','防守效率'],['threePct','三分命中率'],['ftRate','罰球出手率'],['pace','節奏']];
   for(const [key,label] of labels){
    const h=analysis.inputs?.home?.[key],a=analysis.inputs?.away?.[key];
    if(!finite(h)||!finite(a))continue;
    const format=key==='threePct'||key==='ftRate'?pct:num;
    add('efficiency-'+key,'analysis',`${label}：${match.home} ${format(h)}，${match.away} ${format(a)}。${key==='drtg'?'防守效率數值較低代表每百回合失分較少。':key==='pace'?'節奏用於調整比賽回合與得分預估。':''}`);
    if(favored&&key!=='pace'){
     const f=favored==='home'?h:a,o=favored==='home'?a:h;
     if(format(f)!==format(o)&&(key==='drtg'?f>o:f<o))add('efficiency-risk-'+key,'risk',`${match[favored]}的${label}較不利：${format(f)}，${match[opponent]}為 ${format(o)}。${key==='drtg'?'每百回合失分較多，防守表現較弱。':key==='ortg'?'每百回合得分較少，進攻效率較弱。':key==='threePct'?'外線命中率較低。':'相對投籃出手，取得罰球的比例較低。'}`);
    }
   }
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
  add('weights-reason','weights','兩隊分別保存設定；對戰時取雙方權重的平均值運算。這是依樣本量調整的試算配置，尚未經各隊獨立回測。');
 }else if(suggestion){
  add('weights','weights',`目前建議使用「${suggestion.label}」。\n${suggestion.weights.map(w=>`${w.name} ${num(w.value)}%`).join('、')}。`);
 }

 return {match,capturedAt:analysis.capturedAt,model:analysis.model||analysis.version||'',evidence:facts,suggestion};
}
