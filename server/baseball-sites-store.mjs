// D1 adapter. Schema is owned by generated migrations, never runtime DDL.
export async function readLiveSnapshot(db,league,date){
 const result=await db.prepare('SELECT payload FROM baseball_current WHERE league=? AND date=? LIMIT 20').bind(league,date).all();
 return result.results.map(row=>JSON.parse(row.payload));
}
export async function writeLiveSnapshot(db,snapshot){
 const rows=snapshot.games.filter(g=>g.league===snapshot.league&&g.date===snapshot.date&&!g.sourceStale);
 if(!rows.length)return {written:0};
 const results=await db.batch(rows.map(g=>db.prepare(`INSERT INTO baseball_current (key,league,date,fetched_at,status,payload) VALUES (?,?,?,?,?,?)
 ON CONFLICT(key) DO UPDATE SET fetched_at=excluded.fetched_at,status=excluded.status,payload=excluded.payload
 WHERE excluded.fetched_at>=baseball_current.fetched_at AND NOT (baseball_current.status='final' AND excluded.status IN ('pregame','unknown'))`)
 .bind(g.key,g.league,g.date,g.source.fetchedAt,g.status,JSON.stringify(g))));
 return {written:results.reduce((n,r)=>n+(r.meta?.changes||0),0)};
}
