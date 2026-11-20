export type PitchPoint={x:number;y:number};
export type PitchAction={id:string;label:string;clock:string;teamId:string|null;type:string;point?:PitchPoint;end?:PitchPoint;occurredAt?:string};
export type FootballPitchReading={clock:string;actions:PitchAction[];updatedAt?:string|null;delayed?:boolean};

export function newPitchFrames(actions:PitchAction[],previous?:PitchAction):PitchAction[]{
  const latest=actions[0];
  if(!latest||latest.id===previous?.id)return [];
  if(!previous)return [latest];
  const seen=actions.findIndex(action=>action.id===previous.id);
  if(seen>=0)return actions.slice(0,seen).reverse();
  // A whole batch may have arrived between polls. Discard older snapshots.
  const lastTime=Date.parse(previous.occurredAt||'');
  return actions.filter(action=>{
    const time=Date.parse(action.occurredAt||'');
    if(Number.isFinite(time)&&Number.isFinite(lastTime)){
      return time>lastTime||(time===lastTime&&Number(action.id)>Number(previous.id));
    }
    return clockOrder(action.clock)>clockOrder(previous.clock);
  }).reverse();
}

export function pitchPlaybackActions(actions:PitchAction[],now=Date.now()){
  // The summary and coordinate feeds can publish at different times. A newer commentary
  // headline must not hide measured touches arriving underneath it on subsequent polls.
  const touches=actions.filter(action=>action.occurredAt);
  const lag=now-Date.parse(touches[0]?.occurredAt||'');
  if(!touches.length)return actions;
  const minute=(action:PitchAction)=>{
    const order=clockOrder(action.clock);
    return Math.floor(order/100)+order%100;
  };
  // A stopped tracking feed can fall behind newer, independently confirmed match events.
  return lag>180000&&minute(actions[0])-minute(touches[0])>3?actions:touches;
}

export function createPitchPlayback(publish:(action:PitchAction,moving:boolean)=>void){
  let cursor:PitchAction|undefined;
  let queue:PitchAction[]=[];
  let timer:ReturnType<typeof setTimeout>|undefined;
  let current:PitchAction|undefined;
  const seen=new Set<string>();
  function next(){
    const action=queue.shift();
    if(!action){
      timer=undefined;
      if(current)publish(current,false);
      return;
    }
    current=action;
    publish(action,true);
    const gap=Date.parse(queue[0]?.occurredAt||'')-Date.parse(action.occurredAt||'');
    const delay=Math.max(900,Math.min(Number.isFinite(gap)?gap:1500,4500,45000/Math.max(queue.length,1)));
    timer=setTimeout(next,delay);
  }
  function stop(){
    clearTimeout(timer);
    timer=undefined;
    queue=[];
    current=cursor??current;
    if(current)publish(current,false);
  }
  return {stop,update(actions:PitchAction[]){
    const latest=actions[0];
    if(!latest||seen.has(latest.id))return;
    const time=Date.parse(latest.occurredAt||'');
    const age=Date.now()-time;
    const initial=!cursor;
    // On opening a live match, show a short run of real touches from its most recent batch.
    const frames=initial&&age>=0&&age<=180000
      ?actions.slice(0,6).filter(a=>time-Date.parse(a.occurredAt||'')<=12000).reverse()
      :newPitchFrames(actions,cursor);
    const fresh=frames.filter(a=>!seen.has(a.id));
    if(!fresh.length)return;
    cursor=latest;
    for(const a of actions)seen.add(a.id);
    while(seen.size>160)seen.delete(seen.values().next().value!);
    if(initial&&age>180000){
      stop();
      current=latest;
      publish(latest,false);
      return;
    }
    queue=[...queue,...fresh].slice(-40);
    if(timer===undefined)next();
  }};
}

const actionLabels:Record<string,string>={
  pass:'傳球',cross:'傳中','ball-touch':'觸球','take-on':'盤帶過人',clear:'解圍',out:'出界',
  tackle:'鏟球','attempted-tackle':'嘗試鏟球',interception:'攔截','blocked-pass':'阻截傳球',
  aerial:'爭頂',dispossessed:'失去球權',save:'撲救',punch:'門將擊球','keeper-sweeper':'門將出迎',
  assist:'助攻','assists-shot':'製造射門機會',dribble:'盤帶',recovery:'奪回球權',
  'goal-kick':'球門球','corner-awarded':'角球','throw-in':'界外球','free-kick':'自由球',
  'ball_safe':'安全控球','possession':'控球','attack':'進攻','dangerous-attack':'危險進攻','foul':'犯規','handball':'手球','offside':'越位','shot-on-target':'射正','shot-off-target':'射偏',
  'shot-blocked':'射門被擋','goal':'進球','own-goal':'烏龍球','yellow-card':'黃牌','red-card':'紅牌',
  'yellow-red-card':'兩黃一紅','substitution':'換人','penalty---scored':'十二碼進球','penalty---missed':'十二碼未進'
};
function point(x:unknown,y:unknown,away:boolean):PitchPoint|undefined {
  if(typeof x!=='number'||typeof y!=='number'||!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>100||y<0||y>100)return;
  return away?{x:100-x,y:100-y}:{x,y};
}

