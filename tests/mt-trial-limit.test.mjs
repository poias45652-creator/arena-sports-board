import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createTrialLedger,canonicalGuestIp} from '../lib/mt-trial-limit.ts';

test('only the ingress IP counts; IPv6 aliases and mapped IPv4 share a key',()=>{
  const ip=value=>canonicalGuestIp(new Headers({'cf-connecting-ip':value,'x-forwarded-for':'192.0.2.199'}));
  assert.equal(canonicalGuestIp(new Headers({'x-forwarded-for':'127.0.0.1'})),null);
  assert.equal(ip('2001:0db8:0000::1'),'2001:db8::1');
  assert.equal(ip('::ffff:c000:0201'),ip('192.0.2.1'));
  for(const value of ['invalid','192.0.2.2,192.0.2.1','fe80::1%zone'])assert.equal(ip(value),null);
});

test('viewing does not use a trial; concurrent starts, new instances and retries keep one stored 180-second window',async()=>{
  const db=new PGlite();
  try {
    const schema=await readFile(new URL('../db/render-schema.sql',import.meta.url),'utf8');
    await db.exec('BEGIN;'+schema+'COMMIT;SET search_path TO yj_platform_v1,pg_catalog;');
    const first=createTrialLedger(db), other=createTrialLedger(db);
    const address='192.0.2.3';
    assert.equal((await first(address,false)).state,'unused');
    const opens=await Promise.all([first(address,true),other(address,true),first(address,true)]);
    assert.equal(new Set(opens.map(x=>x.expiresAt)).size,1);
    assert.ok(opens[0].expiresAt-opens[0].serverNow<=180000 && opens[0].expiresAt-opens[0].serverNow>179000);
    const {rows}=await db.query('SELECT ip_key FROM mt_guest_ip_trials');
    assert.equal(rows.length,1);assert.match(rows[0].ip_key,/^[a-f0-9]{64}$/);
    await db.query("UPDATE mt_guest_ip_trials SET expires_at=clock_timestamp()-interval '1 millisecond'");
    await db.exec('BEGIN;'+schema+'COMMIT;');
    const afterRestart=createTrialLedger(db);
    const expired=await afterRestart(address,true);
    assert.equal(expired.state,'expired');
    assert.equal((await afterRestart(address,false)).expiresAt,expired.expiresAt);
    assert.equal((await other('192.0.2.4',false)).state,'unused');
    assert.equal((await other('192.0.2.4',true)).state,'active');
  } finally {await db.close();}
});
