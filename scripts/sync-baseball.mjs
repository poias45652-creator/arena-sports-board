// Run on a scheduler, once per minute. Credentials belong in environment vars.
const target=process.env.BASEBALL_SYNC_URL,token=process.env.BASEBALL_SYNC_TOKEN;
if(!target||!token||token.length<32)throw Error('BASEBALL_SYNC_URL and a 32+ character BASEBALL_SYNC_TOKEN are required');
const u=new URL(target);if(u.protocol!=='https:'||u.pathname!=='/api/international-sync')throw Error('Unexpected sync endpoint');
const r=await fetch(u,{method:'POST',headers:{Authorization:'Bearer '+token},redirect:'error',signal:AbortSignal.timeout(55000)});
const result=await r.json();console.log(JSON.stringify({httpStatus:r.status,...result}));if(!r.ok||result.status!=='ok')process.exitCode=1;
