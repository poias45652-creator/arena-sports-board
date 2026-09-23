import {dayInTaipei} from './baseball-current.mjs';
import {timingSafeEqual} from 'node:crypto';

export function authorizeBaseballSync(configured,supplied){
 if(typeof configured!=='string'||configured.length<32)return 503;
 const expected=Buffer.from('Bearer '+configured),actual=Buffer.from(supplied||'');
 return actual.length===expected.length&&timingSafeEqual(actual,expected)?200:401;
}

export async function syncBaseball({getLive,getPregame,now=Date.now}){
 const leagues=['CPBL','NPB','KBO'];
 const jobs=await Promise.allSettled(leagues.map(async league=>{
  const date=dayInTaipei(new Date(now())),tomorrow=dayInTaipei(new Date(now()+86400000));
  const live=await getLive(league,date);
  const pregame=await getPregame(league,date);
  const upcoming=await getPregame(league,tomorrow);
  const stored=!live.persistence?.error&&!pregame.storageError;
  const fresh=!live.stale&&['ok','partial'].includes(live.status);
  return {league,date:live.date,status:live.status,games:live.games.length,coverage:pregame.coverage,stored,fresh,
   upcoming:{date:tomorrow,games:upcoming.pregame?.games?.length||0,status:upcoming.status,coverage:upcoming.coverage},
   healthy:stored&&!upcoming.storageError&&(fresh||upcoming.pregame?.games?.length>0),storageError:pregame.storageError||live.persistence?.error||null};
 }));
 const results=jobs.map((r,i)=>r.status==='fulfilled'?r.value:{league:leagues[i],status:'unavailable',healthy:false,stored:false,fresh:false});
 const healthy=results.filter(r=>r.healthy).length;
 return {checkedAt:new Date(now()).toISOString(),status:healthy===leagues.length?'ok':healthy?'partial':'unavailable',results};
}
