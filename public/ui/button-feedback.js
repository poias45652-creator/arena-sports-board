(function(root){
 'use strict';
 if(root.XZButtonFeedback||!root.document)return;
 const doc=root.document;
 const controls='button,input[type="button"],input[type="submit"],input[type="reset"],[role="button"],[role="tab"],[role="menuitem"],[data-slot="button"],summary,a.header-action,a.admin-refresh,a.trial-login,a.nba-back,a.ghost,a.primary,a.btn,a.button,.game-toolbar a';
 function pulse(event){
  const button=event.target?.closest?.(controls);
  if(!button||button.matches(':disabled,[disabled],[aria-disabled="true"],[data-disabled],[aria-busy="true"]')||button.closest('[inert]'))return;
  if(root.matchMedia?.('(prefers-reduced-motion: reduce)').matches||root.XZFeedback?.isEnabled?.()===false)return;
  const rect=button.getBoundingClientRect();if(!rect.width||!rect.height)return;
  const style=root.getComputedStyle(button),layer=doc.createElement('span'),wave=doc.createElement('i');
  layer.className='xz-control-burst';layer.setAttribute('aria-hidden','true');
  const dialog=button.closest('dialog[open]'),host=dialog||doc.body,origin=dialog?.getBoundingClientRect();
  Object.assign(layer.style,{position:dialog?'absolute':'fixed',left:(rect.left-(origin?.left||0)+(dialog?dialog.scrollLeft-dialog.clientLeft:0))+'px',top:(rect.top-(origin?.top||0)+(dialog?dialog.scrollTop-dialog.clientTop:0))+'px',width:rect.width+'px',height:rect.height+'px',borderRadius:style.borderRadius||'8px'});
  const size=Math.max(rect.width,rect.height)*2.2,keyboard=event.type==='click';
  Object.assign(wave.style,{width:size+'px',height:size+'px',left:(keyboard?rect.width/2:Math.max(0,Math.min(rect.width,event.clientX-rect.left)))+'px',top:(keyboard?rect.height/2:Math.max(0,Math.min(rect.height,event.clientY-rect.top)))+'px'});
  layer.appendChild(wave);host.appendChild(layer);
  const layers=doc.querySelectorAll('.xz-control-burst');for(let i=0;i<layers.length-4;i++)layers[i].remove();
  root.setTimeout(()=>layer.remove(),650);
  if(event.isTrusted&&event.pointerType==='touch'&&typeof root.navigator?.vibrate==='function'){
   try{root.navigator.vibrate(12);}catch{/* Unsupported haptics never interrupt a click. */}
  }
 }
 // Capture gives immediate feedback even when a click replaces the whole view.
 // Never prevent, dispatch, delay or stop a site's original action.
 doc.addEventListener('pointerdown',event=>{if(event.button===0&&event.isPrimary!==false)pulse(event);},true);
 doc.addEventListener('click',event=>{if(event.detail===0)pulse(event);},true);
 root.XZButtonFeedback={version:1};
})(globalThis);
