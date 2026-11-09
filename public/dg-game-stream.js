// Read the same DG PublicBean table fields as server/dg-relay.ts. No outgoing frames.
(() => {
  'use strict';
  const script=document.currentScript;
  const parentOrigin=script?.dataset.home, channel=script?.dataset.channel;
  if (window.parent===window || !channel || !parentOrigin || self.origin!=='null') return;
  const post=(kind,rows=[])=>parent.postMessage({type:'xz-dg-tables-v2',channel,kind,rows},parentOrigin);
  // The sandbox deliberately has no site or vendor storage. The H5 game uses
  // Web Storage for preferences, so give this one game document its own store.
  for (const key of ['localStorage','sessionStorage']) {
    try { window[key].getItem(''); } catch {
      const map=new Map();
      Object.defineProperty(window,key,{configurable:true,value:{
        get length(){return map.size;},key:i=>Array.from(map.keys())[i]??null,
        getItem:k=>map.get(String(k))??null,setItem:(k,v)=>map.set(String(k),String(v)),
        removeItem:k=>map.delete(String(k)),clear:()=>map.clear()
      }});
    }
  }
  // Large H5 atlases can still be loading on a slow connection. Only report
  // genuine resource completions, and stop reporting after the session starts.
  let lastProgress=0;
  const resources=typeof PerformanceObserver==='function'?new PerformanceObserver(()=>{
    const now=Date.now();
    if (now-lastProgress>4000) {lastProgress=now;post('loading');}
  }):null;
  try {resources?.observe({entryTypes:['resource']});} catch {}
  let accountReady=false;
  function reportReady() {
    if (!accountReady) {accountReady=true;window.dispatchEvent(new Event('xz-dg-session-ready'));}
  }
  const decoder = new TextDecoder();
  function fields(bytes, read) {
    let i = 0;
    function uint() {
      let value = 0;
      for (let shift = 0; shift < 70 && i < bytes.length; shift += 7) {
        const b = bytes[i++];
        value += (b & 127) * 2 ** shift;
        if ((b & 128) === 0) return value;
      }
      throw Error('varint');
    }
    while (i < bytes.length) {
      const key = uint(), field = Math.floor(key / 8), wire = key % 8;
      if (wire === 0) read(field, uint());
      else if (wire === 2) {
        const n = uint();
        if (!Number.isSafeInteger(n) || n > bytes.length-i) throw Error('length');
        read(field, bytes.subarray(i, i+n)); i += n;
      } else if (wire === 1 || wire === 5) {
        i += wire === 1 ? 8 : 4;
        if (i > bytes.length) throw Error('truncated');
      } else throw Error('wire');
    }
  }
  const gameNumber=value=>typeof value==='string' && /^[A-Za-z0-9_.:/-]{1,72}$/.test(value) && /[A-Za-z1-9]/.test(value);
  function attachRoad(row, cells) {
    if (!cells.length || cells.length>120 || !cells.every(x=>Number.isInteger(x.code) && x.code>=1 && x.code<=12)) return;
    row.roads=cells.map(x=>x.code).reverse();
    // DG numbers the points of the winning side and separately flags a banker six.
    const points=cells.map(cell=>{
      const value=cell.point;
      const point=/^[1-9]$/.test(String(value))?Number(value):null;
      if (cell.code<=4 && Number(cell.six)===1) return point==null || point===6?6:null;
      return point;
    }).reverse();
    if (points.some(p=>p!==null)) row.roadPoints=points;
    const numbers=cells.map(x=>x.number);
    const oldest=numbers[numbers.length-1];
    if (gameNumber(oldest) && numbers.indexOf(oldest)===numbers.length-1) row.firstGame=oldest;
  }
  function roadCell(value) {
    if (value.length>180) return {};
    const parts=decoder.decode(value).split('#');
    return {number:parts.length>1?parts[0]:undefined,code:Number(parts[1]??parts[0]),six:parts[2],point:parts[3]};
  }
  function table(bytes) {
    const row = {}, roads = [];
    fields(bytes, (key, val) => {
      if (typeof val === 'number') {
        if (key === 1) row.id = val;
        if (key === 2) row.shoe = val;
        if (key === 3) row.round = val;
        if (key === 4) row.state = val;
        if (key === 5) row.countdown = val;
        if (key === 18) row.game = val;
      } else if (key === 7 && val.length < 512) {
        try {
          const p = JSON.parse(decoder.decode(val));
          if ([p.player,p.banker].every(s => typeof s === 'string' && s.length < 30 && /^[0-9-]*$/.test(s)))
            row.poker = {player:p.player, banker:p.banker};
        } catch {}
      } else if (key === 10) roads.push(roadCell(val));
      else if (key === 11 && val.length <= 72) row.gameNo = decoder.decode(val);
      else if (key === 13 && val.length <= 16) row.name = decoder.decode(val);
    });
    attachRoad(row,roads);
    return row;
  }
  function receive(bytes) {
    if (!bytes.length || bytes.length > 512000) return;
    const rows = [], list = [];
    let cmd, id, code=0;
    fields(bytes,(key,val) => {
      if (key === 1 && typeof val === 'number') cmd = val;
      if (key === 6 && typeof val === 'number') id = val;
      if (key === 3 && typeof val === 'number') code=val;
      if (key === 17 && typeof val !== 'number' && rows.length < 200) rows.push(table(val));
      if (key === 12 && typeof val !== 'number' && list.length <= 120) list.push(val);
    });
    if (cmd === 10086) {if (code===0) reportReady();resources?.disconnect();post(code===0?'authenticated':'denied');}
    if (cmd === 1004 && id && list.length && list.length <= 120) {
      const row={id};
      attachRoad(row,list.map(roadCell));
      if (row.roads) rows.push(row);
    }
    const changes = rows.filter(r => r.id && (r.shoe != null || r.round != null || r.countdown != null || r.state===8 || r.roads || r.poker));
    if (changes.length) {
      for (const row of changes) {
        if (row.firstGame) wireRoadAt.set(row.id,{at:Date.now(),first:row.firstGame,length:row.roads.length});
        const prior=shoeByTable.get(row.id);
        if (row.state===8 || row.round===0) {shoeByTable.delete(row.id);continue;}
        if (prior && ((row.shoe!=null && row.shoe!==prior.shoe) ||
            (row.gameNo && row.gameNo!==prior.gameNo) || (row.round!=null && row.round!==prior.round))) shoeByTable.delete(row.id);
        // DG may send card faces separately from the round announcement. Join
        // them only on the same explicit game number within the current deal.
        if (row.poker && row.round==null && prior && prior.gameNo===row.gameNo &&
            (row.shoe==null || row.shoe===prior.shoe) && Date.now()-prior.at<45000)
          row.round=prior.round;
        if (gameNumber(row.gameNo) && Number.isInteger(row.round) && row.round>0 && row.round<=120) {
          const same=prior && prior.gameNo===row.gameNo && prior.round===row.round;
          shoeByTable.set(row.id,{shoe:row.shoe??(same?prior.shoe:undefined),round:row.round,gameNo:row.gameNo,at:Date.now()});
        }
      }
      reportReady();resources?.disconnect();post('tables', changes);
    }
  }
  // DG already keeps its received table snapshots in the PC/WAP lobby model.
  // Read the existing game connection only. Never enter a table to recover its road.
  const wireRoadAt=new Map(), modelSeen=new Map(), shoeByTable=new Map();
  let manager=null,scene=null;
  function gameManager() {
    if (manager?.socket?.connected) return manager;
    const nodes=[window.Laya?.stage];
    for (let i=0;i<nodes.length && i<600;i++) {
      const node=nodes[i], candidate=node?.playerInfo?.socketMan;
      if (candidate?.socket?.connected && candidate.gameData) {scene=node;return manager=candidate;}
      for (const child of node?._children||[]) {if (nodes.length>=600) break;nodes.push(child);}
    }
    return null;
  }
  function recoverRoads() {
    const data=gameManager()?.gameData;
    if (!data) return;
    const candidates=new Map();
    // The desktop lobby paints each table card from card.gameInfo. The mobile
    // lobby and the other layouts share the native table store with the socket.
    const cards=scene?.currentView?.currentLobby?.tableArray ?? scene?.currentLobby?.tableArray;
    const displayed=Array.isArray(cards)?cards.map(card=>card?.gameInfo):[];
    for (const list of [displayed,data.dataInfo,data.multiDataInfo,data.goodDataInfo,data.goodRoadInfo]) {
      if (!Array.isArray(list)) continue;
      for (const t of list) {
        if (!t || ![1,2,8,41].includes(t.gameId) ||
            !Number.isSafeInteger(t.tableId) || !Array.isArray(t.roadArray) || t.roadArray.length>120) continue;
        const row={id:t.tableId,game:t.gameId,model:true};
        if (typeof t.tableName==='string' && t.tableName.length<=16) row.name=t.tableName;
        if (t.stateId===8) {
          row.state=8;
        } else {
          if (t.stateId===0) continue;
          attachRoad(row,t.roadArray.map(cell=>({number:cell?.gameNo,code:cell?.road?.[0],six:cell?.road?.[1],point:cell?.road?.[2]})));
          if (!row.roads) continue;
          // DG sets starTime when a betting clock is received. Do not turn a
          // stopped or expired lobby clock into a new betting window.
          const round=Number(t.playId);
          const meta=shoeByTable.get(row.id);
          if (meta && Number.isSafeInteger(meta.shoe) && meta.shoe>0 && meta.round===round && meta.gameNo===t.gameNo && Date.now()-meta.at<45000) row.shoe=meta.shoe;
          if (Number.isSafeInteger(round) && round===row.roads.length+1) {
            const now=window.Laya?.Browser?.now?.();
            if (t.stateId===1 && Number.isFinite(now) && t.starTime>0 && now>=t.starTime &&
                Number.isInteger(t.countDown) && t.countDown>0 && t.countDown<=120) {
              row.round=round;
              row.countdown=Math.max(0,t.countDown-Math.ceil((now-t.starTime)/1000));
            } else if ([2,3,4,5].includes(t.stateId)) {
              row.round=round;
              row.countdown=0;
            }
          }
          // DG clears poker when betting opens. Only copy a dealt or settled
          // hand that the native model explicitly associates with this round.
          if ([2,3,4,5].includes(t.stateId) && Number.isSafeInteger(round) && round>0 &&
              (round===row.roads.length+1 || round===row.roads.length) &&
              typeof t.poker==='string' && t.poker.length<=128) {
            try {
              const p=JSON.parse(t.poker);
              if ([p.player,p.banker].every(v=>typeof v==='string' && /^(?:\d{1,2}(?:-\d{1,2}){0,2})?$/.test(v)) &&
                  /[1-9]/.test(p.player+p.banker)) {
                row.poker={player:p.player,banker:p.banker};
                row.round=round;
              }
            } catch {}
          }
          const wire=wireRoadAt.get(row.id);
          if (wire && Date.now()-wire.at<15000 && row.firstGame && (wire.first!==row.firstGame || wire.length>row.roads.length)) continue;
        }
        const earlier=candidates.get(row.id);
        if (!earlier) {candidates.set(row.id,{row,table:t});continue;}
        // A sparse display card and a numbered socket model can describe the same live game.
        if (gameNumber(t.gameNo) && t.gameNo===earlier.table.gameNo && Number(t.playId)===Number(earlier.table.playId) &&
            row.roads && earlier.row.roads && row.roads.length===earlier.row.roads.length &&
            row.roads.every((code,i)=>code===earlier.row.roads[i])) {
          if (!earlier.row.firstGame && row.firstGame) earlier.row.firstGame=row.firstGame;
          if (!earlier.row.shoe && row.shoe) earlier.row.shoe=row.shoe;
          if (row.roadPoints) earlier.row.roadPoints=row.roadPoints.map((p,i)=>earlier.row.roadPoints?.[i]??p);
          if (!earlier.row.poker && row.poker && earlier.table.stateId===t.stateId) {
            earlier.row.poker=row.poker;
            earlier.row.round=row.round;
          }
        }
      }
    }
    const rows=[];
    for (const {row,table} of candidates.values()) {
      if (row.state===8) shoeByTable.delete(row.id);
      const signature=JSON.stringify([row.name,row.state,row.shoe,row.firstGame,table.roadArray[0]?.gameNo,row.roads,row.round,row.countdown>0,row.countdown===0,row.poker,row.roadPoints]);
      if (modelSeen.get(row.id)===signature) continue;
      modelSeen.set(row.id,signature);
      rows.push(row);
    }
    if (rows.length) {reportReady();post('tables',rows);}
  }
  const recover=()=>{try{recoverRoads();}catch{}};
  const recoveryTimer=window.setInterval(recover,2500);
  window.addEventListener('pageshow',recover);
  window.addEventListener('pagehide',event=>{if (!event.persisted) window.clearInterval(recoveryTimer);});
  // Observe only native table-enter and lobby commands. Never retain the frame or send a game command.
  function foreground(bytes) {
    if (!bytes.length || bytes.length>4096) return;
    let cmd,tableId,codeId;
    fields(bytes,(key,value)=>{
      if (typeof value!=='number') return;
      if (key===1) cmd=value;
      if (key===6) tableId=value;
      if (key===3) codeId=value;
    });
    if (cmd===4 || cmd===5011 || cmd===87 || cmd===2) return {cmd,tableId,codeId};
  }
  let outgoing=Promise.resolve();
  const Native = window.WebSocket;
  window.WebSocket = new Proxy(Native, {construct(target,args,newTarget) {
    const socket = Reflect.construct(target,args,newTarget);
    const send=socket.send;
    socket.send=function(data) {
      const result=send.apply(this,arguments);
      try {
        // Read reusable buffers immediately and queue only selection metadata.
        let selection;
        if (data instanceof Blob && data.size<=4096) {
          selection=data.arrayBuffer().then(buf=>foreground(new Uint8Array(buf))).catch(()=>null);
        } else if (data instanceof ArrayBuffer && data.byteLength<=4096) {
          selection=foreground(new Uint8Array(data));
        } else if (ArrayBuffer.isView(data) && data.byteLength<=4096) {
          selection=foreground(new Uint8Array(data.buffer,data.byteOffset,data.byteLength));
        }
        if (selection) outgoing=outgoing.then(()=>selection).then(meta=>{
          if (meta) parent.postMessage({type:'xz-dg-tables-v2',channel,kind:'foreground',...meta},parentOrigin);
        }).catch(()=>{});
      } catch {}
      return result;
    };
    socket.addEventListener('open',()=>post('loading'),{once:true});
    let queue = Promise.resolve();
    socket.addEventListener('message', event => {
      const data = event.data;
      if (!(data instanceof ArrayBuffer || data instanceof Blob)) return;
      queue = queue.then(async () => receive(new Uint8Array(data instanceof Blob ? await data.arrayBuffer() : data))).catch(() => {});
    });
    return socket;
  }});
  post('ready');
})();
