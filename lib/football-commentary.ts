// ESPN's play-by-play uses standard action phrases. Protect source identities
// before translating those phrases so names (e.g. Ben White) cannot be rewritten.
export type FootballCommentaryText={text:string;sourceText?:string};
const escape=(s:string)=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// Commentary and rosters sometimes use different spellings. Preserve the names
// actually written in the event instead of guessing a matching player identity.
export function footballCommentaryNames(texts:string[],names:Record<string,string>,teamName:(name:string)=>string){
 const add=(name:string|undefined,team=false)=>{if(name?.trim())names[name.trim()]=team?teamName(name.trim()):name.trim();};
 for(const text of texts){
  for(const m of text.matchAll(/((?:[^.!?()]|\bSt\.)+) \(([^()]*)\)/g)){
   const actor=m[1].trim().replace(/^.*\b(?:by |injury |card to )/,'').replace(/^VAR Decision: (?:Goal awarded|No Goal|Penalty awarded|Red Card) /,'');
   if(!/\b(?:shot|saved|Goal|Penalty|Attempt|Decision)\b/.test(actor))add(actor);
   add(m[2],true);
  }
  let m=text.match(/^Substitution, (.+?)\. (.+?) replaces (.+?)(?: because of an injury)?\.$/);
  if(m){add(m[1],true);add(m[2]);add(m[3]);}
  m=text.match(/^Offside, (.+?)\. (.+?) is caught offside\.$/);if(m){add(m[1],true);add(m[2]);}
  m=text.match(/Conceded by (.+?)\.$/);if(m)add(m[1]);
  m=text.match(/Assisted by (.+?)(?: with | following |\.$)/);if(m)add(m[1]);
  m=text.match(/^Own Goal by (.+?), (.+?)\./);if(m){add(m[1]);add(m[2],true);}
  m=text.match(/^Penalty .+?\. (.+?) draws a foul in the penalty area\.$/);if(m)add(m[1]);
 }
 return names;
}
const phrases:[RegExp,string][]=[
 [/Lineups are announced and players are warming up\.?/gi,'先發名單已公布，球員正在熱身。'],
 [/Delay over\. They are ready to continue\.?/gi,'暫停結束，比賽恢復。'],
 [/Fourth official has announced (\d+) minutes? of added time\.?/gi,'第四裁判宣布補時 $1 分鐘。'],
 [/Second yellow card to (.+?) for a bad foul\./gi,'$1 因犯規領到第二張黃牌，兩黃一紅遭罰下。'],
 [/Second yellow card to (.+?)\./gi,'$1 領到第二張黃牌，兩黃一紅遭罰下。'],
 [/(.+?) is shown the yellow card for a bad foul\./gi,'$1 因犯規被出示黃牌。'],
 [/(.+?) is shown the red card for a bad foul\./gi,'$1 因犯規被出示紅牌。'],
 [/ is shown the yellow card/gi,' 被出示黃牌'],[/ is shown the red card/gi,' 被出示紅牌'],
 [/ for violent conduct/gi,'（暴力行為）'],[/ for dissent/gi,'（抗議判決）'],[/ for time wasting/gi,'（拖延時間）'],[/ for excessive celebration/gi,'（過度慶祝）'],[/ for a bad foul/gi,'（犯規）'],[/ for dangerous play/gi,'（危險動作）'],[/ for simulation/gi,'（假摔）'],[/ for hand ball/gi,'（手球）'],[/ for handball/gi,'（手球）'],[/ for arguing/gi,'（抗議判決）'],
 [/Substitution, (.+?)\. (.+?) replaces (.+?) because of an injury\./gi,'$1 換人：$2 上場，$3 因傷下場。'],
 [/Substitution, (.+?)\. (.+?) replaces (.+?)\./gi,'$1 換人：$2 上場，$3 下場。'],
 [/Foul by (.+?)\./gi,'$1 犯規。'],[/Handball by (.+?)\./gi,'$1 手球犯規。'],[/Dangerous play by (.+?)\./gi,'$1 危險動作。'],
 [/(.+?) wins a free kick in the defensive half\./gi,'$1 在己方半場獲得自由球。'],
 [/(.+?) wins a free kick in the attacking half\./gi,'$1 在對方半場獲得自由球。'],
 [/(.+?) wins a free kick on the (left|right) wing\./gi,'$1 在 $2 邊路獲得自由球。'],
 [/Corner, (.+?)\. Conceded by (.+?)\./gi,'$1 獲得角球，由 $2 將球擋出底線。'],
 [/Offside, (.+?)\. (.+?) is caught offside\./gi,'$1 越位，$2 處於越位位置。'],
 [/Offside, /gi,'越位：'],[/Corner, /gi,'角球：'],
 [/Own Goal by (.+?), (.+?)\./gi,'$2 的 $1 自擺烏龍。'],
 [/Penalty conceded by (.+?) after a foul in the penalty area\./gi,'$1 在禁區內犯規，對方獲判十二碼。'],
 [/Penalty conceded by (.+?) with a hand ball in the penalty area\./gi,'$1 在禁區內手球，對方獲判十二碼。'],
 [/Penalty (.+?)\. (.+?) draws a foul in the penalty area\./gi,'$1 獲判十二碼，$2 在禁區內被犯規。'],
 [/Penalty saved[!.] (.+?) fails to capitalise on this great opportunity, /gi,'十二碼被撲出！$1 未能把握機會，'],
 [/Penalty missed[!.] (.+?) fails to capitalise on this great opportunity, /gi,'十二碼未進！$1 未能把握機會，'],
 [/Penalty saved[!.]/gi,'十二碼被撲出！'],[/Penalty missed[!.]/gi,'十二碼未進！'],
 [/Goal! /gi,'進球！'],[/ converts the penalty with a /gi,' 十二碼罰進，以'],
 [/Penalty Shootout ends/gi,'十二碼決勝結束'],[/Penalty Shootout begins/gi,'十二碼決勝開始'],
 [/Second Half Extra Time ends/gi,'延長賽下半場結束'],[/Second Half Extra Time begins/gi,'延長賽下半場開始'],
 [/First Half Extra Time ends/gi,'延長賽上半場結束'],[/First Half Extra Time begins/gi,'延長賽上半場開始'],
 [/Match ends/gi,'比賽結束'],[/First Half ends/gi,'上半場結束'],[/First Half begins/gi,'上半場開始'],[/Second Half ends/gi,'下半場結束'],[/Second Half begins/gi,'下半場開始'],
 [/Delay in match because of an injury (.+?)\./gi,'$1 受傷，比賽暫停。'],
 [/Delay in match because of an injury\.?/gi,'因球員受傷，比賽暫停。'],
 [/Delay in match because of (?:a )?VAR check\.?/gi,'正在進行 VAR 檢視，比賽暫停。'],
 [/Delay in match (.+?)\./gi,'比賽暫停：$1。'],[/Delay in match\.?/gi,'比賽暫停。'],
 [/VAR Decision: Goal awarded/gi,'VAR 判決：進球有效'],[/VAR Decision: No Goal/gi,'VAR 判決：進球無效'],
 [/VAR Decision: Goal cancelled/gi,'VAR 判決：取消進球'],[/VAR Decision: Penalty confirmed/gi,'VAR 判決：維持十二碼判罰'],
 [/VAR Decision: Penalty awarded/gi,'VAR 判決：判罰十二碼'],[/VAR Decision: No Penalty/gi,'VAR 判決：不判十二碼'],
 [/VAR Decision: Penalty cancelled/gi,'VAR 判決：取消十二碼判罰'],[/VAR Decision: Card upgraded/gi,'VAR 判決：加重判罰'],
 [/VAR Decision: Red Card/gi,'VAR 判決：紅牌'],[/VAR Decision: Card cancelled/gi,'VAR 判決：取消出牌'],
 [/VAR Decision: Penalty /gi,'VAR 判決：十二碼，'],
 [/Goal disallowed/gi,'進球無效'],[/Goal confirmed/gi,'確認進球有效'],
 [/Attempt saved[!.]? /gi,'射門被撲出。'],[/Attempt missed[!.]? /gi,'射門未進。'],[/Attempt blocked[!.]? /gi,'射門被封阻。'],
 [/ hits the (?:bar|crossbar) with a /gi,' 擊中橫樑，以'],[/ hits the left post with a /gi,' 擊中左側門柱，以'],[/ hits the right post with a /gi,' 擊中右側門柱，以'],
 [/right footed shot/gi,'右腳射門'],[/left footed shot/gi,'左腳射門'],[/header/gi,'頭槌'],[/with an attempt/gi,'嘗試射門'],
 [/from the right side of the six yard box/gi,'（小禁區右側）'],[/from the left side of the six yard box/gi,'（小禁區左側）'],
 [/from the centre of the six yard box/gi,'（小禁區中央）'],[/from the centre of the box/gi,'（禁區中央）'],
 [/from the right side of the box/gi,'（禁區右側）'],[/from the left side of the box/gi,'（禁區左側）'],
 [/from a difficult angle on the right/gi,'（右側小角度）'],[/from a difficult angle on the left/gi,'（左側小角度）'],
 [/from a difficult angle and long range on the right/gi,'（右側遠距離小角度）'],[/from a difficult angle and long range on the left/gi,'（左側遠距離小角度）'],
 [/from long range on the right/gi,'（右側遠射）'],[/from long range on the left/gi,'（左側遠射）'],
 [/from outside the box/gi,'（禁區外）'],[/from very close range/gi,'（近距離）'],[/from more than (\d+) yards/gi,'（距離超過 $1 碼）'],
 [/is saved in the (bottom left corner|bottom right corner|top left corner|top right corner|top centre of the goal|bottom centre of the goal|centre of the goal) by /gi,'在 $1 被撲出，撲救：'],
 [/is saved in the (bottom left corner|bottom right corner|top left corner|top right corner|top centre of the goal|bottom centre of the goal|centre of the goal)/gi,'在 $1 被撲出'],
 [/is saved by /gi,'被撲出，撲救：'],[/is saved/gi,'被撲出'],
 [/to the (?:high|top) centre of the goal/gi,'射入球門中央上方'],[/to the bottom centre of the goal/gi,'射入球門中央下方'],[/to the centre of the goal/gi,'射入球門中央'],
 [/to the bottom left corner/gi,'射入球門左下角'],[/to the bottom right corner/gi,'射入球門右下角'],[/to the top left corner/gi,'射入球門左上角'],[/to the top right corner/gi,'射入球門右上角'],
 [/bottom left corner/gi,'球門左下角'],[/bottom right corner/gi,'球門右下角'],[/top left corner/gi,'球門左上角'],[/top right corner/gi,'球門右上角'],
 [/top centre of the goal/gi,'球門中央上方'],[/bottom centre of the goal/gi,'球門中央下方'],[/centre of the goal/gi,'球門中央'],
 [/is close, but misses to the left/gi,'稍偏出左側'],[/is close, but misses to the right/gi,'稍偏出右側'],
 [/is high and wide to the left/gi,'高出且偏左'],[/is high and wide to the right/gi,'高出且偏右'],[/misses to the left/gi,'偏出左側'],[/misses to the right/gi,'偏出右側'],
 [/is just a bit too high/gi,'稍微高出'],[/is too high/gi,'高出球門'],[/is blocked/gi,'被封阻'],
 [/Assisted by /gi,'助攻：'],[/with a headed pass/gi,'（頭球傳球）'],[/with a cross/gi,'（傳中）'],[/with a through ball/gi,'（直塞球）'],
 [/following a corner/gi,'（角球攻勢）'],[/following a set piece situation/gi,'（定位球攻勢）'],[/following a fast break/gi,'（快速反擊）'],
 [/from a direct free kick/gi,'（直接自由球）'],[/from a free kick/gi,'（自由球）'],
 [/cooling break/gi,'補水時間'],[/weather conditions/gi,'天候因素'],[/an equipment malfunction/gi,'設備故障'],
 [/\bleft\b/gi,'左'],[/\bright\b/gi,'右'],
];

