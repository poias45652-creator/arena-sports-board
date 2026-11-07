export const DAY_MS=86400000;
export const $=id=>document.getElementById(id);
export const e=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const today=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
export const shift=(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*DAY_MS).toISOString().slice(0,10);
export function validDay(day){return /^\d{4}-\d{2}-\d{2}$/.test(day||'') && !Number.isNaN(Date.parse(day)) && new Date(day+'T12:00:00Z').toISOString().slice(0,10)===day}
export const smallDate=d=>d?.slice(5).replace('-','/')||'—';
export const timeTW=s=>s?new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(s)):'—';
export const stamp=g=>Date.parse(g.date+'T'+(g.time||'23:59')+':00+08:00');
export const key=g=>[g.date,g.home,g.away].join('/');
export const num=(v,d=0)=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(+v)?Number(v).toFixed(d):'—';
export const pct=(v)=>v==null?'—':num(v,1)+'%';
export const logo=(t,c='')=>t?'<img class="'+e(c)+'" alt="" src="'+e(t.logo)+'">':'';
export const stateName=g=>({final:'完賽',in_progress:'進行中',scheduled:'未開賽',fixture:'賽程',postponed:'延期',cancelled:'取消'}[g.status]||'狀態待確認');
export const status=(g,live=false)=>'<span class="status '+(g.status==='in_progress'&&live?'is-live':'')+'">'+(g.status==='in_progress'&&live?'● LIVE ': '')+e(g.status==='in_progress' ? [g.period||'場中',g.clock||'',live?'':'快照'].filter(Boolean).join(' ') : stateName(g))+'</span>';
export const teamFor=(s,c)=>s.info.teams.find(t=>t.code===c);
export function name(s,c){return teamFor(s,c)?.name||c}
export const teamButton=(s,c)=>'<button class="matchteam" data-team="'+e(c)+'">'+e(name(s,c))+'</button>';
export const panelHeading=(title,aside='')=>'<div class="section-head"><div class="section-title"><h2>'+e(title)+'</h2></div><span class="aside-note">'+e(aside)+'</span></div>';
export const empty=(t)=>'<div class="empty">'+e(t)+'</div>';
export const tabBtn=(attr,v,label,on=false)=>'<button class="date-btn" '+attr+'="'+e(v)+'" aria-pressed="'+on+'">'+e(label)+'</button>';
export function results(s,code,cutoff=Infinity){
  return s.all.filter(g=>g.status==='final'&&g.phase!==1&&stamp(g)<cutoff&&g.homeScore!=null&&g.awayScore!=null&&(g.home===code||g.away===code)).sort((a,b)=>stamp(b)-stamp(a)).map(g=>{
    const isHome=g.home===code,pf=Number(isHome?g.homeScore:g.awayScore),pa=Number(isHome?g.awayScore:g.homeScore);
    return {g,win:pf>pa,pf,pa,isHome,opponent:isHome?g.away:g.home};
  });
}
export function record(rows){return rows.length?rows.filter(r=>r.win).length+'–'+rows.filter(r=>!r.win).length:'—'}
export function recentRun(rows,limit=5){return '<div class="run">'+rows.slice(0,limit).map(r=>'<i class="'+(r.win?'win':'loss')+'">'+(r.win?'勝':'負')+'</i>').join('')+'</div>'}
export function readStore(k,fallback){if(document.body.dataset.viewer==='true')return fallback;try{return JSON.parse(localStorage.getItem(k))??fallback}catch{return fallback}}
export function writeStore(k,v){if(document.body.dataset.viewer==='true')return false;try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}}
export async function getJson(url,timeout=15000){
  const r=await fetch(url,{signal:AbortSignal.timeout(timeout)});if(!r.ok)throw Error('資料暫時無法載入');return r.json();
}
export function standingsRows(s){
  const info=s.ranking;
  if(!info?.length)return [];
  const verified=s.rankArchive?.[s.rankSeason]?.[s.phase];
  if(info===verified?.rows)return info.map(r=>({...r,code:r.team,gb:r.gamesBehind,pf:r.ppg,pa:r.oppg}));

  const isCurrent=s.rankSeason===s.seasonEnd&&s.phase===2;
  return info.map(r=>{const code=r.team||r.code,rows=isCurrent?results(s,code):[],recent=rows.slice(0,10),top=info[0];
    let run=0;while(run<rows.length && rows[run].win===rows[0].win)run++;
    const split=flag=>{const part=rows.filter(x=>x.isHome===flag);return part.length?record(part):'—'};
    const avg=k=>rows.length?rows.reduce((sum,x)=>sum+x[k],0)/rows.length:null;
    const number=r.wins+r.losses,complete=number===rows.length;
    return {...r,code,gp:number,winPct:number?r.wins/number*100:null,gb:s.phase!==2?null:r.gb??r.gamesBehind??((top.wins-r.wins+r.losses-top.losses)/2),homeRecord:r.homeRecord??(r.homeWins!=null?r.homeWins+'–'+r.homeLosses:complete?split(true):'—'),awayRecord:r.awayRecord??(r.awayWins!=null?r.awayWins+'–'+r.awayLosses:complete?split(false):'—'),last10:r.last10??(complete?record(recent):'—'),streak:r.streak??(complete&&run?(rows[0].win?'勝':'敗')+run:'—'),pf:r.ppg??r.pointsPerGame??(number&&r.pointsFor!=null?r.pointsFor/number:complete?avg('pf'):null),pa:r.oppg??r.pointsAgainstPerGame??(number&&r.pointsAgainst!=null?r.pointsAgainst/number:complete?avg('pa'):null)};
  });
}
