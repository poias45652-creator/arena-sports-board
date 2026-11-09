// Run inside the current DG game document. Its native account connection signs
// and sends its own read-only today-report command. Only totals leave the frame.
(() => {
  'use strict';
  const script = document.currentScript;
  const home = script?.dataset.home, channel = script?.dataset.channel;
  if (self.origin !== 'null' || parent === window || !home || !channel) return;
  // Both sizes are used by DG. Pick a different size from this platform's
  // native report UI so the two readers can recognize their own responses.
  const pageSize = script.dataset.platform === 'ddnewwap' ? 12 : 8;
  const day = () => new Date(Date.now() + 8 * 3600000).toISOString().slice(0,10);
  const post = (kind, data = {}) => parent.postMessage({type:'xz-dg-account-v1',channel,kind,...data},home);
  let authorized = false, binding = null, cycle = null, nextRead = 0, manualUntil = 0;
  let lastStatus = '';
  function status(text) {
    if (text !== lastStatus) {lastStatus=text; post('status',{text});}
  }
  function retry(message) {
    cycle=null; nextRead=Date.now()+6000; status(message);
  }
  function locateManager() {
    const stage=window.Laya?.stage;
    if (!stage) return null;
    const nodes=[stage];
    for (let i=0; i<nodes.length && i<600; i++) {
      const node=nodes[i], manager=node?.playerInfo?.socketMan;
      if (manager?.socket?.connected && typeof manager.sendData==='function' && typeof manager.event==='function') return manager;
      for (const child of node?._children || []) {if (nodes.length>=600) break; nodes.push(child);}
    }
    return null;
  }
  function readPage() {
    if (!cycle || !binding || !binding.manager.socket?.connected) return;
    cycle.deadline=Date.now()+8000;
    binding.send.call(binding.manager,{cmd:13,type:1,list:['','',''+pageSize,''+cycle.page],object:'1'});
  }
  function cents(value) {
    if (typeof value!=='number' && !(typeof value==='string' && /^[+-]?\d+(?:\.\d+)?$/.test(value))) return null;
    const result=Math.round(Number(value)*100);
    return Number.isSafeInteger(result)?result:null;
  }
  function consume(meta, bean, returnedSize) {
    const c=cycle;
    if (!c || day()!==c.date) {retry('正在讀取今日 DG 報表'); return;}
    const count=Number(meta.rowCount), pages=Math.max(1,Number(meta.pageCount));
    const rows=meta.records ?? (count===0?[]:null);
    if (meta.rowCount==null || meta.pageCount==null || !Number.isSafeInteger(count) || count<0 ||
        !Number.isSafeInteger(pages) || pages!==Math.max(1,Math.ceil(count/returnedSize)) ||
        !Array.isArray(rows) || rows.length!==Math.min(returnedSize,count-(c.page-1)*returnedSize) ||
        (c.count!==null && (c.count!==count || c.size!==returnedSize))) throw Error();
    c.count=count; c.size=returnedSize;
    if (bean.dList?.length>=3) {
      const official=cents(bean.dList[2]);
      if (official===null || (c.official!==null && c.official!==official)) throw Error();
      c.official=official;
    }
    for (const row of rows) {
      if (!row || !Number.isSafeInteger(Number(row.tableId)) || Number(row.tableId)<=0 ||
          row.isRevocation==null || !Number.isInteger(Number(row.isRevocation))) throw Error();
      let net=0;
      if ([1,2,3].includes(Number(row.isRevocation))) {
        const paid=cents(row.winOrLoss), stake=cents(row.betPoints);
        if (paid===null || stake===null) throw Error();
        net=paid-stake;
      }
      const id=String(Number(row.tableId));
      c.byTable[id]=(c.byTable[id]||0)+net;
      c.total+=net;
    }
    if (c.page<pages) {
      c.page++;
      setTimeout(()=>{if(cycle===c)try{readPage();}catch{retry('DG 報表讀取中斷，正在重試');}},100);
      return;
    }
    if (c.official!==null && c.total!==c.official) throw Error();
    post('report',{date:c.date,count,total:c.total,byTable:c.byTable});
    cycle=null; lastStatus=''; nextRead=Date.now()+12000;
  }
  function detach() {
    if (!binding) return;
    const b=binding;
    if (b.manager.event===b.eventHook) b.manager.event=b.event;
    if (b.manager.sendData===b.sendHook) b.manager.sendData=b.send;
    binding=null; cycle=null;
  }
  function attach(manager) {
    const event=manager.event, send=manager.sendData;
    function sendHook(bean) {
      if (bean?.cmd===13) {
        // Give the native report viewer priority when the player uses it.
        manualUntil=Date.now()+12000;
        if (String(bean.list?.[2])===String(pageSize)) cycle=null;
      }
      return send.apply(this,arguments);
    }
    function eventHook(name, bean) {
      if (name==='RECEIVED_SUCCESS' && bean?.cmd===13 && Number(bean.type)===1 && !Number(bean.codeId) && cycle) {
        let meta;
        try {meta=JSON.parse(bean.object);} catch {}
        const returnedSize=Number(meta?.pageSize) || pageSize;
        // Some endpoints normalize the page size. Accept theirs only when
        // no native viewer request can have produced this response.
        const ours=Number(meta?.pageSize)===pageSize || Date.now()>=manualUntil;
        const empty=cycle.page===1 && meta?.rowCount!=null && Number(meta.rowCount)===0 && !Number(meta.pageNow);
        if (meta && ours && Number.isSafeInteger(returnedSize) && returnedSize>0 &&
            (Number(meta.pageNow)===cycle.page || empty)) {
          try {consume(meta,bean,returnedSize);} catch {retry('DG 報表核對中，正在重試');}
          return true;
        }
      }
      return event.apply(this,arguments);
    }
    binding={manager,event,send,eventHook,sendHook};
    manager.event=eventHook; manager.sendData=sendHook;
  }
  function tick() {
    if (!authorized) return;
    if (binding && !binding.manager.socket?.connected) detach();
    const now=Date.now();
    if (cycle) {
      if(now>=cycle.deadline) retry('DG 報表尚未回覆，正在重試');
      return;
    }
    if (now<nextRead || now<manualUntil) return;
    if (!binding) {
      const manager=locateManager();
      if (!manager) return;
      attach(manager);
    }
    cycle={date:day(),page:1,count:null,official:null,total:0,byTable:{},deadline:0};
    try {readPage();} catch {retry('DG 報表讀取中斷，正在重試');}
  }
  function sessionReady() {authorized=true;}
  function refresh(e) {
    if(e.source!==parent || e.origin!==home || e.data?.channel!==channel || e.data?.type!=='xz-dg-account-refresh') return;
    nextRead=0; tick();
  }
  window.addEventListener('xz-dg-session-ready',sessionReady);
  window.addEventListener('message',refresh);
  const timer=setInterval(tick,1000);
  window.addEventListener('pagehide',()=>{clearInterval(timer);detach();window.removeEventListener('message',refresh);window.removeEventListener('xz-dg-session-ready',sessionReady);},{once:true});
})();
