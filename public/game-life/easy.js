(function(root){
'use strict';
const esc=t=>String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const DIRECTIONS=[
 {id:'growth',name:'衝刺成長',icon:'↗',intensity:'balanced',skill:0,style:'正常特訓',hint:'練強主要專項，挑戰能力成長。'},
 {id:'trust',name:'站穩位置',icon:'◎',intensity:'careful',skill:1,style:'穩健打底',hint:'用較低消耗累積實力，爭取教練信任。'},
 {id:'contend',name:'挑戰前三',icon:'♜',intensity:'push',skill:2,style:'極限突破',hint:'成長點更多，也更耗體力與健康。'},
 {id:'balance',name:'調整身心',icon:'♡',intensity:'careful',skill:null,style:'休息復健',hint:'本季專心休養，恢復健康、心情與士氣。'}
];
function plans(s,E){const skills=E.trainingOptions(s).filter(x=>x.id!=='rest');return DIRECTIONS.map(p=>({...p,training:p.skill===null?{id:'rest',name:'休息復健'}:skills[p.skill%skills.length]}))}
function run(s,id,E){const p=plans(s,E).find(x=>x.id===id);if(!p||s.retired||s.phase!=='train'||s.sessions>=3)return{ok:false,message:'這一季已完成準備，請接續目前的故事。'};
 // Preserve the medical gate, existing partial training and all seeded engine rules.
 if(s.care?.active||s.health<=20||s.mood<=10||s.mood<=25&&s.care?.lowMoodSteps>=3)return E.advance(s);
 let r=E.setPace(s,'quick');if(!r.ok||r.interrupted)return r;
 if(s.sessions===0&&!(s.journey?.goal?.age===s.age&&s.journey.goal.id===id)){r=E.seasonGoal(s,id);if(!r.ok||r.interrupted)return r}
 r=E.trainingIntensity(s,p.intensity);if(!r.ok||r.interrupted)return r;
 return E.seasonTraining(s,p.training.id);
}
function training(s,E){if(s.sessions>=3)return '<h2>準備完成，接下來寫故事。</h2><button class="primary" onclick="advance()">展開本季故事 →</button>';
 const recommended=s.health<60||s.mood<45||s.energy<40?'balance':(s.sport===1?s.football?.trust:s.arena?.trust)<60?'trust':'growth';
 const all=plans(s,E),ordered=['growth','trust','balance','contend'].map(id=>all.find(p=>p.id===id));
 const items=ordered.map(p=>`<button class="easy-plan" data-plan="${p.id}" onclick="easyPlan('${p.id}')"><span class="easy-plan-icon">${p.icon}</span><span class="easy-plan-title">${p.name}${recommended===p.id?'<small>適合目前狀態</small>':''}</span><p>${p.hint}</p><span class="easy-plan-meta">${esc(p.training.name)} · ${p.style}</span><span class="easy-plan-arrow" aria-hidden="true">→</span></button>`);
 return `${root.XZFocus.trainingIntro(s)}<div class="decision-caption"><span>這一季，選一個方向</span><small>目標與訓練，一次完成</small></div>${root.XZFocus.choices(items,'想挑戰更高目標')}<p class="easy-fine">${s.sessions?'已完成的訓練保留，剩下安排一次完成。':'一點安排本季準備，接著展開故事。'}需要照護時，會先停下。</p>`;
}
function step(s){if(s.retired)return 3;if(s.phase==='train')return 0;if(['event','outcome'].includes(s.phase))return 1;if(s.phase==='result'||s.phase==='contract'||s.phase.includes('market'))return 3;return 2}
function flow(s){const index=step(s);return `<nav class="easy-flow" aria-label="每季流程">${['選方向','做選擇','打關鍵戰','看回顧'].map((x,i)=>`<span class="${i===index?'current':i<index?'done':''}" ${i===index?'aria-current="step"':''}><b>${i<index?'✓':i+1}</b>${x}</span>`).join('')}</nav>`}
function status(s,E){return `<div class="easy-status">${[['能力',E.ovr(s),'skill'],['健康',s.health,s.health<=35?'low':'health'],['士氣',s.morale,s.morale<35?'low':'morale'],['心情',s.mood??70,(s.mood??70)<35?'low':'mood']].map(([label,value,kind])=>`<div data-vital="${kind}"><span>${label}</span><b>${Math.round(value)}</b><i style="--fill:${Math.max(0,Math.min(100,value))}%"></i></div>`).join('')}</div>`}
function goal(s,J,E){const g=s.journey?.goal;if(!g||g.age!==s.age||s.care?.active)return'';const def=J.GOALS.find(x=>x.id===g.id),v=J.values(s,g,{ovr:E.ovr}),r=s.journey.results.find(x=>x.age===s.age);let progress=g.id==='growth'?`能力 +${v.growth} / 2`:g.id==='trust'?`信任 ${Math.round(v.trust)} / 65 · ${v.apps} 場出賽`:g.id==='contend'?J.season(s)?.round?`目前第 ${v.rank} 名`:'尚未開季':`健康 ${Math.round(v.health)} / 65 · 心情 ${Math.round(v.mood)} / 55`;
 return `<div class="easy-goal"><b>${r?(r.success?'✦ 達成':'◇ 下季再挑戰'):def.icon+' 本季目標'} · ${def.name}</b><span>${r?(r.success?def.prize:'未達成不扣數值'):progress}</span></div>`;
}
function contracts(s){return `<div class="easy-kicker">下一站，由你決定</div><h2>看角色、薪水和年限，選一份合約。</h2><p class="easy-intro">${s.sport===1?'租借保留母隊合約，踢完一季會自動歸隊。':'想談薪或調整合約，可在選單開啟手動調整。'}</p><div class="easy-contracts">${s.offers.map((o,i)=>`<button class="easy-contract" onclick="contract(${i})"><span>${o.kind==='stay'?'保留原合約':o.scouted?'球探特別邀約':o.kind==='loan'?'租借機會':o.team===s.team?'原隊續約':'新球隊邀請'}</span><h3>${esc(o.team)}</h3><p>${esc(XZLeagues.label(s,o))} · 強度 ${o.power??"—"}</p><p>${esc(o.role)} · 適應 ${o.fit} / 100</p><b>${Number(o.salary).toLocaleString('zh-TW')} <small>萬／年</small></b><strong>${o.years} 年${o.kind==='loan'?'租借':'合約'}</strong><em>接受邀請 →</em></button>`).join('')}</div>${s.phase.includes('market')?`<button class="ghost" onclick="${s.sport===1?'football':'arena'}MarketClose()">先留在原隊</button>`:''}`}
const api={DIRECTIONS,plans,run,training,flow,status,goal,contracts};if(typeof module!=='undefined')module.exports=api;else root.XZEasy=api;
})(globalThis);
