const target='https://arena-sports-board.onrender.com/api/international-sync';
// GitHub issues a fresh short-lived identity per attempt; no long-lived secret.
for(let attempt=1;attempt<=3;attempt++){
 try{
  const u=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);u.searchParams.set('audience',target);
  const identity=await fetch(u,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},signal:AbortSignal.timeout(15000)});
  if(!identity.ok)throw Error('GitHub identity unavailable');
  const {value}=await identity.json();if(!value)throw Error('Missing identity');
  const r=await fetch(target,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+value},signal:AbortSignal.timeout(180000)});
  if(r.status===401||r.status===403)throw Error('Scheduler authentication rejected');
  const data=await r.json();
  console.log(JSON.stringify({attempt,httpStatus:r.status,...data}));
  if(data.status==='ok')break;
  if(attempt===3)throw Error('Some league updates remain unavailable after retries');
 }catch(e){console.error(`Attempt ${attempt}: ${e.message}`);if(attempt===3){process.exitCode=1;break;}}
 await new Promise(r=>setTimeout(r,15000*attempt));
}
