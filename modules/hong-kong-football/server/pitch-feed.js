// Public match pages expose the same structured fixture and event data as their scoreboard.
const origin = 'https://www.rotascore.com';
const competition = 'e4wyrn4hj1q86pv';
const clubs = {
  LM:'k82rekhyvnerepz', ND:'dj2ryohy5kdq1zp', TP:'pxwrxlhg972ryk0', KC:'2y8m4zh38y3ql07',
  SO:'dj2ryohy420q1zp', BR:'1l4rjnh6pdpm7vx', ST:'3glrw7hwdo1qdyj', EA:'k82rekhv8k1repz',
  HK:'8yomo4h7290q0j6', ED:'k82rekh9xknrepz', KL:'965mkyh7vepr1ge'
};
const eventNames = {corner:'角球','goal-kick':'球門球','throw-in':'界外球','free-kick':'自由球',
  goal:'進球','own-goal':'烏龍球','yellow-card':'黃牌','red-card':'紅牌','second-yellow':'兩黃一紅',
  attack:'進攻','dangerous-attack':'危險進攻',possession:'控球',substitution:'換人', offside:'越位',penalty:'十二碼',shot:'射門',save:'撲救',foul:'犯規'};
function pageObjects(html) {
  if (html.length > 3000000) throw Error('賽事資料過大');
  const chunks = [];
  for (const match of html.matchAll(/<script[^>]*>self\.__next_f\.push\((\[1,"(?:[^"\\]|\\.)*"\])\)<\/script>/g)) {
    chunks.push(JSON.parse(match[1])[1]);
  }
  const objects = [];
  function visit(value) {
    if (!value || typeof value !== 'object') return;
    if (!Array.isArray(value)) objects.push(value);
    for (const child of Object.values(value)) visit(child);
  }
  for (const line of chunks.join('').split('\n')) {
    const record = /^[\da-f]+:([[{].*)$/i.exec(line);
    if (record) {try {visit(JSON.parse(record[1]));} catch {}}
  }
  return objects;
}
function sameFixture(row, game) {
  return row.home?.id===clubs[game.home.id] && row.away?.id===clubs[game.away.id] &&
    Date.parse(row.kickoffIso)===Date.parse(game.start);
}
export function resolvePitchFixture(html,game) {
  const links=new Map();
  for (const row of pageObjects(html)) {
    if (!sameFixture(row,game) || typeof row.href!=='string') continue;
    const m=/^\/en\/match\/[a-z0-9-]+\/([a-z0-9]+)$/.exec(row.href);
    if (m && m[1]===row.id) links.set(row.id,row.href);
  }
  return links.size===1?[...links.values()][0]:null;
}
function minuteOf(label) {
  const m=/^(\d{1,3})(?:['′’]?\+(\d{1,2}))?['′’]?$/.exec(String(label??'').trim());
  return m && +m[1]<=130 ? {clock:m[1]+(m[2]?'+'+m[2]:'')+'′',order:+m[1]*100+Number(m[2]||0)} : null;
}
const counts = value => typeof value==='number' && Number.isInteger(value) && value>=0 ? value:null;
export function parsePitchFeed(html,path,game) {
  const id=path.split('/').at(-1),objects=pageObjects(html);
  const head=objects.find(o=>o.matchId===id && o.competitionId===competition && sameFixture(o,game));
  if (!head || !['live','halftime','finished'].includes(head.statusKind)) return null;
  const bound=objects.filter(o=>o.matchId===id);
  const momentum=bound.find(o=>Array.isArray(o.momentum?.markers))?.momentum;
  const extended=bound.find(o=>o.extendedStats?.sap_stats)?.extendedStats;
  const details=bound.find(o=>Array.isArray(o.events) && typeof o.live==='boolean');
  const events=new Map(),markerKeys=new Set(),stats=[];
  function event(row,isMarker) {
    const time=minuteOf(row.minuteLabel??row.minute);
    const kind=[row.kind,row.commentaryType].find(k=>Object.hasOwn(eventNames,k));
    if (!time || !kind || !['home','away'].includes(row.side)) return;
    const teamId=game[row.side].id,label=eventNames[kind];
    const key=[time.clock,teamId,kind].join(':');
    if(!isMarker && markerKeys.has(key))return;
    if(isMarker)markerKeys.add(key);
    const eventId=isMarker?'marker:'+row.id:'play:'+(typeof row.reactionKey==='string'&&row.reactionKey!=='$undefined'?row.reactionKey:row.id);
    events.set(eventId,{...time,id:eventId,label,teamId,type:kind});
  }
  for(const row of momentum?.markers||[]) event(row,true);
  for(const row of details?.events||[]) event(row,false);
  function add(label,h,a,suffix=''){
    if(counts(h)!==null && counts(a)!==null) stats.push({label,home:String(h)+suffix,away:String(a)+suffix});
  }
  const s=momentum?.selectedStats;
  add('控球率',s?.possession?.home,s?.possession?.away,'%');
  add('進攻',s?.attacks?.home,s?.attacks?.away);
  add('危險進攻',s?.dangerousAttacks?.home,s?.dangerousAttacks?.away);
  const shots=s?.shots;
  if(shots?.hasOnTarget) add('射正',shots.homeOnTarget,shots.awayOnTarget);
  if(shots?.hasOnTarget && shots.hasOffTarget && shots.hasBlocked){
    const sum=side=>{
      const values=['OnTarget','OffTarget','Blocked'].map(key=>counts(shots[side+key]));
      return values.includes(null)?null:values.reduce((total,value)=>total+value,0);
    };
    add('射門',sum('home'),sum('away'));
  }
  for(const row of extended?.sap_stats?.rows||[]){
    if(row.key==='goal_kicks') add('球門球',row.home,row.away);
    if(row.key==='throw_ins') add('界外球',row.home,row.away);
  }
  // Only use published totals. A sparse marker list cannot establish a zero.
  const groups=bound.find(o=>o.period==='all' && Array.isArray(o.groups))?.groups||[];
  const known={corner_kicks:'角球',red_cards:'紅牌',yellow_cards:'黃牌'};
  for(const group of groups) for(const row of group.statistics||[]){
    if(Object.hasOwn(known,row.id) && /^\d+$/.test(row.homeValue) && /^\d+$/.test(row.awayValue))
      add(known[row.id],Number(row.homeValue),Number(row.awayValue));
  }
  const display=minuteOf(head.minuteLabel)?.clock || (head.statusKind==='halftime'||/half.?time/i.test(head.statusLabel)||/^HT$/i.test(head.minuteLabel)?'中場休息':'');
  return {state:head.statusKind==='finished'?'final':'live',clock:display,homeScore:counts(head.home.score),awayScore:counts(head.away.score),
    stats,events:[...events.values()].sort((a,b)=>b.order-a.order),sourceStamp:extended?.fetched_at??null};
}

const cache=new Map();
async function cached(key,ttl,read,onMiss=()=>null) {
  const old=cache.get(key);
  if(old?.pending) return old.pending;
  if(old && old.expires>Date.now()) return old.data;
  const previous=old?.data;
  const pending=read(previous).catch(()=>null).then(value=>{
    const data=value??onMiss(previous);
    cache.set(key,{data,expires:Date.now()+(value?ttl:10000)});
    return data;
  });
  if(cache.size>50)cache.delete(cache.keys().next().value);
  cache.set(key,{pending,data:previous});
  return pending;
}
async function publicPage(path) {
  const res=await fetch(origin+path,{cache:'no-store',signal:AbortSignal.timeout(10500),headers:{Accept:'text/html'}});
  if(!res.ok)throw Error('港超場況暫未更新');
  return res.text();
}
function phaseOrder(row) {
  if(row.state==='final')return Infinity;
  return row.clock==='中場休息'?4599:minuteOf(row.clock)?.order??0;
}
export async function recentPitchFeed(game,now) {
  if(!game?.timeConfirmed || ['cancelled','postponed'].includes(game.state)) return null;
  const age=now-Date.parse(game.start);
  if(age<0 || age>5*3600000) return null;
  const key=game.day+':'+game.home.id+':'+game.away.id;
  return cached('match:'+key,5000,async previous=>{
    const path=await cached('fixture:'+key,3*3600000,async()=>{
      const base='/en/league/hong-kong-premier-league/'+competition+'/matches';
      const html=await publicPage(base), current=resolvePitchFixture(html,game);
      if(current||!game.round)return current;
      const links=html.matchAll(/href="([^"]+)"/g);
      for(const [,href] of links){
        if(!href.startsWith(base+'?'))continue;
        const url=new URL(href.replaceAll('&amp;','&'),origin);
        if(url.searchParams.get('round')===String(game.round))return resolvePitchFixture(await publicPage(url.pathname+url.search),game);
      }
      return null;
    });
    if(!path)return null;
    const [plays,stats]=await Promise.allSettled(['commentary','statistics'].map(async tab=>
      parsePitchFeed(await publicPage(path+'/'+tab),path,game)));
    const a=plays.status==='fulfilled'?plays.value:null,b=stats.status==='fulfilled'?stats.value:null;
    if(!a&&!b)return null;
    // A delayed tab must not reintroduce an older score or match phase.
    const rows=[a,b].filter(Boolean).sort((x,y)=>phaseOrder(y)-phaseOrder(x) ||
      (Date.parse(y.sourceStamp)||0)-(Date.parse(x.sourceStamp)||0));
    const latest=rows[0], merged=new Map(), events=new Map();
    const stamp=Date.parse(latest.sourceStamp);
    if(previous && phaseOrder(previous)>phaseOrder(latest))return {...previous,delayed:previous.state!=='final',notice:null};
    const delayed=latest.state==='live'&&latest.clock!=='中場休息'&&Number.isFinite(stamp)&&now-stamp>3*60000;
    if(Number.isFinite(stamp)&&stamp-now>60000)return null;
    // A partial response can omit a whole tab. Retain its verified totals and recent events.
    for(const stat of previous?.stats||[])merged.set(stat.label,stat);
    for(const item of (!a||!b)?previous?.events||[]:[])events.set(item.id,item);
    for(const item of rows.reverse()){
      for(const stat of item.stats)merged.set(stat.label,stat);
      for(const e of item.events)events.set(e.id,e);
    }
    const result={...latest,delayed,stats:[...merged.values()],events:[...events.values()].sort((x,y)=>y.order-x.order)};
    result.notice=kickUpdate(previous,result,game,now);
    return result;
  },previous=>previous?{...previous,delayed:true,notice:null}:null);
}

// Only report an unambiguous increase between consecutive snapshots. Totals do not locate the ball.
export function kickUpdate(prev,next,game,now){
  if(!prev || next.delayed || prev.delayed || next.state!=='live' || prev.state!=='live' || next.clock==='中場休息')return null;
  const stamp=Date.parse(next.sourceStamp), prior=Date.parse(prev.sourceStamp);
  if(!Number.isFinite(stamp)||!Number.isFinite(prior)||stamp<prior||now-stamp>60000||stamp-now>10000)return null;
  if(next.events[0]?.id!==prev.events[0]?.id)return null;
  if(stamp===prior)return prev.notice&&now-prev.notice.at<35000?prev.notice:null;
  if(stamp-prior>60000)return null;
  const changes=[];
  for(const [label,type] of [['球門球','goal-kick'],['界外球','throw-in'],['進攻','attack'],['危險進攻','dangerous-attack']]){
    const a=prev.stats.find(s=>s.label===label),b=next.stats.find(s=>s.label===label);
    if(!a||!b)continue;
    for(const side of ['home','away']){
      const delta=Number(b[side])-Number(a[side]);
      if(delta!==0)changes.push({delta,id:stamp+'-'+type+'-'+side,type,label:label+' +1',clock:'統計更新',teamId:game[side].id,at:stamp});
    }
  }
  if(!changes.length)return prev.notice&&now-prev.notice.at<35000?prev.notice:null;
  // Some scoreboards count a dangerous attack in both totals.
  if(changes.length===2 && changes[0].type==='attack' && changes[1].type==='dangerous-attack' &&
     changes[0].teamId===changes[1].teamId && changes.every(change=>change.delta===1))return changes[1];
  return changes.length===1&&changes[0].delta===1?changes[0]:null;
}
