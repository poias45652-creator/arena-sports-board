// Isolated CI database only. No production credentials, account data or provider sessions.
import pg from 'pg';
const root='http://127.0.0.1:10000',until=Date.now()+85000;
let result;
while(Date.now()<until){
 try{const r=await fetch(root+'/api/health',{signal:AbortSignal.timeout(3000)});const d=await r.json();if(r.ok&&d.ok){result=d;if(d.refresh?.enabled&&d.refresh.leagues?.length===3&&d.refresh.leagues.every(x=>x.succeededAt))break;}}catch{}
 await new Promise(r=>setTimeout(r,1500));
}
const lanes=result?.refresh?.leagues||[];
console.log('BACKGROUND_RUNTIME',JSON.stringify({environment:'isolated CI production build',version:result?.version,enabled:result?.refresh?.enabled,leagues:lanes.map(x=>({league:x.league,status:x.status,games:x.games,checkedAt:x.checkedAt,succeededAt:x.succeededAt,nextCheckAt:x.nextCheckAt})),continuousAcrossHostingSleep:result?.refresh?.continuousAcrossHostingSleep}));
if(!result?.ok||!result.refresh?.enabled||lanes.length!==3||lanes.some(x=>!x.succeededAt))throw Error('Three runtime refresh loops did not complete a successful check');
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
try{const {rows}=await pool.query('SELECT league, COUNT(*)::integer AS games FROM baseball_current GROUP BY league ORDER BY league');console.log('BACKGROUND_DATABASE',JSON.stringify(rows));if(rows.length!==3||rows.some(x=>x.games<1))throw Error('Three-league snapshots were not persisted');}finally{await pool.end();}
const blocked=await fetch(root+'/api/international?kind=kbo-pregame',{redirect:'manual',signal:AbortSignal.timeout(5000)});
if(blocked.status!==401&&blocked.status!==403)throw Error('Private data API did not require authentication');
console.log('PRIVATE_API_GATE',blocked.status);