export type SourcePlay={id?:string;type?:{type?:string};team?:{id?:string;displayName?:string};period?:{number?:number};fieldPositionX?:number;fieldPositionY?:number;fieldPosition2X?:number;fieldPosition2Y?:number};
type Comment={text?:string;sequence?:number;time?:{value?:number;displayValue?:string};play?:SourcePlay};
type KeyEvent={id:string;type:string;clock:string;seconds:number;period:number;label:string;teamId:string|null};
type Side={id:string;englishName:string};
export type CorePitchPlay=Omit<SourcePlay,'team'> & {valid?:boolean;team?:{$ref?:string};clock?:{value?:number;displayValue?:string};wallclock?:string};
export function espnPitchActions(rows:Comment[],events:KeyEvent[],home:Side,away:Side,sourceEvents:SourcePlay[]=[],describe?:(text:string)=>string|null,tracking:CorePitchPlay[]=[]):PitchAction[]{
  const plays=new Map<string,{period:number;order:number;sequence?:number;item:PitchAction}>();
  const originals=new Map(sourceEvents.map(play=>[String(play.id),play]));
  for(const e of events){
    const p=originals.get(e.id);
    const measured=p&&e.teamId?point(p.fieldPositionX,p.fieldPositionY,e.teamId===away.id):undefined;
    plays.set(e.id,{period:e.period,order:e.seconds,item:{id:e.id,type:e.type,clock:e.clock,label:e.label,teamId:e.teamId,
      point:measured,end:p&&measured?point(p.fieldPosition2X,p.fieldPosition2Y,e.teamId===away.id):undefined}});
  }
  for(const row of rows){
    if(!row.time?.displayValue)continue;
    const p=row.play,type=p?.type?.type||'commentary';
    const id=p?.id?String(p.id):row.sequence!=null?'comment:'+row.sequence:null;
    const label=actionLabels[type]|| (row.text && describe?.(row.text));
    if(!label||!id)continue;
    const team=[home,away].find(t=>p?.team?.id?String(p?.team.id)===t.id:t.englishName===p?.team?.displayName);
    const coordinates=team&&point(p?.fieldPositionX,p?.fieldPositionY,team.id===away.id);
    const previous=plays.get(id)?.item;
    const sameTeam=previous && (!team||team.id===previous.teamId);
    const priorPoint=sameTeam?previous.point:undefined;
    const priorEnd=sameTeam&&(!coordinates||(priorPoint?.x===coordinates.x&&priorPoint?.y===coordinates.y))?previous.end:undefined;
    plays.set(id,{period:p?.period?.number??inferredPeriod(row.time.displayValue),order:row.time.value??0,sequence:row.sequence,item:{id,type,label,clock:row.time.displayValue,
      teamId:team?.id??previous?.teamId??null,point:coordinates??priorPoint,
      end:(coordinates?point(p?.fieldPosition2X,p?.fieldPosition2Y,team?.id===away.id):undefined)??priorEnd}});
  }
  for(const play of tracking){
    const id=play.id, type=play.type?.type, seconds=play.clock?.value, period=play.period?.number;
    const teamId=/\/teams\/(\d+)(?:[?]|$)/.exec(play.team?.$ref||'')?.[1];
    if(play.valid===false||!id||!type||!Object.hasOwn(actionLabels,type)||!teamId||
        (teamId!==home.id&&teamId!==away.id)||typeof seconds!=='number'||!Number.isFinite(seconds)||!period)continue;
    const clock=play.clock?.displayValue||(seconds===0?'0′':'');
    if(!clock)continue;
    const prior=plays.get(id)?.item;
    const start=point(play.fieldPositionX,play.fieldPositionY,teamId===away.id);
    const end=start&&point(play.fieldPosition2X,play.fieldPosition2Y,teamId===away.id);
    const occurredAt=play.wallclock&&Number.isFinite(Date.parse(play.wallclock))?play.wallclock:undefined;
    plays.set(id,{period,order:seconds,item:{id,type,teamId,clock,label:actionLabels[type],point:start??prior?.point,
      end:end??(!start?prior?.end:undefined),occurredAt}});
  }
  return [...plays.values()].sort((a,b)=>b.period-a.period||clockOrder(b.item.clock)-clockOrder(a.item.clock)||b.order-a.order||(b.sequence??0)-(a.sequence??0)||Number(b.item.id)-Number(a.item.id)).slice(0,tracking.length?40:10).map(v=>v.item);
}

function clockOrder(clock:string){
  const match=/^(\d+)(?:['′’]?\+(\d+))?/.exec(clock);
  return match?Number(match[1])*100+Number(match[2]||0):0;
}

function inferredPeriod(clock:string){
  const minute=parseInt(clock,10);
  return minute<=45?1:minute<=90?2:minute<=105?3:4;
}
