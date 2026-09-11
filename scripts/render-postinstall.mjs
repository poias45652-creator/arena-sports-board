import {spawnSync} from 'node:child_process';
// The existing Render service uses `npm install`; build there without changing its settings.
if(process.env.RENDER==='true'){
 const result=spawnSync('npm',['run','build'],{stdio:'inherit',env:process.env});
 if(result.status!==0)process.exit(result.status||1);
}
