import {spawn} from 'node:child_process';
import {getPool, migrate} from '../server/database.mjs';
const required = ['DATABASE_URL','TZ_BINDING_KEY','PLATFORM_ADMIN_USERNAME'];
const missing = required.filter(name => !process.env[name]?.trim());
if (missing.length) {console.error('Missing Render environment settings: ' + missing.join(', ')); process.exit(1);}
if (Buffer.from(process.env.TZ_BINDING_KEY, 'base64').length !== 32) {console.error('TZ_BINDING_KEY must contain a base64-encoded 32-byte key.'); process.exit(1);}
try {await migrate(); await getPool().end();}
catch (error) {console.error('Database migration failed. Check DATABASE_URL and schema creation permissions. Code: ' + (error.code || 'unavailable')); process.exit(1);}
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next','start','--hostname','0.0.0.0','--port',process.env.PORT || '10000'], {stdio:'inherit',env:process.env});
for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => child.kill(signal));
child.on('error', () => {console.error('Unable to start the web server.'); process.exit(1);});
child.on('exit', (code, signal) => process.exit(code ?? (signal === 'SIGTERM' ? 0 : 1)));
