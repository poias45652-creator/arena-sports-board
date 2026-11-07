// The document and its member shell share an origin. Never send match or account data to an external embedder.
const embedded=window.parent!==window&&!!window.frameElement;
const origin=location.origin;
function send(type,data={}){
  if(embedded)window.parent.postMessage({type,...data},origin);
}
export function syncLocation(){send('basketball-route',{search:location.search,hash:location.hash});}
export function scrollBoardTop(){send('basketball-scroll');}
export function publishRecommendations(state){
  const panel=document.querySelector('.xz-parlay');
  const rows=panel?[...panel.querySelectorAll('.leg')].map(row=>({label:row.textContent.trim(),selected:!!row.querySelector('input')?.checked})):[];
  send('basketball-picks',{active:!!panel,date:state.date,rows});
}
const body=document.body, main=document.querySelector('main.nba-board'),dialog=document.getElementById('modal');
function fitDialog(){
  if(!embedded||!dialog.open)return;
  const frame=window.frameElement.getBoundingClientRect();
  const top=Math.max(0,-frame.top+72),bottom=Math.min(frame.height,parent.innerHeight-frame.top);
  const room=Math.max(120,bottom-top-20);
  dialog.style.setProperty('--dialog-height',room+'px');
  dialog.style.setProperty('--dialog-top',Math.max(top+8,top+(room-dialog.offsetHeight)/2)+'px');
}
function size(){
  if(embedded)send('basketball-size',{height:Math.ceil(main.getBoundingClientRect().height)+2});
  fitDialog();
}
new ResizeObserver(size).observe(main);
new MutationObserver(fitDialog).observe(dialog,{attributes:true,attributeFilter:['open'],childList:true});
if(embedded){
  parent.addEventListener('scroll',fitDialog,{passive:true});parent.addEventListener('resize',fitDialog);
  window.addEventListener('pagehide',()=>{parent.removeEventListener('scroll',fitDialog);parent.removeEventListener('resize',fitDialog);});
}
const restricted='[data-ask],[data-weights],[data-assistant],[data-rankrefresh],[data-detailrefresh],[data-refresh],[data-weight],[data-applyweights],[data-resetweights],[data-leg],#weight-target';
if(body.dataset.viewer==='true'){
  for(const type of ['click','change','input','keydown'])document.addEventListener(type,event=>{
    if(event.target instanceof Element&&event.target.closest(restricted)){event.preventDefault();event.stopImmediatePropagation();}
  },true);
}
window.addEventListener('message',event=>{
  if(!embedded||event.origin!==origin||event.source!==parent)return;
  if(event.data?.type==='basketball-history'){
    const search=event.data.search,hash=event.data.hash||'';
    if(typeof search!=='string'||!search.startsWith('?')||new URLSearchParams(search).get('league')!==new URLSearchParams(location.search).get('league'))return;
    if(search+hash!==location.search+location.hash){
      window.history.replaceState(null,'',location.pathname+search+hash);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
    return;
  }
  if(body.dataset.viewer==='true')return;
  if(event.data?.type==='basketball-refresh')document.querySelector('[data-refresh]')?.click();
  if(event.data?.type==='basketball-assistant')document.querySelector('[data-assistant]')?.click();
});
// Plain links from historical box scores also use the member page for bookmarks and new tabs.
document.addEventListener('click',event=>{
  const link=event.target.closest('a[href^="?"]');
  if(!link||event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;
  const url=new URL(link.href);
  if(url.origin!==origin)return;
  event.preventDefault();
  if(location.search+location.hash===url.search+url.hash)return;
  history.replaceState(null,'',url.href);
  syncLocation();
  window.dispatchEvent(new PopStateEvent('popstate'));
  scrollBoardTop();
});
