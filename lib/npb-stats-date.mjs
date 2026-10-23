const taipeiDay=at=>new Date(at+8*3600000).toISOString().slice(0,10);
// Current official totals may inform verified upcoming fixtures, never past ones.
export function npbUpcomingDate(date,observedAt){
 const at=Date.parse(observedAt),target=Date.parse(date+'T00:00:00Z');
 if(!Number.isFinite(at)||!Number.isFinite(target)||new Date(target).toISOString().slice(0,10)!==date)return false;
 const today=taipeiDay(at),distance=target-Date.parse(today+'T00:00:00Z');
 return date.slice(0,4)===today.slice(0,4)&&distance>=0&&distance<=7*86400000;
}
export function validNpbStatsPeriod(source,date){
 if(!source||!npbUpcomingDate(date,source.observedAt))return false;
 if(source.seasonComplete===true)return source.throughDate===null&&source.seasonYear===Number(date.slice(0,4));
 const cutoff=source.throughDate,t=Date.parse(cutoff),today=taipeiDay(Date.parse(source.observedAt));
 return typeof cutoff==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(cutoff)&&Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===cutoff&&cutoff<date&&cutoff<=today&&cutoff.slice(0,4)===date.slice(0,4)&&Date.parse(today)-t<=4*86400000;
}
