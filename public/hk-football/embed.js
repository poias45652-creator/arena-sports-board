if(window.parent!==window){
  document.body.classList.add('embedded-board');
  let last=0;
  function report(){
    const height=document.body.getBoundingClientRect().height;
    if(last!==height){
      last=height;
      window.parent.postMessage({type:'hk-football-height',height},location.origin);
    }
  }
  new ResizeObserver(report).observe(document.body);
  report();
}
