/* Match-earned titles are derived bonuses, never repeated writes into base attributes. */
(function(root){
'use strict';
const RATE=.003,BOOST=25;
const LABELS=[['打擊','長打','選球','跑壘','球威','控球','守備','耐力','變化球'],['射門','傳球','盤帶','速度','防守','耐力','視野','守門'],['終結','三分','中距離','傳球','運球','籃板','防守','體能']];
const TITLES={
 'strikeout':{sport:0,name:'揮空編織者',hint:'單場 8 次三振',skills:{4:3,5:2,8:2},test:p=>p.k>=8},
 'slugger':{sport:0,name:'雙星轟炸機',hint:'單場 2 支全壘打',skills:{0:2,1:5},test:p=>p.hr>=2},
 'hitmaker':{sport:0,name:'穿線巧匠',hint:'單場 3 支安打',skills:{0:3,2:2},test:p=>p.h>=3},
 'glove':{sport:0,name:'銅牆手套',hint:'野手單場 8 次守備出局',skills:{6:4,3:2},test:(p,s)=>s.pos!=='投手'&&p.putouts>=8},
 'hat-trick':{sport:1,name:'三箭定江山',hint:'單場 3 顆進球',skills:{0:5,2:2},test:p=>p.goals>=3},
 'playmaker':{sport:1,name:'最後一傳',hint:'單場 2 次助攻',skills:{1:4,6:3},test:p=>p.assists>=2},
 'keeper':{sport:1,name:'不落之門',hint:'門將單場 5 次撲救並完成零封',skills:{7:4,6:2},test:(p,s)=>s.pos==='門將'&&p.saves>=5&&p.cleanSheets>=1},
 'defender':{sport:1,name:'後防鎮山石',hint:'後衛單場 5 次攔截並完成零封',skills:{4:4,5:2},test:(p,s)=>s.pos==='後衛'&&p.tackles>=5&&p.cleanSheets>=1},
 'scorer':{sport:2,name:'烈焰得分手',hint:'單場 30 分',skills:{0:3,1:3,2:3},test:p=>p.pts>=30},
 'floor-general':{sport:2,name:'球場導航者',hint:'單場 10 次助攻',skills:{3:4,4:2},test:p=>p.ast>=10},
 'rebounder':{sport:2,name:'制空領主',hint:'單場 15 個籃板',skills:{5:4,6:2},test:p=>p.reb>=15},
 'triple-double':{sport:2,name:'三域主宰',hint:'單場得分、籃板、助攻皆達 10',skills:{0:2,3:2,4:2,5:2,6:2,7:2},test:p=>[p.pts,p.reb,p.ast].every(n=>n>=10)},
 'marathon-arm':{sport:0,name:'長局鎮守者',hint:'單場至少 8 局、零自責分',skills:{7:4,5:2},test:p=>p.outs>=24&&p.er===0},
 'run-driver':{sport:0,name:'清壘急先鋒',hint:'單場 5 分打點',skills:{0:2,1:3},test:p=>p.rbi>=5},
 'patient-eye':{sport:0,name:'壞球鑑定師',hint:'單場 3 次保送',skills:{2:4,0:1},test:p=>p.bb>=3},
 'ace-twelve':{sport:0,name:'十二道封印',hint:'單場 12 次三振',skills:{4:2,8:4},test:p=>p.k>=12},
 'four-goals':{sport:1,name:'四重奏殺手',hint:'單場 4 顆進球',skills:{0:3,3:2},test:p=>p.goals>=4},
 'chance-weaver':{sport:1,name:'機會織網者',hint:'單場 3 次助攻',skills:{1:3,6:2},test:p=>p.assists>=3},
 'last-stand':{sport:1,name:'孤城守望者',hint:'門將單場 7 次撲救',skills:{7:3,5:2},test:(p,s)=>s.pos==='門將'&&p.saves>=7},
 'two-way-foot':{sport:1,name:'全域接應者',hint:'單場進球、助攻各 1 並有 3 次攔截',skills:{2:2,4:2,6:2},test:p=>p.goals>=1&&p.assists>=1&&p.tackles>=3},
 'deep-six':{sport:2,name:'六芒遠射手',hint:'單場命中 6 顆三分球',skills:{1:4,2:1},test:p=>p.tpm>=6},
 'sky-lock':{sport:2,name:'禁飛執行者',hint:'單場 5 次阻攻',skills:{6:4,5:1},test:p=>p.blk>=5},
 'pickpocket':{sport:2,name:'傳球獵影',hint:'單場 5 次抄截',skills:{6:2,4:3},test:p=>p.stl>=5},
 'forty-five':{sport:2,name:'熾熱四十五',hint:'單場 45 分',skills:{0:2,1:2,2:2},test:p=>p.pts>=45}
};
// Negative titles affect only future matches; two qualifying appearances clear the penalty.
Object.assign(TITLES,{
 'lost-zone':{sport:0,negative:true,name:'準星偏移',hint:'投手單場至少 4 次保送',skills:{5:-7,8:-3},test:p=>p.pitchApps>0&&p.walks>=4,recover:p=>p.outs>=12&&p.walks<=1,recovery:'兩場各投滿 4 局、保送不超過 1 次'},
 'swing-fog':{sport:0,negative:true,name:'揮空迷航',hint:'單場至少 3 打數、吞下 3 次三振',skills:{0:-6,2:-4},test:p=>p.ab>=3&&p.so>=3,recover:p=>p.h>=2||p.hr>=1,recovery:'兩場各敲出 2 支安打或 1 支全壘打'},
 'run-alarm':{sport:0,negative:true,name:'失分警報',hint:'投手單場至少 6 分自責分',skills:{4:-6,7:-4},test:p=>p.pitchApps>0&&p.er>=6,recover:p=>p.outs>=15&&p.er<=2,recovery:'兩場各投滿 5 局、自責分不超過 2'},
 'red-edge':{sport:1,negative:true,name:'紅牌邊緣',hint:'單場領到紅牌',skills:{4:-6,6:-4},test:p=>p.red>=1,recover:p=>p.minutes>=60&&p.yellow===0&&p.red===0,recovery:'兩場各踢滿 60 分鐘且沒有黃、紅牌'},
 'lost-rhythm':{sport:1,negative:true,name:'節奏迷途',hint:'出場至少 60 分鐘、單場評分不高於 5.5',skills:{0:-5,1:-4,6:-3},test:p=>p.minutes>=60&&p.ratingSum<=5.5,recover:p=>p.minutes>=60&&p.ratingSum>=7,recovery:'兩場各踢滿 60 分鐘且評分至少 7.0'},
 'goal-shadow':{sport:1,negative:true,name:'失守陰影',hint:'門將出場至少 60 分鐘、球隊單場失 4 球',skills:{7:-7,6:-3},test:(p,s,m)=>s.pos==='門將'&&p.minutes>=60&&(m.home===s.team?m.ag:m.hg)>=4,recover:p=>p.cleanSheets>=1,recovery:'完成兩場零封'},
 'cold-rim':{sport:2,negative:true,name:'冰封準星',hint:'單場至少 10 次出手、命中率不高於 25%',skills:{0:-3,1:-6,2:-4},test:p=>p.fga>=10&&p.fgm/p.fga<=.25,recover:p=>p.fga>=8&&p.fgm/p.fga>=.5,recovery:'兩場各出手至少 8 次、命中率達 50%'},
 'loose-handle':{sport:2,negative:true,name:'球權漏斗',hint:'單場至少 5 次失誤',skills:{3:-5,4:-6},test:p=>p.tov>=5,recover:p=>p.minutes>=20&&p.ast>=4&&p.tov<=1,recovery:'兩場各打滿 20 分鐘、4 助攻且失誤不超過 1'},
 'foul-siren':{sport:2,negative:true,name:'犯規警報',hint:'單場至少 6 次犯規',skills:{6:-6,7:-3},test:p=>p.fouls>=6,recover:p=>p.minutes>=20&&p.fouls<=2,recovery:'兩場各打滿 20 分鐘、犯規不超過 2'}
});
const POSITIVE_CAP=16,NEGATIVE_CAP=-18;
function equipped(s){return (s.feats?.titles||[]).filter(t=>!t.clearedAge)}
// Ability-driven signature effects are derived from permanent skills, excluding temporary awakening.
const SIGNATURES=[
 [0,0,'穿隙打者','自動打席安打機率 +2 個百分點'],[0,1,'重砲引擎','自動打席全壘打機率 +0.5 個百分點'],[0,2,'鷹眼判讀','自動打席保送機率 +1.5 個百分點'],[0,3,'疾風掠壘','跑壘專項關鍵動作額外 +2 個百分點'],[0,4,'火線壓制','投球時自動打席三振區間 +3 個百分點'],[0,5,'邊角刻刀','投球時對手保送機率 −1.5 個百分點'],[0,6,'草地結界','防守時對手安打機率 −1.5 個百分點'],[0,7,'永動投臂','比賽體力消耗 −20%'],[0,8,'折線幻術','投球時對手全壘打機率 −20%'],
 [1,0,'冰脈終結','所屬球隊預期進球 +8%'],[1,1,'破線引路人','自動比賽個人助攻分配機率 +10%'],[1,2,'足下幻影','個人單場評分 +0.05'],[1,3,'閃影突襲','所屬球隊預期進球 +4%'],[1,4,'後場封鎖線','所屬球隊預期失球 −6%'],[1,5,'不息引擎','比賽體力消耗 −20%'],[1,6,'全景預判','關鍵動作的局勢壓力懲罰 −15%'],[1,7,'瞬息門鎖','門將：所屬球隊預期失球 −5%'],
 [2,0,'籃下破陣者','個人自動兩分球命中率 +2 個百分點'],[2,1,'超距星火','個人自動三分球命中率 +2 個百分點'],[2,2,'中距離刻度','自動罰球命中率 +2 個百分點'],[2,3,'空檔編導','自動助攻機率 +10%'],[2,4,'控球磁場','自動進攻失誤機率 −15%'],[2,5,'高空磁力','自動籃板機率 +10%'],[2,6,'禁區警戒網','自動抄截與阻攻機率 +10%'],[2,7,'續航核心','比賽體力消耗 −20%']
].map(([sport,skill,name,effect])=>({id:`signature-${sport}-${skill}`,sport,skill,name,effect,threshold:65}));
function signatureValues(s){const api=typeof module!=='undefined'?require(s.sport===1?'./football.js':'./arena.js'):(s.sport===1?root.XZFootball:root.XZArena);return api.abilities(s)}
function signatures(s){const ab=signatureValues(s);return SIGNATURES.filter(t=>t.sport===s.sport&&(t.skill!==7||s.sport!==1||s.pos==='門將')).map(t=>({...t,value:ab[t.skill],active:ab[t.skill]>=t.threshold}))}
function special(s){const out={};for(const t of signatures(s))if(t.active)out[t.skill]=true;return out}
function signatureChance(s,skill){const on=special(s);return on[skill]?.03+(s.sport===0&&skill===3?.02:0):0}
function fatigue(s,cost){return cost*(special(s)[s.sport===1?5:7]?.8:1)}
function signaturePanel(s){const all=signatures(s),on=all.filter(t=>t.active);return `<div class="signature-summary"><b>能力招牌技</b><span>${on.length} / ${all.length} 啟用</span></div>${on.map(t=>`<div class="feat-earned"><b>★ ${t.name}</b><span>${t.effect}</span></div>`).join('')}<details><summary>招牌技門檻與效果</summary>${all.map(t=>`<p><b>${t.active?'★':'◇'} ${t.name}</b> · ${LABELS[s.sport][t.skill]} ${t.value} / 65<br>${t.effect}</p>`).join('')}<small>專項達 65 自動啟用，低於 65 暫停；該專項的手動關鍵動作成功率另 +3 個百分點。無須裝備。單場稱號加成可協助達標，突然開竅不會解鎖招牌技。</small></details>`}
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function bonus(s,i){let positive=0,negative=0;for(const earned of equipped(s)){const v=TITLES[earned.id]?.skills[i]||0;if(v>0)positive+=v;else negative+=v}return Math.min(POSITIVE_CAP,positive)+Math.max(NEGATIVE_CAP,negative)}
function abilities(s,values){return values.map((v,i)=>Math.max(1,Math.min(99,v+bonus(s,i))))}
function active(s){const a=s.feats?.awakening,y=(s.sport===1?s.football:s.arena)?.season,m=y?.moment?.match||y?.live||y?.highlight?.match;return !!(a?.active&&a.age===s.age&&!s.retired&&m?.awakeningKey===a.key&&!m.done&&!m.featsSettled)}
function combat(s,values){return values.map(v=>Math.min(99,v+(active(s)?BOOST:0)))}
function roll(s,key){let h=2166136261;for(const c of s.seed+'|awakening|'+key)h=Math.imul(h^c.charCodeAt(0),16777619);h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);return ((h^(h>>>16))>>>0)/4294967296}
function start(s,m,ctx){if(m.awakeningChecked)return;m.awakeningChecked=true;const y=(s.sport===1?s.football:s.arena).season,key=`${s.sport}:${s.age}:${m.playoff?'post-'+y.playoffGames.length:'league'}:${m.round}:${m.home}:${m.away}`;m.awakeningKey=key;if(roll(s,key)>=RATE)return;const f=s.feats||(s.feats={v:1,titles:[],awakening:null});f.awakening={age:s.age,key,active:true};ctx.log(s,'✧ 突然開竅！場上的節奏像慢了下來。本場剩餘時間，所有專項臨時 +25（最高 99），終場立即消退。');}
function description(s,id){return Object.entries(TITLES[id].skills).map(([i,n])=>LABELS[s.sport][i]+' '+(n>0?'+':'')+n).join('、')}
function settle(s,m,ctx){if(m.featsSettled)return;m.featsSettled=true;m.earnedTitles=[];m.clearedTitles=[];const p=m.player;
 if(p?.apps>0){
  for(const earned of equipped(s)){const t=TITLES[earned.id];if(!t.negative)continue;if(t.test(p,s,m))earned.recoveryProgress=0;else if(t.recover(p,s,m)){earned.recoveryProgress=(earned.recoveryProgress||0)+1;if(earned.recoveryProgress>=2){earned.clearedAge=s.age;m.clearedTitles.push(earned.id);ctx.log(s,'↗ 擺脫「'+t.name+'」：能力減益解除，這段經歷仍保留在紀錄裡。')}}}
  for(const [id,t]of Object.entries(TITLES)){if(t.sport!==s.sport||!t.test(p,s,m))continue;const existing=(s.feats?.titles||[]).find(x=>x.id===id);if(existing&&!existing.clearedAge)continue;
   const f=s.feats||(s.feats={v:1,titles:[],awakening:null}),record={id,age:s.age,match:`${m.home} ${m.hg}：${m.ag} ${m.away}`,...(t.negative?{recoveryProgress:0}:{})};if(existing)Object.assign(existing,record,{clearedAge:undefined});else f.titles.push(record);
   m.earnedTitles.push(id);ctx.log(s,`${t.negative?'▼ 負面':'✦ 單場'}稱號「${t.name}」：${description(s,id)}。${t.negative?'完成復甦條件可解除；同名不重複扣值。':'與其他稱號同時生效，同名不重複疊加。'}`);
  }
 }if(m.awakeningKey&&s.feats?.awakening?.key===m.awakeningKey)s.feats.awakening.active=false;
}
function badges(s){return equipped(s).map(t=>{const def=TITLES[t.id];return `<span class="name-title${def.negative?' is-negative':''}" title="${esc(description(s,t.id))}${def.negative?'；'+esc(def.recovery):''}">${def.negative?'▼':'✦'} ${esc(def.name)}</span>`}).join('')}
function banner(s){return active(s)?'<div class="awakening-banner" role="status"><strong>✧ 突然開竅 · 全專項 +25</strong><span>只持續到本場終場 · 臨場能力最高 99</span></div>':''}
function panel(s){const activeTitles=equipped(s),lit=active(s),all=s.feats?.titles||[],cleared=all.filter(t=>t.clearedAge),net=LABELS[s.sport].map((label,i)=>{const n=bonus(s,i);return n?label+' '+(n>0?'+':'')+n:''}).filter(Boolean).join('、');return `<section class="feats-panel ${lit?'is-awakened':''}"><div class="topline"><b>✦ 多重稱號與臨場天賦</b><span>${activeTitles.length} 個同時生效</span></div><p class="title-total">${net?'合計：'+net:'可同時擁有多個正面與負面稱號，取得後自動生效。'}</p>${lit?banner(s):''}${activeTitles.map(t=>{const def=TITLES[t.id];return `<div class="feat-earned ${def.negative?'is-negative':''}"><b>${def.negative?'▼ 負面 · ':'✦ '}${esc(def.name)}</b><span>${description(s,t.id)}</span><small>${t.age} 歲 · ${esc(def.hint)}</small>${def.negative?`<p>復甦 ${t.recoveryProgress||0} / 2：${def.recovery}。再次觸發會重計。</p>`:''}</div>`}).join('')}${cleared.length?`<details><summary>已擺脫的負面稱號 · ${cleared.length}</summary>${cleared.map(t=>`<p>↗ ${esc(TITLES[t.id].name)} · ${t.clearedAge} 歲解除，已無減益</p>`).join('')}</details>`:''}${signaturePanel(s)}<details><summary>查看稱號條件與開竅機率</summary>${Object.entries(TITLES).filter(([,t])=>t.sport===s.sport).map(([id,t])=>`<p><b>${t.negative?'▼ 負面 · ':''}${t.name}</b> · ${t.hint}<br>${description(s,id)}${t.negative?'<br>解除：'+t.recovery:''}</p>`).join('')}<small>所有有效稱號同時生效，無須裝備；同名只計一次。每項專項正面加成最多 +16、負面減益最多 -18，再相加；能力限 1～99。正面永久保留，負面完成兩場復甦條件後解除。每場親自操作的關鍵戰有 0.3% 機率突然開竅，限本場剩餘時間；讀檔與重播不會重抽。</small></details></section>`}
function validate(s){const f=s.feats;if(f===undefined)return;const fail=()=>{throw Error('稱號與開竅存檔格式不正確')};if(!f||f.v!==1||!Array.isArray(f.titles)||f.titles.length>Object.values(TITLES).filter(t=>t.sport===s.sport).length||new Set(f.titles.map(t=>t?.id)).size!==f.titles.length)fail();for(const t of f.titles)if(!TITLES[t?.id]||TITLES[t.id].sport!==s.sport||!Number.isInteger(t.age)||t.age<16||t.age>s.age||typeof t.match!=='string'||t.match.length>240)fail();for(const t of f.titles){if(t.clearedAge!==undefined&&(!TITLES[t.id].negative||!Number.isInteger(t.clearedAge)||t.clearedAge<t.age||t.clearedAge>s.age||t.recoveryProgress!==2))fail();if(t.recoveryProgress!==undefined&&(!TITLES[t.id].negative||!Number.isInteger(t.recoveryProgress)||t.recoveryProgress<0||t.recoveryProgress>2))fail()}if(f.awakening!==null){const a=f.awakening;if(!a||!Number.isInteger(a.age)||a.age<16||a.age>s.age||typeof a.active!=='boolean'||typeof a.key!=='string'||a.key.length>240)fail();if(a.active&&!active(s))fail();}}
const api={equipped,badges,POSITIVE_CAP,NEGATIVE_CAP,SIGNATURES,signatures,special,signatureChance,fatigue,signaturePanel,RATE,BOOST,TITLES,LABELS,bonus,abilities,active,combat,roll,start,settle,description,banner,panel,validate};if(typeof module!=='undefined')module.exports=api;else root.XZFeats=api;
})(globalThis);
