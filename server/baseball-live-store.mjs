import {validateGame} from './baseball-live-providers.mjs';
const init=new WeakMap();
export async function ensureLiveSchema(pool){
 if(!init.has(pool))init.set(pool,pool.query(`CREATE TABLE IF NOT EXISTS arena_baseball_current_v1 (
  league text NOT NULL CHECK (league IN ('NPB','KBO','CPBL')),
  game_id text NOT NULL,
  game_date date NOT NULL,
  state text NOT NULL,
  fetched_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  PRIMARY KEY (league,game_id)
 )`).catch(e=>{init.delete(pool);throw e;}));
 await init.get(pool);
}
export async function writeLiveSnapshot(pool,snapshot){
 if(snapshot?.schemaVersion!==1||!Array.isArray(snapshot.games)||snapshot.games.length>20)throw new Error('Invalid current snapshot');
 await ensureLiveSchema(pool);
 const client=await pool.connect();let changed=0;
 try{
  await client.query('BEGIN');
  for(const raw of snapshot.games){
   const g=validateGame(structuredClone(raw));
   if(g.league!==snapshot.league||g.date!==snapshot.date)throw new Error('Snapshot game identity mismatch');
   const age=Date.now()-Date.parse(g.source?.fetchedAt);
   if(!Number.isFinite(age)||age< -60000||age>15*60000)throw new Error('Only freshly fetched samples can enter current-game storage');
   const result=await client.query(`INSERT INTO arena_baseball_current_v1 (league,game_id,game_date,state,fetched_at,payload)
    VALUES ($1,$2,$3,$4,$5,$6::jsonb)
    ON CONFLICT (league,game_id) DO UPDATE SET
      game_date=EXCLUDED.game_date,state=EXCLUDED.state,fetched_at=EXCLUDED.fetched_at,payload=EXCLUDED.payload
    WHERE arena_baseball_current_v1.fetched_at < EXCLUDED.fetched_at
      AND NOT (arena_baseball_current_v1.state='final' AND EXCLUDED.state IN ('pregame','unknown'))`,
    [g.league,g.id,g.date,g.status,g.source.fetchedAt,JSON.stringify(g)]);
   changed+=result.rowCount;
  }
  await client.query('COMMIT');return {written:changed};
 }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
export async function readLiveSnapshot(pool,league,date){
 await ensureLiveSchema(pool);
 const result=await pool.query('SELECT payload FROM arena_baseball_current_v1 WHERE league=$1 AND game_date=$2 ORDER BY fetched_at DESC,game_id',[league,date]);
 return result.rows.map(row=>row.payload);
}
