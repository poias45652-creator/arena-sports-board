/* Keep the current scene within reach. Presentation only; never reads or writes saves. */
(function(root){
'use strict';
const win=()=>root.window||root;
const visible=node=>node?.getClientRects?.().length>0;

function fit(host){
 const w=win(),doc=root.document,layout=host?.querySelector?.('.focus-layout');
 if(!host?.style||!layout?.style||!w.getComputedStyle)return;
 host.style.zoom='';layout.style.minHeight='';layout.style.height='';
 delete doc.body.dataset.screenFit;
 if(doc.body.dataset.screen!=='game'||!w.matchMedia('(min-width: 1100px)').matches)return;
 const main=host.closest('main'),footer=doc.querySelector('body > footer');
 const mainStyle=w.getComputedStyle(main);
 const top=host.getBoundingClientRect().top+(w.scrollY||0);
 const room=Math.max(1,w.innerHeight-top-(parseFloat(mainStyle.paddingBottom)||0)-(footer?.getBoundingClientRect().height||0)-3);
 // Keep native text size. Long sidebars must never shrink the play area.
 const extra=host.getBoundingClientRect().height-layout.getBoundingClientRect().height;
 layout.style.minHeight='0px';
 layout.style.height=Math.max(0,room-extra)+'px';
 doc.body.dataset.screenFit='desktop';
 w.scrollTo({top:0,behavior:'instant'});
}

let fittingFrame=null;
function scheduleFit(){
 const w=win();
 if(fittingFrame!==null||!w.requestAnimationFrame)return;
 fittingFrame=w.requestAnimationFrame(()=>{fittingFrame=null;fit(root.document.getElementById('game'))});
}
win().addEventListener?.('resize',scheduleFit);
root.document?.addEventListener?.('toggle',event=>{
 if(event.target?.closest?.('#game'))scheduleFit();
},true);

function capture(host){
 const active=root.document?.activeElement;
 return {top:win().scrollY||0,action:host?.contains?.(active)?active.getAttribute('onclick'):null};
}

// Keep the old position when the whole decision already fits. Otherwise move only
// enough to reveal it. Long scenes start at their narrative, never the page header.
function position({top,bottom,current,height,max,padding=24}){
 const room=height-padding*2;
 const next=bottom-top<=room
  ?Math.min(top-padding,Math.max(current,bottom-height+padding))
  :top-padding;
 return Math.max(0,Math.min(max,next));
}

function restore(host,before,{sameScene=false}={}){
 const stage=host?.querySelector?.('.focus-stage'),w=win();
 if(!stage?.getBoundingClientRect||!w.innerHeight)return;
 const all=[...stage.querySelectorAll('button:not([disabled])')].filter(visible);
 // Settings such as training intensity stay at the control just used.
 const previous=sameScene&&before.action
  ?[...host.querySelectorAll('button[onclick]')].find(n=>n.getAttribute('onclick')===before.action&&visible(n))
  :null;
 const scene=stage.querySelector('.match-scene,.story-scene,.match-payoff')||stage;
 const first=previous||scene;
 // Secondary disclosures remain optional; they must not pull the next action offscreen.
 const choices=all.filter(n=>!n.closest('details'));
 const last=previous||choices.at(-1)||scene;
 const y=w.scrollY||0,a=first.getBoundingClientRect(),b=last.getBoundingClientRect();
 const height=w.innerHeight,max=Math.max(0,root.document.documentElement.scrollHeight-height);
 const target=root.document.body?.dataset.screenFit==='desktop'?0:position({top:a.top+y,bottom:Math.max(a.top,b.bottom)+y,current:before.top,height,max});
 // Native dialog focus restoration must return to this scene without scrolling.
 if(!previous){first.setAttribute('tabindex','-1');first.setAttribute('aria-label','目前故事與選擇');}
 first.focus({preventScroll:true});
 // Instant positioning prevents an old smooth scroll from fighting the new scene
 // or its animation. Reduced-motion users get the same stable position.
 w.scrollTo({top:target,behavior:'instant'});
}

const api={capture,position,restore,fit};
if(typeof module!=='undefined')module.exports=api;else root.XZViewport=api;
})(globalThis);