export function footballCommentaryText(value:string,names:Record<string,string>={}):FootballCommentaryText{
 const source=value.trim();if(!source)return {text:''};
 const identities:string[]=[];
 const aliases=Object.keys(names).filter(Boolean).sort((a,b)=>b.length-a.length);
 // Boundaries avoid replacing AZ inside another name or a short alias inside a word.
 let result=aliases.length?source.replace(new RegExp(`(?<![\\p{L}\\p{N}])(?:${aliases.map(escape).join('|')})(?![\\p{L}\\p{N}])`,'gu'),name=>`§${identities.push(names[name])-1}§`):source;
 for(const [pattern,replacement] of phrases)result=result.replace(pattern,replacement);
 // Unrecognised source wording stays available on demand; never invent an action
 // or present a partly translated English sentence as a completed translation.
 if(/[a-z]/i.test(result.replace(/VAR/g,'')))return {text:'此則賽事文字尚待翻譯，可展開查看原文。',sourceText:source};
 result=result.replace(/[,]/g,'，').replace(/\.(?=\s|$)/g,'。').replace(/\s*([，。])\s*/g,'$1').replace(/\s*([（）])\s*/g,'$1').replace(/[()]/g,c=>c==='('? '（':'）').replace(/：(?=。|$)/g,'').replace(/。+/g,'。').replace(/§(\d+)§/g,(_,n)=>identities[Number(n)]).trim();
 return {text:result};
}
