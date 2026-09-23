import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {authorizeGithubSync,SYNC_AUDIENCE} from '../server/github-sync-auth.mjs';
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'test',use:'sig',alg:'RS256'};
const now=1780000000000,t=now/1000;
const payload={iss:'https://token.actions.githubusercontent.com',aud:SYNC_AUDIENCE,repository:'poias45652-creator/arena-sports-board',repository_id:'1365619402',repository_owner_id:'326707968',ref:'refs/heads/main',workflow_ref:'poias45652-creator/arena-sports-board/.github/workflows/international-daily.yml@refs/heads/main',event_name:'schedule',iat:t,nbf:t,exp:t+300};
const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
function token(changes={},header={}){const s=encode({alg:'RS256',kid:'test',...header})+'.'+encode({...payload,...changes});return 'Bearer '+s+'.'+sign('RSA-SHA256',Buffer.from(s),privateKey).toString('base64url');}
const options={now:()=>now,getKeys:async()=>[jwk]};
test('only signed short-lived identity from the pinned repository, branch and workflow can sync',async()=>{
 assert.equal(await authorizeGithubSync(token(),options),true);
 for(const p of [{repository:'attacker/repo'},{repository_id:'0'},{repository_owner_id:'0'},{ref:'refs/pull/1/merge'},{event_name:'pull_request'},{workflow_ref:'other'},{aud:'other'},{iss:'other'},{exp:t},{iat:t-1000},{nbf:t+100},{exp:t+3600}])assert.equal(await authorizeGithubSync(token(p),options),false,JSON.stringify(p));
 assert.equal(await authorizeGithubSync(token({}, {alg:'none'}),options),false);
 assert.equal(await authorizeGithubSync(token().slice(0,-10)+'xxxxxxxxxx',options),false);
 assert.equal(await authorizeGithubSync('Bearer arbitrary',options),false);
 assert.equal(await authorizeGithubSync(token(),{...options,getKeys:async()=>{throw Error();}}),false);
});
