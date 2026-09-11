import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {getPool,migrate} from '../server/database.mjs';
try{await migrate();await getPool().end();}catch{console.error('Arena database migration failed; check DATABASE_URL and database availability.');process.exit(1);}
const entry=existsSync('.next/standalone/server.js')?'.next/standalone/server.js':'node_modules/next/dist/bin/next';
const child=spawn(process.execPath,[entry,...(entry.endsWith('/next')?['start','--hostname','0.0.0.0','--port',process.env.PORT||'10000']:[])],{stdio:'inherit',env:{...process.env,HOSTNAME:'0.0.0.0',PORT:process.env.PORT||'10000'}});
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>child.kill(signal));
child.on('exit',code=>process.exit(code??1));
