export type PitchPoint={x:number;y:number};
export type PitchAction={id:string;label:string;clock:string;teamId:string|null;type:string;point?:PitchPoint;end?:PitchPoint};
export type FootballPitchReading={clock:string;actions:PitchAction[];updatedAt?:string|null;delayed?:boolean};

const actionLabels:Record<string,string>={
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
export function espnPitchActions(rows:Comment[],events:KeyEvent[],home:Side,away:Side,sourceEvents:SourcePlay[]=[],describe?:(text:string)=>string|null):PitchAction[]{
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
  return [...plays.values()].sort((a,b)=>b.period-a.period||clockOrder(b.item.clock)-clockOrder(a.item.clock)||b.order-a.order||(b.sequence??0)-(a.sequence??0)||Number(b.item.id)-Number(a.item.id)).slice(0,10).map(v=>v.item);
}

function clockOrder(clock:string){
  const match=/^(\d+)(?:['′’]?\+(\d+))?/.exec(clock);
  return match?Number(match[1])*100+Number(match[2]||0):0;
}

function inferredPeriod(clock:string){
  const minute=parseInt(clock,10);
  return minute<=45?1:minute<=90?2:minute<=105?3:4;
}
