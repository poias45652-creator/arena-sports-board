(function(root){
'use strict';
let mounted=false,enabled=true,lastPointer=0;
function decorate(scope){if(!scope?.querySelectorAll)return;for(const el of scope.querySelectorAll('.risk-tag')){const text=el.textContent.trim(),match=text.match(/^(\d{1,3})%$/);if(!match)continue;const p=Math.max(0,Math.min(100,+match[1]));el.classList.add('chance-ring');el.style.setProperty('--chance',p+'%');el.dataset.risk=p<45?'high':p>=70?'low':'normal';el.setAttribute('aria-label','成功率 '+p+'%')}}
function pulse(button,event){if(!enabled||!button||button.disabled||button.getAttribute('aria-disabled')==='true')return;const reduced=root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;if(reduced)return;
 const rect=button.getBoundingClientRect(),x=event.detail===0?rect.left+rect.width/2:event.clientX,y=event.detail===0?rect.top+rect.height/2:event.clientY;
 // Effects live outside re-rendered cards and never dispatch or defer a game action.
 const doc=root.document,layer=doc.createElement('span');layer.className='touch-burst';layer.setAttribute('aria-hidden','true');layer.style.left=x+'px';layer.style.top=y+'px';layer.innerHTML='<i></i>'+Array.from({length:6},(_,i)=>`<b style="--angle:${i*60}deg"></b>`).join('');
 (button.closest('dialog[open]')||doc.body).appendChild(layer);while(doc.querySelectorAll('.touch-burst').length>4)doc.querySelector('.touch-burst')?.remove();root.setTimeout(()=>layer.remove(),650);
 try{root.navigator?.vibrate?.(8)}catch{}
}
function mount(){if(mounted||!root.document?.addEventListener)return;mounted=true;try{enabled=root.localStorage.getItem('xingzhun-touch-v1')!=='off'}catch{}
 if(root.XZButtonFeedback)return;
 root.document.addEventListener('pointerdown',e=>{if(e.button!==0||e.isPrimary===false)return;const button=e.target.closest?.('button,summary');if(!button)return;lastPointer=Date.now();pulse(button,{clientX:e.clientX,clientY:e.clientY,detail:1})},true);
 root.document.addEventListener('click',e=>{if(e.detail===0&&Date.now()-lastPointer>200)pulse(e.target.closest?.('button,summary'),e)},true);
}
function toggle(){enabled=!enabled;try{root.localStorage.setItem('xingzhun-touch-v1',enabled?'on':'off')}catch{}return enabled}
const api={decorate,mount,toggle,isEnabled:()=>enabled};if(typeof module!=='undefined')module.exports=api;else root.XZFeedback=api;
})(globalThis);
