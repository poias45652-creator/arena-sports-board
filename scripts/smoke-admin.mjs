import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
// GET-only deployment verification. No login, account creation, binding or production writes.
const base = 'https://arena-sports-board.onrender.com';
let verified = false;
for (let attempt = 1; attempt <= 15; attempt++) {
  try {
    const healthResponse = await fetch(`${base}/health`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    assert.equal(healthResponse.status, 200);
    const health = await healthResponse.json();
    assert.equal(health.database, true); assert.equal(health.adminSetupVersion, 3);
    const metaResponse = await fetch(`${base}/api/meta`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    assert.equal(metaResponse.status, 200);
    const meta = await metaResponse.json();
    assert.equal(meta.adminSetupVersion, 3); assert.equal(typeof meta.setupRequired, 'boolean');
    console.log(JSON.stringify({ readOnly: true, health: 'passed', database: true, adminSetupVersion: 3, setupRequired: meta.setupRequired }));
    verified = true; break;
  } catch { console.log(`Waiting for verified deployment, attempt ${attempt}/15`); }
  if (attempt < 15) await delay(10000);
}
if (!verified) { console.error('Production read-only verification did not pass. Inspect the Render deployment; do not mark it complete.'); process.exitCode = 1; }
