/* Match-earned titles are derived bonuses, never repeated writes into base attributes. */
(function(root){
'use strict';
const RATE=.003,BOOST=25;
const LABELS=[['打擊','長打','選球','跑壘','球威','控球','守備','耐力','變化球'],['射門','傳球','盤帶','速度','防守','耐力','視野','守門'],['終結','三分','中距離','傳球','運球','籃板','防守','體能']];
const TITLES={
 'strikeout':{sport:0,name:'三振魔術師',hint:'單場 8 次三振',skills:{4:3,5:2,8:2},test:p=>p.k>=8},
 'slugger':{sport:0,name:'雙響重砲',hint:'單場 2 支全壘打',skills:{0:2,1:5},test:p=>p.hr>=2},
 'hitmaker':{sport:0,name:'安打製造機',hint:'單場 3 支安打',skills:{0:3,2:2},test:p=>p.h>=3},
 'glove':{sport:0,name:'守備鐵壁',hint:'野手單場 8 次守備出局',skills:{6:4,3:2},test:(p,s)=>s.pos!=='投手'&&p.putouts>=8},
 'hat-trick':{sport:1,name:'帽子戲法',hint:'單場 3 顆進球',skills:{0:5,2:2},test:p=>p.goals>=3},
 'playmaker':{sport:1,name:'助攻指揮官',hint:'單場 2 次助攻',skills:{1:4,6:3},test:p=>p.assists>=2},
 'keeper':{sport:1,name:'零封門神',hint:'門將單場 5 次撲救並完成零封',skills:{7:4,6:2},test:(p,s)=>s.pos==='門將'&&p.saves>=5&&p.cleanSheets>=1},
 'defender':{sport:1,name:'禁區守護者',hint:'後衛單場 5 次攔截並完成零封',skills:{4:4,5:2},test:(p,s)=>s.pos==='後衛'&&p.tackles>=5&&p.cleanSheets>=1},
 'scorer':{sport:2,name:'三十分之夜',hint:'單場 30 分',skills:{0:3,1:3,2:3},test:p=>p.pts>=30},
 'floor-general':{sport:2,name:'傳球大師',hint:'單場 10 次助攻',skills:{3:4,4:2},test:p=>p.ast>=10},
 'rebounder':{sport:2,name:'籃板統治者',hint:'單場 15 個籃板',skills:{5:4,6:2},test:p=>p.reb>=15},
 'triple-double':{sport:2,name:'全能大三元',hint:'單場得分、籃板、助攻皆達 10',skills:{0:2,3:2,4:2,5:2,6:2,7:2},test:p=>[p.pts,p.reb,p.ast].every(n=>n>=10)}
};
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function bonus(s,i){return Math.min(8,(s.feats?.titles||[]).reduce((n,t)=>n+(TITLES[t.id]?.skills[i]||0),0))}
function abilities(s,values){return values.map((v,i)=>Math.min(99,v+bonus(s,i)))}
function active(s){const a=s.feats?.awakening,y=(s.sport===1?s.football:s.arena)?.season,m=y?.moment?.match||y?.live||y?.highlight?.match;return !!(a?.active&&a.age===s.age&&!s.retired&&m?.awakeningKey===a.key&&!m.done&&!m.featsSettled)}
function combat(s,values){return values.map(v=>Math.min(99,v+(active(s)?BOOST:0)))}
function roll(s,key){let h=2166136261;for(const c of s.seed+'|awakening|'+key)h=Math.imul(h^c.charCodeAt(0),16777619);h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);return ((h^(h>>>16))>>>0)/4294967296}
function start(s,m,ctx){if(m.awakeningChecked)return;m.awakeningChecked=true;const y=(s.sport===1?s.football:s.arena).season,key=`${s.sport}:${s.age}:${m.playoff?'post-'+y.playoffGames.length:'league'}:${m.round}:${m.home}:${m.away}`;m.awakeningKey=key;if(roll(s,key)>=RATE)return;const f=s.feats||(s.feats={v:1,titles:[],awakening:null});f.awakening={age:s.age,key,active:true};ctx.log(s,'✧ 突然開竅！場上的節奏像慢了下來。本場剩餘時間，所有專項臨時 +25（最高 99），終場立即消退。');}
function description(s,id){return Object.entries(TITLES[id].skills).map(([i,n])=>LABELS[s.sport][i]+' +'+n).join('、')}
function settle(s,m,ctx){if(m.featsSettled)return;m.featsSettled=true;m.earnedTitles=[];const p=m.player;if(p?.apps>0){for(const [id,t]of Object.entries(TITLES)){if(t.sport!==s.sport||!t.test(p,s)||(s.feats?.titles||[]).some(x=>x.id===id))continue;const f=s.feats||(s.feats={v:1,titles:[],awakening:null});f.titles.push({id,age:s.age,match:`${m.home} ${m.hg}：${m.ag} ${m.away}`});m.earnedTitles.push(id);ctx.log(s,`✦ 單場稱號「${t.name}」：${description(s,id)}。本生涯持續生效，同名不重複疊加。`);}}if(m.awakeningKey&&s.feats?.awakening?.key===m.awakeningKey)s.feats.awakening.active=false;}
function banner(s){return active(s)?'<div class="awakening-banner" role="status"><strong>✧ 突然開竅 · 全專項 +25</strong><span>只持續到本場終場 · 臨場能力最高 99</span></div>':''}
function panel(s){const f=s.feats,has=!!f?.titles.length,lit=active(s);return `<section class="feats-panel ${lit?'is-awakened':''}"><div class="topline"><b>✦ 稱號與臨場天賦</b><span>${f?.titles.length||0} / 4</span></div>${lit?'<div class="awakening-banner"><strong>突然開竅</strong><span>本場剩餘時間 · 全專項 +25</span><small>臨場最高 99；終場自動消退。</small></div>':''}${has?f.titles.map(t=>`<div class="feat-earned"><b>${esc(TITLES[t.id].name)}</b><span>${description(s,t.id)}</span><small>${t.age} 歲 · ${esc(TITLES[t.id].hint)}</small></div>`).join(''):'<p>用單場表現贏得稱號，能力加成立即生效。</p>'}<details><summary>查看稱號條件與開竅機率</summary>${Object.entries(TITLES).filter(([,t])=>t.sport===s.sport).map(([id,t])=>`<p><b>${t.name}</b> · ${t.hint}<br>${description(s,id)}</p>`).join('')}<small>稱號在本生涯永久生效；同名只計一次，每項專項累計最多 +8、能力最高 99。每場親自操作的關鍵戰，有 0.3% 機率突然開竅，限本場剩餘時間；讀檔與重播不會重抽。</small></details></section>`}
function validate(s){const f=s.feats;if(f===undefined)return;const fail=()=>{throw Error('稱號與開竅存檔格式不正確')};if(!f||f.v!==1||!Array.isArray(f.titles)||f.titles.length>4||new Set(f.titles.map(t=>t?.id)).size!==f.titles.length)fail();for(const t of f.titles)if(!TITLES[t?.id]||TITLES[t.id].sport!==s.sport||!Number.isInteger(t.age)||t.age<16||t.age>s.age||typeof t.match!=='string'||t.match.length>240)fail();if(f.awakening!==null){const a=f.awakening;if(!a||!Number.isInteger(a.age)||a.age<16||a.age>s.age||typeof a.active!=='boolean'||typeof a.key!=='string'||a.key.length>240)fail();if(a.active&&!active(s))fail();}}
const api={RATE,BOOST,TITLES,LABELS,bonus,abilities,active,combat,roll,start,settle,description,banner,panel,validate};if(typeof module!=='undefined')module.exports=api;else root.XZFeats=api;
})(globalThis);
