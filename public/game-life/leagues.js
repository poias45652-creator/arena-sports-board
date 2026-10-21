/* 三大球類共用的遊戲球探規則；數值不代表真實職業聯盟行情。 */
(function(root){
'use strict';
const O=typeof module!=='undefined'?require('./origins.js'):root.XZOrigins;
const ROUTES=[['中職層級','日職／韓職層級','大聯盟層級'],['台灣職業舞台','日本／葡萄牙／荷蘭','歐洲五大聯賽層級'],['台灣職籃','日本／韓國職籃','NBA 層級']];
const factor=[1,2.5,7];
function roll(s,key){let h=2166136261;for(const c of `${s.seed}|${s.age}|league|${key}`)h=Math.imul(h^c.charCodeAt(0),16777619);return(h>>>0)/4294967296}
function professional(s){return !!s.origin||s.age>=19}
function report(s,ability){const h=s.sport===1?s.football:s.arena,y=h?.season?.complete?h.season:h?.lastSeason,p=y?.player||{},apps=p.apps||0;let good=false,elite=false,detail='完成職業賽季，讓球探看見你的表現。';
 if(s.sport===0){if(s.pos==='投手'){const era=p.outs?27*p.er/p.outs:99;good=p.outs>=30&&era<=4.2;elite=p.outs>=45&&era<=3.1;detail=p.outs?`防禦率 ${era.toFixed(2)} · ${p.k||0} 次三振`:'等待投球成績'}else{const avg=p.ab?p.h/p.ab:0;good=p.ab>=35&&(avg>=.27||p.hr>=5||(p.putouts>=40&&avg>=.23));elite=p.ab>=55&&(avg>=.32||p.hr>=10);detail=`打擊率 ${avg.toFixed(3)} · ${p.hr||0} 轟`}}
 if(s.sport===1){const rating=apps?(p.ratingSum||0)/apps:0;good=apps>=7&&rating>=6.6;elite=apps>=9&&rating>=7.2;detail=`${apps} 場出賽 · 平均評分 ${rating.toFixed(1)}`}
 if(s.sport===2){const avg=k=>apps?(p[k]||0)/apps:0;good=apps>=10&&(avg('pts')>=12||avg('ast')>=4||avg('reb')>=6||avg('stl')+avg('blk')>=2);elite=apps>=14&&(avg('pts')>=20||avg('ast')>=7||avg('reb')>=10||avg('stl')+avg('blk')>=3);detail=`場均 ${avg('pts').toFixed(1)} 分 · ${avg('ast').toFixed(1)} 助攻 · ${avg('reb').toFixed(1)} 籃板`}
 const pro=!!y&&(s.origin||y.age>=19)&&y.age===s.age;const middle=pro&&good&&ability>=55,top=pro&&elite&&ability>=72;
 return{detail,middle,top,invited:top&&roll(s,'top')<.55?2:middle&&roll(s,'middle')<.8?1:0,text:top?'頂級球探關注：本季有機會收到最高舞台邀請。':middle?'海外球探關注：本季有機會收到進階聯盟邀請。':'累積穩定出賽與好表現，提升能力，爭取海外邀約。'};
}
function allowed(s,c,ability){const currentTier=s.age<19&&!s.origin?0:s.tier,r=report(s,ability);return c.tier<=currentTier||c.tier<=r.invited}
function salary(s,ability,tier){return Math.max(1,Math.round(ability**2*.2*factor[tier]*(s.market||1)))}
function label(s,o={}){const domestic=O.current(s,o.team||s.team);if(domestic)return domestic.name;const tier=o.tier??s.tier;if((s.sport===0||s.sport===2)&&tier===1){const korea=/釜山|首爾|仁川|大邱|大田|光州|水原|昌原/.test(o.team||s.team);return s.sport===0?(korea?'韓職層級':'日職層級'):(korea?'韓國職籃層級':'日本職籃層級')}if(s.sport===1){const id=o.league||root.XZFootball?.findClub(o.team||s.team)?.league,names={home:'台灣職業舞台',japan:'日本職業聯賽',portugal:'葡萄牙職業聯賽',netherlands:'荷蘭職業聯賽',england:'英格蘭頂級聯賽',spain:'西班牙頂級聯賽',germany:'德國頂級聯賽',italy:'義大利頂級聯賽',france:'法國頂級聯賽'};if(names[id])return names[id]}return ROUTES[s.sport]?.[tier]||'職業舞台'}
function rare(s,ctx){if(s.age<19||!s.tier||roll(s,'rare')>=(s.tier===2?.18:.08))return;const id=`league-${s.sport}-${s.tier}`;if(!s.visits[id]&&!s.pending.some(p=>p.id===id))ctx.queue(s,id,1)}
function offers(s,ctx,clubs,ability,role){const current=clubs.find(c=>c.name===s.team),pool=clubs.filter(c=>c.league!=='academy'&&allowed(s,c,ability)&&(!s.origin||s.history.length||(s.sport===1?s.football:s.arena)?.season?.complete||c.league===current?.league)),chosen=[];
 if(current&&current.league!=='academy')chosen.push(current);
 if(s.origin){const domestic=pool.filter(c=>c.country===s.origin.country&&c.tier>s.tier);if(domestic.length)chosen.push(domestic[ctx.int(s,0,domestic.length-1)])}
 for(const tier of [2,1,0]){const group=pool.filter(c=>c.tier===tier&&!chosen.includes(c));if(group.length)chosen.push(group[ctx.int(s,0,group.length-1)])}
 // Give Japan and Korea distinct destinations without adding management screens.
 if(s.sport===0&&chosen.some(c=>c.tier===1)){const first=chosen.find(c=>c.tier===1),other=pool.find(c=>c.tier===1&&label(s,{team:c.name,tier:1})!==label(s,{team:first.name,tier:1}));if(other&&!chosen.includes(other))chosen.push(other)}
 for(const c of pool)if(chosen.length<3&&!chosen.includes(c))chosen.push(c);
 return chosen.slice(0,5).map(c=>({team:c.name,league:c.league,tier:c.tier,years:s.age>=34?1:ctx.int(s,1,3),salary:salary(s,ability,c.tier),role:role(s,c,58),fit:ctx.int(s,55,85),power:c.power,kind:c.name===s.team?'renew':'transfer',negotiated:false,scouted:c.tier>s.tier}));
}
const STORIES=[
 ['旅外前輩的深夜牛棚','球場只剩一盞燈。旅外前輩把球交給你：「以前我也聽不懂這裡的暗號。今晚，我陪你。」'],
 ['巔峰舞台的置物櫃','置物櫃裡放著家人寄來的舊手套。明天全世界都會看著你，卻只有你知道，這條路從哪裡開始。'],
 ['客場看台上的故鄉旗幟','陌生的球場裡，你聽見有人用熟悉的語言喊你的名字。那面旗幟不大，卻讓整個客場突然有了家的方向。'],
 ['豪門七號的邀請','隊內巨星在訓練後等著你：「明天一起加練？我想看看，你為什麼能走到這裡。」'],
 ['異鄉球館的最後一球','翻譯早已回家，老隊長卻留下來為你傳球。你們沒有共同語言，籃球落地的聲音就是回答。'],
 ['傳奇的私人訓練場','曾經貼在你房間牆上的傳奇球星，現在站在面前。他指著球框：「名氣留在門外，讓我看看你的本事。」']
];
const EVENTS=STORIES.map(([title,text],i)=>({id:`league-${Math.floor(i/2)}-${i%2+1}`,title,text,sport:Math.floor(i/2),minAge:19,minTier:i%2+1,once:true,chainOnly:true,rarity:'rare',category:'海外奇遇',options:[{label:'把握機會，留下練習',hint:'技術 +3、心情 +12、體力 -8。',effect:{a:[3,0,0,0],mood:12,energy:-8}},{label:'聊聊一路走來的故事',hint:'心理 +3、默契 +6、心情 +16。',effect:{a:[0,0,3,0],chemistry:6,mood:16}}]}));
function route(s){if(!s.origin)return ROUTES[s.sport].map((name,tier)=>({name,active:professional(s)&&s.tier===tier}));const local=O.ladders(s.sport,s.origin.country).sort((a,b)=>b.division-a.division),league=O.current(s);return [...local.map(l=>({name:l.name,active:league?.id===l.id})),{name:'海外轉會',active:!league||league.country!==s.origin.country}]}
function panel(s,ability){if(s.retired)return'';const r=report(s,ability),club=root.XZClubWorld?.get(s.sport,s.team);return `<section class="league-progress"><small>職業版圖 · ${s.age<19&&!s.origin?'校園養成':label(s)}</small>${club?`<div class="club-strength"><b>球隊強度 ${club.power}</b><span>${root.XZClubWorld.band(club.power)}</span></div>`:''}<div class="league-route">${route(s).map(x=>`<span class="${x.active?'active':''}">${x.name}</span>`).join('<b>›</b>')}</div><p>${s.origin?'從'+s.origin.country+'起步，'+r.detail+'。'+r.text:s.age<19?'先累積校園實力，成年後用賽季成績爭取旅外。':r.detail+'。'+r.text}</p><details><summary>球探與聯盟規則</summary>${club?`<p>球隊原型：${club.reference}。名稱經過改編，強度依近期戰績與聯盟層級換算為遊戲評分（2026 年 10 月快照）；不代表官方能力值。育成隊以母隊體系為原型，強度另行降低。</p>`:''}<p>強聯賽從當地次級起步；初始能力達 85 才直接進入當地頂級。完成賽季後可爭取升級與跨國轉會。</p><p>進階邀約：能力 55＋本季好表現；頂級邀約：能力 72＋本季頂尖表現。達標後每季分別有 80%／55% 邀約機會，讀檔不會重抽。不同位置各看專項成績。${s.sport===0?(s.pos==='投手'?'投手：至少 10 局、防禦率 ≤4.20；頂尖為至少 15 局、≤3.10。':'野手：至少 35 打數，打擊率 ≥.270 或 5 轟；守備型可用 40 刺殺＋.230。頂尖為至少 55 打數，.320 或 10 轟。'):s.sport===1?'足球：至少 7 場、評分 ≥6.6；頂尖為至少 9 場、評分 ≥7.2。':'籃球：至少 10 場，場均 12 分／4 助攻／6 籃板／抄截＋阻攻 2 次，任一達標；頂尖需 14 場，門檻依序為 20／7／10／3。'}</p><p>遊戲薪資倍率 1／2.5／7 倍；海外奇遇每季 8%／18%，每段故事僅一次，安排於下季。強敵會壓低比賽成功率。聯盟層級為模擬，球隊皆為架空。</p></details></section>`}
const api={professional,ROUTES,EVENTS,report,allowed,salary,label,rare,offers,panel};if(typeof module!=='undefined')module.exports=api;else root.XZLeagues=api;
})(typeof globalThis!=='undefined'?globalThis:this);
