/* Read-only match presentation: every score, chance and title comes from the engine. */
(function(root){
'use strict';
const T=typeof module!=='undefined'?require('./feats.js'):root.XZFeats;
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hash=t=>{let h=0;for(const c of String(t))h=Math.imul(h,31)+c.charCodeAt(0);return h>>>0};
const sign=n=>(n>0?'+':'')+Number(n.toFixed(1));
function pulse(s,m){
 const lines=[];
 if(s.family?.child)lines.push(`你想起${s.family.child.name}。有一天，你想親口說說自己怎麼面對這種時刻。`);
 if(['dating','married','parent'].includes(s.family?.stage)&&s.family?.partner&&!['strained','separated'].includes(s.romance?.bond))lines.push(`你想起${s.family.partner}。今天回去，想和她說的不只是比分。`);
 if(['strained','separated'].includes(s.romance?.bond))lines.push('場外的那句話還刺在心裡。你吐一口氣，把注意力留給眼前這一球。');
 if(s.flags?.mentor)lines.push('前輩教過的動作浮上腦海。練了那麼多次，現在換你自己決定。');
 if(s.dynamics?.failureRun>=2)lines.push('前幾次失手還在腦海裡。你重新站穩，這一球還沒有答案。');
 if(s.dynamics?.momentum>=2)lines.push('手感正熱，隊友又把機會交給你。你也知道，下一球仍得重新做好。');
 if(!lines.length)lines.push('你握緊又鬆開手。沒有人能替你打這一球。','那些沒有觀眾的練習，終於等到這一刻。','隊友望向你。你點一下頭，讓呼吸慢下來。');
 return lines[hash(s.seed+'|'+s.age+'|'+m.round+'|'+m.home)%lines.length];
}
function context(s,m,minute){
 const own=m.home===s.team,diff=(own?m.hg:m.ag)-(own?m.ag:m.hg),unit=s.sport===1?'球':'分';
 const score=diff===0?'雙方平手':`${diff>0?'領先':'落後'} ${Math.abs(diff)} ${unit}`;
 if(s.sport===1)return `${minute} 分鐘 · ${score}`;
 if(s.sport===2)return `第 ${m.quarter} 節 · 剩 ${Math.floor(m.clock/60)}:${String(m.clock%60).padStart(2,'0')} · ${score}`;
 const bases=(m.bases||[]).map((r,i)=>r?['一','二','三'][i]+'壘':'').filter(Boolean);
 return `${m.inning} 局${m.half?'下':'上'} · ${m.outs} 出局 · ${bases.length?bases.join('、')+'有人':'壘上無人'} · ${score}`;
}
function scene(s,m,sit,profile,football,minute){
 let title=sit.title,body=sit.text;
 if(football){[title,body]=football;
  if(title==='被貼身盯住的夜晚'){title='對手貼住你，隊友正往前跑';body='你背對球門，轉身的空間很小。隊友已經往禁區跑，要自己射，還是傳給他？';}
 }else if(s.sport===2){body=m.mode==='offence'?'球在你手上。自己得分，或把機會交給空檔隊友？':'對手持球逼近。守穩位置，還是搶先出手？';}
 else body=m.mode==='bat'?'輪到你打。拚上壘、拚長打，或把隊友送向下一個壘包。':m.mode==='pitch'?'捕手等著你的暗號。正面對決，還是把球壓在邊角？':'球正朝守備區過來。先抓出局，還是冒險處理跑者？';
 return `<section class="match-scene" aria-label="眼前局面"><div class="match-now">${esc(context(s,m,minute))}</div><h2>${esc(title)}</h2><p>${esc(body)}</p><p class="match-heart">${esc(pulse(s,m))}</p><div class="match-read"><b>場上情報</b><span>${esc(profile.text)}</span></div></section>`;
}
const footballResults={goal:['你進 1 球，球隊 +1','射門被擋，沒有進球'],assist:['隊友進球，你助攻 +1','傳球被截，沒有進球'],save:['撲救 +1，守住這波','被破門，對手 +1'],stop:['擋下進攻，守住這波','防線失守，對手 +1'],build:['成功出球，士氣另 +3','出球受阻，沒能推進'],safe:['穩住隊形，信任 +1','這次不判定成敗，也不額外進球']};
function results(s,c,m){
 if(s.sport===1)return footballResults[c[2]];
 const map={two:['得 2 分','投失，沒有得分'],three:['得 3 分','三分投失'],mid:['得 2 分','投失，沒有得分'],assist:['隊友 +2 分，你助攻 +1','傳球失誤 +1'],contain:['讓對手投失','對手得 2 分'],steal:['抄截 +1，快攻得 2 分','失去位置，對手得 3 分'],block:['阻攻 +1','犯規 +1，對手罰球 2 次'],rebound:['防守籃板 +1','對手補進 2 分'],contact:['一壘安打，跑者前進','擊球出局'],homer:['全壘打，所有跑者得分','揮空三振'],walk:['四壞保送上壘','被三振'],strikeout:['三振打者','被敲一壘安打'],breaking:['三振打者','被敲二壘安打'],ground:['抓到出局，有機會雙殺','四壞保送'],around:['抓到出局','四壞保送'],double:['抓到出局，有機會雙殺','對手敲出安打'],out:['抓到 1 個出局','對手安打，跑者推進'],home:['抓到 1 個出局','對手敲出安打'],dive:['飛撲接殺，信任 +5','被敲二壘安打']};
 if(s.sport===0&&['ground','double'].includes(c.kind))return [root.XZArena.canDoublePlay(m)?'滾地雙殺，取得 2 個出局':'抓到 1 個出局',c.kind==='ground'?'四壞保送':'對手敲出安打'];
 if(c.kind==='bunt')return m.outs<2&&m.bases.some(Boolean)?['犧牲出局，推進跑者','打者出局，跑者不動']:['突襲短打上壘','打者出局'];
 return map[c.kind]||['完成動作','被對手化解'];
}
function card(s,c,i,info,m,D){
 const foot=s.sport===1,safe=info.p===null,kind=foot?c[2]:c.kind,team=foot&&c[4]==='team',label=foot?({'變向後迅速起腳':'轉身射門','背身做球給後插上的隊友':'傳給跑進禁區的隊友','帶開盯防者保留球權':'護住球，重新組織'}[c[0]]||c[0]):c.label;
 const cost=safe?{health:0,morale:0}:D.playCost(s,info.pressure,foot?c[3]<.6:c.energy>=3),energy=safe?0:T.fatigue(s,foot?2:c.energy),effects=[energy?'體力 '+sign(-energy):'',cost.health?'健康 -'+cost.health:'',team?'默契 -3':''].filter(Boolean);
 const [good,bad]=results(s,c,m),opponent=info.parts.find(([name])=>name==='對手')?.[1]||0,read=m.reads?.[foot?kind:c.id]||0;
 return `<button class="choice match-choice" onclick="${foot?'football':'arena'}Moment(${i})" ${team&&s.chemistry<3?'disabled':''}><div class="topline"><strong><span class="choice-letter">${'ABCD'[i]||i+1}</span>${esc(label)}</strong><span class="match-chance">${safe?'確定':Math.round(info.p*100)+'%'}<small>${safe?'不冒險':'成功率'}</small></span></div>${read?'<span class="match-signal warning">對手已看過這招</span>':opponent>=.025?'<span class="match-signal">這招有空間</span>':opponent<=-.04?'<span class="match-signal warning">對手正在防這招</span>':''}<div class="match-branches"><p class="branch-good"><b>${safe?'結果':'成功'}</b><span>${esc(good)}</span></p><p class="branch-bad"><b>${safe?'代價':'失敗'}</b><span>${esc(bad)}</span></p></div><div class="match-cost">${effects.length?'出手消耗：'+effects.join(' · '):'沒有額外體力消耗'}${safe?'':`<small>成功：士氣 +2 · 信任 +${kind==='dive'?5:3}<span>失敗：士氣 -${cost.morale} · 信任 -2</span></small>`}</div>${team&&s.chemistry<3?'<small>默契不足 3，暫時無法使用</small>':''}</button>`;
}
function details(options,infos,foot){return `<details class="focus-more match-math"><summary>成功率怎麼算？</summary>${options.map((c,i)=>`<p><b>${esc(foot?c[0]:c.label)}</b>：${infos[i].p===null?'保守處理，不擲判定':infos[i].parts.filter(([,v])=>Math.abs(v)>=.005).map(([k,v])=>esc(k)+' '+sign(v*100)+' 個百分點').join(' · ')}</p>`).join('')}<small>畫面成功率已包含目前能力、狀態、戰術與對手影響。</small></details>`}
const targets={strikeout:['k',8,'次三振'],slugger:['hr',2,'支全壘打'],hitmaker:['h',3,'支安打'],'ace-twelve':['k',12,'次三振'],'run-driver':['rbi',5,'分打點'],'patient-eye':['bb',3,'次保送'],'hat-trick':['goals',3,'顆進球'],playmaker:['assists',2,'次助攻'],'four-goals':['goals',4,'顆進球'],'chance-weaver':['assists',3,'次助攻'],'last-stand':['saves',7,'次撲救'],scorer:['pts',30,'分'],'floor-general':['ast',10,'次助攻'],rebounder:['reb',15,'個籃板'],'deep-six':['tpm',6,'顆三分'],'sky-lock':['blk',5,'次阻攻'],pickpocket:['stl',5,'次抄截'],'forty-five':['pts',45,'分']};
function chase(s,m){
 const partial=s.sport===1&&!m.player,p=m.player||{goals:m.personalGoal||0,assists:m.personalAssist||0,saves:m.extraSave||0};
 let entries=Object.entries(targets).filter(([id,[key]])=>T.TITLES[id].sport===s.sport&&!s.feats?.titles.some(t=>t.id===id)&&!(s.sport===0&&(s.pos==='投手'?['h','hr','rbi','bb'].includes(key):s.pos!=='二刀流'&&key==='k'))&&!(s.sport===1&&(s.pos==='門將'?key!=='saves':key==='saves')));
 entries.sort((a,b)=>(p[b[1][0]]||0)/b[1][1]-(p[a[1][0]]||0)/a[1][1]);
 const entry=entries[0];if(!entry)return'';
 const [id,[key,target,unit]]=entry,value=p[key]||0,ready=value>=target;
 return `<aside class="match-chase"><span>✦ ${ready?'已碰到稱號門檻':'再向前一步'}</span><b>${esc(T.TITLES[id].name)}</b><strong>${value} / ${target} <small>${unit}</small></strong><div class="chase-track"><i style="width:${Math.min(100,value/target*100)}%"></i></div><small>${partial?'親自決策已累積的數據；終場會合併自動表現。':ready?'終場出賽結算後授予稱號。':'還差 '+(target-value)+' '+unit+'；每場重新累計。'} ${esc(T.description(s,id))}</small></aside>`;
}
function earned(s,m){const gained=(m.earnedTitles||[]).map(id=>`<div class="match-earned ${T.TITLES[id].negative?'is-negative':''}"><b>${T.TITLES[id].negative?'▼ 負面稱號':'✦ 新稱號'} · ${esc(T.TITLES[id].name)}</b><span>${esc(T.description(s,id))}</span></div>`).join(''),cleared=(m.clearedTitles||[]).map(id=>`<div class="match-earned"><b>↗ 擺脫「${esc(T.TITLES[id].name)}」</b><span>能力減益已解除</span></div>`).join('');return gained+cleared}
function result(s,h){
 const own=h.match.home===s.team,foot=s.sport===1,before=h.before,after=h.after;
 if(!before||!after)return `<p>${esc(h.text||h.result)}</p>`;
 const gf=foot?after[own?0:1]-before[own?0:1]:after[0]-before[0],ga=foot?after[own?1:0]-before[own?1:0]:after[1]-before[1];
 let headline=gf>0?`這一球，我方 +${gf} ${foot?'球':'分'}`:ga>0?`這一球，對手 +${ga} ${foot?'球':'分'}`:h.chance===null?'穩住了，比分沒有改變':h.success?'做好了，這一球沒有失分':'這次沒成，比分沒有改變';
 if(s.sport===0&&h.result)headline=h.result.replace(/。$/,'');
 const lines=h.chance===null?['你把節奏慢下來。不是每一個機會，都得用冒險回答。']:h.success?['你還沒來得及喊，隊友已經先替你握起拳頭。','那麼多次練習沒人看見，這次終於有了回聲。','你吐出憋住的那口氣。原來真的做得到。']:['你低頭抹掉汗，隊友拍了拍你的肩。這一球沒做好，你仍是隊裡的一員。','你很想把剛才那一秒重來。可球已經向前，下一步還得自己走。','聲音一下子遠了。你把鞋帶重新拉緊，不讓自己只停在這一球。'];
 return `<div class="match-payoff"><span>剛才這個選擇</span><h3>${esc(headline)}</h3><p>${esc(lines[hash(s.seed+'|'+s.age+'|'+h.match.round+'|'+h.choice)%lines.length])}</p></div>`;
}
const api={pulse,context,scene,results,card,details,chase,earned,result};if(typeof module!=='undefined')module.exports=api;else root.XZMatchStory=api;
})(globalThis);

