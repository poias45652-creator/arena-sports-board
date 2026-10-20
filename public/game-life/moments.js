(function(root){
'use strict';
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hub=s=>s.sport===1?s.football:s.arena;
// Presentation snapshots never add fields to a career or consume its seeded RNG.
function snapshot(s){if(!s)return null;const h=hub(s),a=s.care?.active;return{
 care:a?{kind:a.kind,stage:a.stage,left:a.left}:null,surgeries:s.care?.surgeries||0,counseling:s.care?.counseling||0,
 majorInjuries:s.majorInjuries||0,cups:s.cups||0,titles:h?.national?.titles||0,transfers:h?.transfers?.length||0,
 nationalOffer:h?.nationalOffer?JSON.stringify(h.nationalOffer):null,retired:!!s.retired
}}
function detect(before,s){if(!before||!s)return[];const now=snapshot(s),h=hub(s),events=[];
 const add=(kind,title,detail)=>events.push({kind,title,detail,player:s.name,age:s.age});
 const newCare=now.care?.stage==='decision'&&(!before.care||before.care.kind!==now.care.kind);
 if(newCare){if(now.care.kind==='surgery')add('medical','醫療暫停，先守住未來。','健康進入危險範圍，醫療團隊已暫停訓練與競賽，接著選擇手術及復健安排。');else add('mental','這一次，不用獨自撐著。','球隊陪你接受專業心理評估，接著一起安排照護與休息。');}
 if(now.surgeries>before.surgeries)add('surgery','手術完成，回場從今天開始。','接下來按計畫復健；原本的賽季進度已保留。');
 if(now.counseling>before.counseling)add('support','有人陪你，慢慢找回節奏。','專業照護計畫已開始，先照顧自己，再一步步回到球場。');
 if(before.care?.stage==='recovery'&&before.care.left===1&&(!now.care||now.care.kind!==before.care.kind))add('recovery',before.care.kind==='surgery'?'通過復健評估，準備回到球場。':'這一階段的照護，完成了。',before.care.kind==='surgery'?'接續原本生涯，本季仍依照保護性出場安排。':'狀態有所改善，持續追蹤，也把休息留在生活裡。');
 if(now.majorInjuries>before.majorInjuries&&!newCare&&now.surgeries===before.surgeries)add('injury','哨聲響起，這一刻先停下。','重大傷勢已影響本季安排。留意健康，讓復健成為下一步。');
 if(now.titles>before.titles)add('champion','把冠軍，帶回家。',`${s.country}贏得${h.nationalResult?.competition||h.nationalResult?.title||'國際賽冠軍'}，榮譽已寫入生涯。`);
 if(now.cups>before.cups)add('champion','終場哨響，你們是冠軍。',`${h.season?.team||s.team}站上頂點，這一季值得被記住。`);
 if(now.transfers>before.transfers){const t=h.transfers[0];add('contract',t.kind==='loan'?'新的球衣，新的挑戰。':t.from===t.to?'故事，繼續留在這裡。':'落筆這一刻，下一站確定。',t.kind==='loan'?`租借加盟${t.to}，母隊合約與薪資保留。`:`${t.to} · ${t.years} 年合約 · 年薪 ${Number(t.salary).toLocaleString('zh-TW')} 萬`);}
 if(now.nationalOffer&&now.nationalOffer!==before.nationalOffer)add('national','國家隊，叫到你的名字。',`${s.country}的${h.nationalOffer.competition}徵召已送達，是否出征由你決定。`);
 if(!before.retired&&now.retired)add('ending',s.reason==='chapter'?'八季走過，這一篇屬於你。':'球員生涯落幕，故事留下。',s.reason==='chapter'?'查看這段旅程的結局，也能延續同一位球員繼續挑戰。':`${s.history.length} 季的努力與選擇，現在寫進你的生涯回顧。`);
 return events;
}
const art={
 medical:'<g class="moment-lamp"><path d="M180 20v28m-54 16 20-16h68l20 16z"/><path class="moment-beam" d="m128 67-58 120h220L232 67"/></g><rect x="83" y="111" width="194" height="95" rx="16"/><path class="moment-ecg" d="M96 161h40l10-23 16 46 19-64 18 41h65"/><path d="M100 208v12m160-12v12"/>',
 mental:'<circle class="moment-breath" cx="180" cy="121" r="75"/><circle class="moment-breath two" cx="180" cy="121" r="52"/><path class="moment-seat" d="M119 197v-47h44v47m-20-47v-25m54 72v-47h44v47m-22-47v-25"/><circle cx="143" cy="108" r="13"/><circle cx="219" cy="108" r="13"/><path class="moment-connect" d="M162 120q18-20 38 0M163 180h34"/>',
 champion:'<g class="moment-trophy"><path class="moment-filled" d="M136 62h88v49c0 38-20 54-44 54s-44-16-44-54z"/><path d="M136 74h-31v22q0 32 43 35m76-57h31v22q0 32-43 35m-32 34v30m-30 0h60l12 18h-84z"/><path class="moment-star" d="m180 83 5 12 13 1-10 9 3 13-11-7-11 7 3-13-10-9 13-1z"/></g><path class="moment-floor" d="M92 221h176"/>',
 contract:'<g class="moment-paper"><rect x="105" y="37" width="150" height="181" rx="9"/><path d="M127 68h52m-52 25h106m-106 20h106m-106 20h70"/><path class="moment-signature" d="M127 181q12-40 15-11t22-2q4-18 7-3t35 1"/></g><g class="moment-pen"><path class="moment-filled" d="m234 126 11 9-47 58-16 6 3-16z"/></g>',
 national:'<path class="moment-jersey moment-filled" d="m151 66-43 16-24 50 36 17 14-28v90h92v-90l14 28 36-17-24-50-43-16q-29 28-58 0z"/><path class="moment-star" d="m180 109 9 19 21 3-15 15 3 21-18-10-18 10 3-21-15-15 21-3z"/><path class="moment-rays" d="m180 20 0 19m-76 6 13 14m139-14-13 14M67 99l19 5m207-5-19 5"/>',
 injury:'<path class="moment-floor" d="M80 219h200"/><g class="moment-athlete"><circle cx="182" cy="62" r="17"/><path d="m178 81-13 59 39 28-5 42m-34-70-31 36-6 35m42-108-30 23-26-11m60-28 28 32 28 4"/></g><circle class="moment-injury-ring" cx="204" cy="168" r="30"/><path d="M200 153v20m0 9v1"/>',
 recovery:'<path class="moment-tunnel" d="M80 219V86q0-65 100-65t100 65v133M110 219V92q0-44 70-44t70 44v127"/><path class="moment-path" d="M143 220l23-48m51 48-23-48"/><g class="moment-return"><circle cx="180" cy="111" r="14"/><path d="M180 126v44m0-29-24 18m24-18 24 18m-24 11-18 43m18-43 18 43"/></g>',
 ending:'<g class="moment-book"><path class="moment-filled" d="M180 74q-55-30-112-14v134q57-16 112 14 55-30 112-14V60q-57-16-112 14z"/><path d="M180 74v134M90 91q38-5 68 10M90 119q38-5 68 10M90 147q38-5 68 10m44-46q30-15 68-10m-68 38q30-15 68-10m-68 38q30-15 68-10"/></g><path class="moment-star" d="m180 17 5 13 14 1-11 9 3 14-11-8-11 8 3-14-11-9 14-1z"/>'
};
function markup(events,replay=false){const e=events[0],scene=e.kind==='surgery'?'medical':e.kind==='support'?'mental':e.kind;
 return `<div class="moment-scene" data-kind="${esc(e.kind)}"><div class="moment-top"><span>星準 · 重大時刻</span><button type="button" class="moment-skip">${replay?'關閉回顧':'跳過動畫'} <span aria-hidden="true">×</span></button></div><div class="moment-visual" aria-hidden="true"><div class="moment-halo"></div>${e.kind==='champion'?Array.from({length:24},(_,i)=>`<i class="moment-confetti" style="--i:${i};--x:${3+(i*17)%94}%"></i>`).join(''):''}<svg viewBox="0 0 360 250" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${art[scene]||art.ending}</svg></div><div class="moment-copy"><span class="moment-byline">${esc(e.player)} · ${esc(e.age)} 歲</span><h2 id="major-moment-title">${esc(e.title)}</h2><p id="major-moment-description">${esc(e.detail)}</p>${events.length>1?`<ul class="moment-also">${events.slice(1).map(x=>`<li>${esc(x.title)} <span>${esc(x.detail)}</span></li>`).join('')}</ul>`:''}</div><div class="moment-bottom"><span>${replay?'重播不影響遊戲進度':'約 3 秒後回到遊戲 · 可隨時跳過'}</span><button type="button" class="moment-continue">回到遊戲 →</button></div>${replay?'':'<div class="moment-timer" aria-hidden="true"></div>'}</div>`;
}
let dialog=null,timer=null,focusTarget=null;
function close(){if(timer!==null)root.clearTimeout(timer);timer=null;if(!dialog?.open)return;dialog.close();const target=focusTarget?.isConnected?focusTarget:root.document.querySelector('.stage button:not([disabled])');target?.focus({preventScroll:true});}
function play(events,options={}){if(!events?.length)return;close();const doc=root.document;if(!dialog){dialog=doc.createElement('dialog');dialog.id='major-moment';dialog.className='major-moment';dialog.setAttribute('aria-labelledby','major-moment-title');dialog.setAttribute('aria-describedby','major-moment-description');dialog.addEventListener('cancel',e=>{e.preventDefault();close()});dialog.addEventListener('click',e=>{if(e.target===dialog||e.target.closest('.moment-skip,.moment-continue'))close()});doc.body.appendChild(dialog)}focusTarget=doc.activeElement;dialog.innerHTML=markup(events,options.replay);dialog.showModal();dialog.querySelector('.moment-skip').focus({preventScroll:true});if(!options.replay)timer=root.setTimeout(close,3400);}
const api={snapshot,detect,markup,play,close};if(typeof module!=='undefined')module.exports=api;else root.XZMoments=api;
})(globalThis);
