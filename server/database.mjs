import pg from 'pg';
import {readFile} from 'node:fs/promises';
pg.types.setTypeParser(20,value=>{const n=Number(value);if(!Number.isSafeInteger(n))throw new Error('Database integer exceeds supported range');return n;});
export function getPool(){
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is not configured');
 if(!globalThis.__arenaPool){
  const url=new URL(process.env.DATABASE_URL);
  if(!['postgres:','postgresql:'].includes(url.protocol))throw new Error('Invalid database URL');
  globalThis.__arenaPool=new pg.Pool({connectionString:url.href,max:5,connectionTimeoutMillis:10000,ssl:['localhost','127.0.0.1','::1','[::1]'].includes(url.hostname)||process.env.PGSSLMODE==='disable'?false:{rejectUnauthorized:false}});
 }
 return globalThis.__arenaPool;
}
export function postgresSql(sql){
 let i=0;let result=sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g,t=>t==='?'?'$'+(++i):t);
 if(/^\s*INSERT OR IGNORE INTO\b/i.test(result))result=result.replace(/INSERT OR IGNORE INTO/i,'INSERT INTO')+' ON CONFLICT DO NOTHING';
 return result;
}
export function createDatabase(executor=getPool()){
 class Statement{
  constructor(sql,values=[]){this.sql=postgresSql(sql);this.values=values;}
  bind(...values){this.values=values;return this;}
  async first(){return (await executor.query(this.sql,this.values)).rows[0]??null;}
  async all(){return {results:(await executor.query(this.sql,this.values)).rows};}
  async run(){const r=await executor.query(this.sql,this.values);return {success:true,meta:{changes:r.rowCount}};}
 }
 return {prepare:sql=>new Statement(sql),async batch(statements){
  const client=await executor.connect();
  try{await client.query('BEGIN');const results=[];for(const s of statements)results.push(await client.query(s.sql,s.values));await client.query('COMMIT');return results;}
  catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
 }};
}
export async function migrate(pool=getPool()){
 const schema=await readFile(new URL('../db/render-schema.sql',import.meta.url),'utf8');const client=await pool.connect();
 try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock($1::int,$2::int)',[1095910734,2]);await client.query(schema);await client.query('COMMIT');}
 catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
