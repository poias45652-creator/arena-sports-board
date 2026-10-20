(function(root){
'use strict';
const familyUI=typeof module!=='undefined'?require('./family-ui.js'):null;
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const hub=s=>s.sport===1?s.football:s.arena;
// Presentation snapshots never add fields to a career or consume its seeded RNG.
function snapshot(s){if(!s)return null;const h=hub(s),a=s.care?.active;return{
 care:a?{kind:a.kind,stage:a.stage,left:a.left}:null,surgeries:s.care?.surgeries||0,counseling:s.care?.counseling||0,
 careerEvents:s.careerEvents||0,majorInjuries:s.majorInjuries||0,cups:s.cups||0,titles:h?.national?.titles||0,transfers:h?.transfers?.length||0,
 nationalOffer:h?.nationalOffer?JSON.stringify(h.nationalOffer):null,retired:!!s.retired,reason:s.reason,familyStage:s.family?.stage||null,romanceCount:s.romance?.history.length||0,signatures:(typeof module!=='undefined'?require('./feats.js'):root.XZFeats).signatures(s).filter(t=>t.active).map(t=>t.id),feats:(s.feats?.titles||[]).map(t=>t.id),awakening:s.feats?.awakening?.active?s.feats.awakening.key:null
}}
function detect(before,s){if(!before||!s)return[];const now=snapshot(s),h=hub(s),events=[];
 const add=(kind,title,detail)=>events.push({kind,title,detail,player:s.name,age:s.age});
 if(s.outcome?.major&&now.careerEvents>before.careerEvents)add(s.outcome.success?'awakening':'injury',s.outcome.success?'跨過極限，熟悉的自己變了。':'這次賭注，留下沉重的代價。',s.outcome.detail);
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
 if(now.awakening&&now.awakening!==before.awakening)add('awakening','突然開竅，世界慢了一拍。','那些練過千百次的動作，忽然全部接上了。本場剩餘時間全專項 +25，最高 99；終場恢復原本能力。');
 const feats=typeof module!=='undefined'?require('./feats.js'):root.XZFeats;
 const newSignatures=feats.signatures(s).filter(t=>t.active&&!(before.signatures||[]).includes(t.id));if(newSignatures.length)add('title','苦練，成了你的招牌。',newSignatures.map(t=>'「'+t.name+'」 '+t.effect).join('；')+'。對應專項關鍵動作另 +3 個百分點，能力低於 65 暫停。');
 const gained=now.feats.filter(id=>!before.feats.includes(id));if(gained.length)add('title','這一場，把名字打進紀錄。',gained.map(id=>'「'+feats.TITLES[id].name+'」 '+feats.description(s,id)).join('；')+'。本生涯持續生效，同名不重複疊加。');
 if(now.romanceCount>before.romanceCount){const r=s.romance.history.at(-1);add(r.mood<0?'heartbreak':'romance',s.outcome?.title||'愛情的另一頁',s.outcome?.narrative||'你們的故事，留下新的痕跡。');}
 if(now.familyStage!==before.familyStage){
  if(now.familyStage==='dating')add('romance','在球場以外，也有人選擇你。',`你和${s.family.partner}確認彼此的心意。從今天起，不只分享勝利，也一起走過普通的日子。`);
  if(now.familyStage==='married')add('wedding','往後的日子，我們是一隊。',`你和${s.family.partner}交換誓言。掌聲響起的時候，她握緊了你的手。`);
  if(now.familyStage==='parent')add('birth',`你好，${s.family.child.name}。我是爸爸。`,'小小的手握住你的手指。從這一刻起，你想守護的夢，多了一個。');
 }
 if(now.retired&&(!before.retired||before.reason==='chapter'&&now.reason!=='chapter')){if(s.reason==='chapter')add('ending','八季走過，這一篇屬於你。','可以繼續球員生涯，或正式引退，讓下一段人生開始。');else events.push((familyUI||root.XZFamilyUI).farewell(s));}
 return events;
}
const art={
 heartbreak:'<path class="moment-heart-left" d="M171 184C70 124 110 52 153 76l22 28-19 26 22 23z"/><path class="moment-heart-right" d="M189 184c101-60 61-132 18-108l-22 28 19 26-22 23z"/><path class="moment-rays" d="M89 202l-12 12m194-12 12 12M180 38V18"/>',
 awakening:'<circle class="moment-breath" cx="180" cy="125" r="80"/><circle class="moment-breath two" cx="180" cy="125" r="58"/><path class="moment-spark moment-filled" d="m192 35-57 102h41l-8 78 57-112h-43z"/><path class="moment-rays" d="m180 9 0 12m-98 33 16 13m164-13-16 13M60 125h21m198 0h21M82 205l16-13m164 13-16-13"/>',
 title:'<circle class="moment-ring" cx="180" cy="122" r="62"/><path class="moment-star" d="m180 72 14 30 33 5-24 23 6 33-29-16-29 16 6-33-24-23 33-5z"/><path class="moment-filled" d="m143 173-17 59 34-15 20 21 20-21 34 15-17-59"/>',
 romance:'<path class="moment-family-heart" d="M180 184C70 124 110 52 153 76q18 7 27 26 9-19 27-26c43-24 83 48-27 108z"/><path class="moment-connect" d="M76 200q104 22 208 0"/>',
 wedding:'<circle class="moment-ring" cx="150" cy="144" r="47"/><circle class="moment-ring two" cx="210" cy="144" r="47"/><path class="moment-star" d="m180 37 10 22 24 4-17 17 4 24-21-12-21 12 4-24-17-17 24-4z"/><path class="moment-rays" d="m85 66 12 12m178-12-12 12M180 13v12"/>',
 birth:'<g class="moment-cradle"><path class="moment-filled" d="M99 137h162q-5 66-81 66t-81-66z"/><path d="M99 137V83q0-38 48-38v92M89 214q91 34 182 0M137 194l-12 27m98-27 12 27"/><circle cx="180" cy="124" r="22"/><path d="M169 127q11 12 22 0"/></g><path class="moment-star" d="m245 40 5 12 13 2-10 9 3 13-11-6-11 6 3-13-10-9 13-2z"/>',
 retirement:'<path class="moment-beam" d="m125 0-90 228h290L235 0z"/><path class="moment-floor" d="M56 222h248"/><path class="moment-jersey moment-filled" d="m151 45-36 15-19 37 25 13 18-21v79h82V89l18 21 25-13-19-37-36-15q-29 23-58 0z"/><text class="moment-retire-number" x="180" y="132">{{number}}</text><g class="moment-farewell-player"><circle cx="180" cy="181" r="8"/><path d="M180 189v19m0-11-13 6m13-6 13 6m-13 5-8 16m8-16 8 16"/></g><path class="moment-rays" d="M67 79l19 5m207-5-19 5m-26-58-10 16M112 26l10 16"/>',
 legacy:'<path class="moment-path" d="M95 224l55-87m115 87-55-87"/><g class="moment-return"><circle cx="149" cy="99" r="17"/><path d="M149 116v53m0-32-27 19m27-19 34 20m-34 12-16 48m16-48 16 48"/><circle cx="216" cy="132" r="12"/><path d="M216 144v38m0-28-33 3m33-3 18 15m-18 13-12 35m12-35 12 35"/></g><path class="moment-star" d="m180 23 6 15 16 2-12 11 3 16-13-8-13 8 3-16-12-11 16-2z"/>',
 medical:'<g class="moment-lamp"><path d="M180 20v28m-54 16 20-16h68l20 16z"/><path class="moment-beam" d="m128 67-58 120h220L232 67"/></g><rect x="83" y="111" width="194" height="95" rx="16"/><path class="moment-ecg" d="M96 161h40l10-23 16 46 19-64 18 41h65"/><path d="M100 208v12m160-12v12"/>',
 mental:'<circle class="moment-breath" cx="180" cy="121" r="75"/><circle class="moment-breath two" cx="180" cy="121" r="52"/><path class="moment-seat" d="M119 197v-47h44v47m-20-47v-25m54 72v-47h44v47m-22-47v-25"/><circle cx="143" cy="108" r="13"/><circle cx="219" cy="108" r="13"/><path class="moment-connect" d="M162 120q18-20 38 0M163 180h34"/>',
 champion:'<g class="moment-trophy"><path class="moment-filled" d="M136 62h88v49c0 38-20 54-44 54s-44-16-44-54z"/><path d="M136 74h-31v22q0 32 43 35m76-57h31v22q0 32-43 35m-32 34v30m-30 0h60l12 18h-84z"/><path class="moment-star" d="m180 83 5 12 13 1-10 9 3 13-11-7-11 7 3-13-10-9 13-1z"/></g><path class="moment-floor" d="M92 221h176"/>',
 contract:'<g class="moment-paper"><rect x="105" y="37" width="150" height="181" rx="9"/><path d="M127 68h52m-52 25h106m-106 20h106m-106 20h70"/><path class="moment-signature" d="M127 181q12-40 15-11t22-2q4-18 7-3t35 1"/></g><g class="moment-pen"><path class="moment-filled" d="m234 126 11 9-47 58-16 6 3-16z"/></g>',
 national:'<path class="moment-jersey moment-filled" d="m151 66-43 16-24 50 36 17 14-28v90h92v-90l14 28 36-17-24-50-43-16q-29 28-58 0z"/><path class="moment-star" d="m180 109 9 19 21 3-15 15 3 21-18-10-18 10 3-21-15-15 21-3z"/><path class="moment-rays" d="m180 20 0 19m-76 6 13 14m139-14-13 14M67 99l19 5m207-5-19 5"/>',
 injury:'<path class="moment-floor" d="M80 219h200"/><g class="moment-athlete"><circle cx="182" cy="62" r="17"/><path d="m178 81-13 59 39 28-5 42m-34-70-31 36-6 35m42-108-30 23-26-11m60-28 28 32 28 4"/></g><circle class="moment-injury-ring" cx="204" cy="168" r="30"/><path d="M200 153v20m0 9v1"/>',
 recovery:'<path class="moment-tunnel" d="M80 219V86q0-65 100-65t100 65v133M110 219V92q0-44 70-44t70 44v127"/><path class="moment-path" d="M143 220l23-48m51 48-23-48"/><g class="moment-return"><circle cx="180" cy="111" r="14"/><path d="M180 126v44m0-29-24 18m24-18 24 18m-24 11-18 43m18-43 18 43"/></g>',
 ending:'<g class="moment-book"><path class="moment-filled" d="M180 74q-55-30-112-14v134q57-16 112 14 55-30 112-14V60q-57-16-112 14z"/><path d="M180 74v134M90 91q38-5 68 10M90 119q38-5 68 10M90 147q38-5 68 10m44-46q30-15 68-10m-68 38q30-15 68-10m-68 38q30-15 68-10"/></g><path class="moment-star" d="m180 17 5 13 14 1-11 9 3 14-11-8-11 8 3-14-11-9 14-1z"/>'
};
function markup(events,replay=false){const e=events[0],isPlay=e.kind==='play',scene=e.kind==='surgery'?'medical':e.kind==='support'?'mental':e.kind;
 return `<div class="moment-scene" data-kind="${esc(e.kind)}"><div class="moment-top"><span>星準 · ${isPlay?'球場瞬間':'重大時刻'}</span><button type="button" class="moment-skip">${replay?'關閉回顧':'跳過動畫'} <span aria-hidden="true">×</span></button></div>${isPlay?root.XZPlays.scene(e):`<div class="moment-visual" aria-hidden="true"><div class="moment-halo"></div>${['champion','wedding','retirement','legacy'].includes(e.kind)?Array.from({length:24},(_,i)=>`<i class="moment-confetti" style="--i:${i};--x:${3+(i*17)%94}%"></i>`).join(''):''}<svg viewBox="0 0 360 250" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${(art[scene]||art.ending).replace('{{number}}',esc(e.number||7))}</svg></div>`}<div class="moment-copy"><span class="moment-byline">${esc(e.player)} · ${esc(e.age)} 歲</span><h2 id="major-moment-title">${esc(e.title)}</h2><p id="major-moment-description">${esc(e.detail)}</p>${events.length>1?`<ul class="moment-also">${events.slice(1).map(x=>`<li>${esc(x.title)} <span>${esc(x.detail)}</span></li>`).join('')}</ul>`:''}</div><div class="moment-bottom"><span>${replay?'重播不影響遊戲進度':isPlay?'約 3 秒後回到遊戲 · 可隨時跳過':'約 3 秒後回到遊戲 · 可隨時跳過'}</span><button type="button" class="moment-continue">回到遊戲 →</button></div>${replay?'':'<div class="moment-timer" aria-hidden="true"></div>'}</div>`;
}
let dialog=null,timer=null,focusTarget=null,continuation=null;
function close(){continuation=null;if(timer!==null)root.clearTimeout(timer);timer=null;if(!dialog?.open)return;dialog.close();const target=focusTarget?.isConnected?focusTarget:root.document.querySelector('.stage button:not([disabled])');target?.focus({preventScroll:true});}
function finish(){const next=continuation;close();if(next?.length)play(next)}
function play(events,options={}){if(!events?.length)return;close();const doc=root.document;if(!dialog){dialog=doc.createElement('dialog');dialog.id='major-moment';dialog.className='major-moment';dialog.setAttribute('aria-labelledby','major-moment-title');dialog.setAttribute('aria-describedby','major-moment-description');dialog.addEventListener('cancel',e=>{e.preventDefault();finish()});dialog.addEventListener('click',e=>{if(e.target===dialog||e.target.closest('.moment-skip,.moment-continue'))finish()});doc.body.appendChild(dialog)}focusTarget=doc.activeElement;const isPlay=events[0].kind==='play';continuation=isPlay&&events.length>1?events.slice(1):null;dialog.innerHTML=markup(isPlay?events.slice(0,1):events,options.replay);dialog.showModal();dialog.querySelector('.moment-skip').focus({preventScroll:true});if(!options.replay)timer=root.setTimeout(finish,isPlay?2600:3400);}
const api={snapshot,detect,markup,play,close};if(typeof module!=='undefined')module.exports=api;else root.XZMoments=api;
})(globalThis);
