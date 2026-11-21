import {courtAction} from './court-action.js';

function periodNumber(value) {
  const overtime = /^OT(\d+)$/i.exec(String(value));
  return overtime ? 4 + Number(overtime[1]) : Number(String(value ?? '').replace(/^Q/i, '')) || 0;
}
function clockSeconds(clock) {
  const parts=String(clock||'').split(':');
  return parts.length===2?Number(parts[0])*60+Number(parts[1]):Number(clock||0);
}
function older(a,b) {
  const ap=periodNumber(a.period), bp=periodNumber(b.period);
  if(ap!==bp)return ap<bp;
  if(a.clock&&b.clock&&clockSeconds(a.clock)!==clockSeconds(b.clock))return clockSeconds(a.clock)>clockSeconds(b.clock);
  return Number(a.sequence??a.seq??a.actionId)<Number(b.sequence??b.seq??b.actionId);
}
export function courtPeriod(period) {
  const n=periodNumber(period);
  return n>4?'延長第 '+(n-4)+' 節':n?'第 '+n+' 節':'';
}

// Snap to the live edge on entry or after a long disconnection. During normal
// polling, present every new play, including several at the same game clock.
export function courtPlayback(show, schedule=setTimeout, cancel=clearTimeout) {
  let head=null,current=null,queue=[],timer=null;
  function advance() {
    timer=null;
    if(!queue.length)return;
    current=queue.shift();
    show(current,true);
    timer=schedule(advance,Math.min(1450,Math.max(280,4400/(queue.length+1))));
  }
  function stop(){cancel(timer);timer=null;queue=[];}
  return {
    update(plays) {
      const newest=plays?.[0];
      if(!newest)return;
      if(head?.id===newest.id){
        const revision=plays.find(p=>p.id===current?.id);
        if(revision){current=revision;show(current,false);}
        queue=queue.map(p=>plays.find(q=>q.id===p.id)??p);
        head=newest;
        return;
      }
      const overlap=head?plays.findIndex(p=>p.id===head.id):-1;
      if(head&&overlap<0&&older(newest,head))return;
      if(overlap<1||overlap+queue.length>18||periodNumber(head?.period)!==periodNumber(newest.period)){
        stop();current=newest;show(current,true);
      }else{
        queue.push(...plays.slice(0,overlap).reverse());
        if(timer===null)advance();
      }
      head=newest;
    },
    destroy:stop
  };
}
const localTime=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});
export function mountCourt(root) {
  root.innerHTML='<header class="xz-court-header"><b>即時籃球場</b><span></span></header><div class="xz-court-floor"><div class="xz-court-map" aria-hidden="true"><i class="xz-court-ball" hidden></i><i class="xz-court-shot" hidden></i></div><span class="xz-court-location" hidden></span></div><div class="xz-court-play" role="status"><small></small><b>等待逐球資料</b><span></span></div><small class="xz-court-sync"></small>';
  const card=root.querySelector('.xz-court-play'),marker=root.querySelector('.xz-court-ball'),header=root.querySelector('header span'),sync=root.querySelector('.xz-court-sync');
  const shot=root.querySelector('.xz-court-shot'),location=root.querySelector('.xz-court-location');
  let model;
  const playback=courtPlayback((play,animate)=>{
    const team=play.teamId??play.team??play.teamCode;
    const side=team===model.home?'home':team===model.away?'away':'';
    const score=play.awayScore!=null&&play.homeScore!=null?'客 '+play.awayScore+'：'+play.homeScore+' 主':'';
    card.dataset.courtEvent=String(play.id);
    root.dataset.side=side;
    card.querySelector('small').textContent=[courtPeriod(play.period),play.clock,score].filter(Boolean).join('　');
    card.querySelector('b').textContent=courtAction(play.text,play.scoring===true||play.points>0||play.made===true,play);
    card.querySelector('span').textContent=[side&&model[side+'Name'],play.actor||play.playerName||model.players?.get(play.playerIds?.[0])].filter(Boolean).join('・');
    const index=model.plays?.findIndex(p=>p.id===play.id)??-1;
    const previous=index>=0?model.plays.slice(index+1,index+19).find(p=>p.period===play.period&&p.point):null;
    const xy=play.point||previous?.point;
    marker.hidden=!(xy&&[xy.x,xy.y].every(n=>Number.isFinite(n)&&n>=0&&n<=100));
    if(!marker.hidden){
      marker.style.left=xy.x+'%';marker.style.top=xy.y+'%';
    }
    const stamp=Date.parse(play.occurredAt);
    const status=model.error?'連線中斷，正在重試':'';
    sync.textContent=[Number.isFinite(stamp)?'上筆逐球 '+localTime.format(stamp):'',status||model.syncLabel].filter(Boolean).join('　');
    location.textContent=play.point?'':xy?'上次定位':side?model[side+'Name']+'・'+card.querySelector('b').textContent:card.querySelector('b').textContent;
    location.hidden=!location.textContent;
    marker.classList.toggle('previous',!play.point);
    if(animate){
      shot.hidden=!(side&&play.point&&(play.scoring===true||play.made===true)&&!marker.hidden);
      if(!shot.hidden){
        shot.style.setProperty('--origin-x',xy.x+'%');shot.style.setProperty('--origin-y',xy.y+'%');
        shot.style.setProperty('--rim-x',side==='home'?'5.35%':'94.65%');
      }
      shot.classList.remove('is-new');
      card.classList.remove('is-new');marker.classList.remove('is-new');
      void card.offsetWidth;
      card.classList.add('is-new');marker.classList.add('is-new');shot.classList.add('is-new');
    }
  });
  return {
    update(next) {
      header.textContent=[courtPeriod(next.period),next.clock].filter(Boolean).join('　');
      const stamp=Date.parse(next.fetchedAt);
      model={...next,syncLabel:Number.isFinite(stamp)?'資料更新 '+localTime.format(stamp):'正在連線'};
      sync.textContent=next.error?'連線中斷，正在重試':model.syncLabel;
      playback.update(next.plays);
    },
    destroy(){playback.destroy();}
  };
}
