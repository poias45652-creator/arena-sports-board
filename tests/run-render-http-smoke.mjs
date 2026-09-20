import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
const origin='http://127.0.0.1:3027';
process.env.RENDER_SMOKE_ORIGIN=origin;
const server=spawn(process.execPath,['scripts/render-start.mjs'],{env:{...process.env,YJ_RENDER_HTTP_TEST:'1',DATABASE_URL:'postgresql://local-test/fixture',TZ_BINDING_KEY:Buffer.alloc(32).toString('base64'),PLATFORM_ADMIN_USERNAME:'render-test-admin',APP_ORIGIN:origin,PORT:'3027',NODE_OPTIONS:'--import ./tests/render-http-preload.mjs'},stdio:['ignore','pipe','pipe']});
let output='';server.stdout.on('data',b=>output+=b);server.stderr.on('data',b=>output+=b);
try{
 let ready=false;
 for(let i=0;i<80;i++){
  if(server.exitCode!==null)throw Error('Server exited: '+output);
  try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}
  await delay(250);
 }
 if(!ready)throw Error('Server did not become ready: '+output);
 await import('./render-http-smoke.mjs');
}catch(error){console.error(output);throw error;}
finally{server.kill('SIGTERM');}
