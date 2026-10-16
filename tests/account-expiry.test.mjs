import test from 'node:test';
import assert from 'node:assert/strict';
import {accountExpiryInput,parseAccountExpiry} from '../lib/account-expiry.ts';

test('admin expiry uses Taiwan time and preserves the selected second across timezones',()=>{
 const oldTimezone=process.env.TZ;
 try {
  for(const zone of ['UTC','Asia/Taipei','America/Los_Angeles']){
   process.env.TZ=zone;
   const timestamp=parseAccountExpiry('2026-10-16T17:31:14');
   assert.equal(timestamp,Date.UTC(2026,9,16,9,31,14));
   assert.equal(accountExpiryInput(timestamp),'2026-10-16T17:31:14');
   assert.equal(accountExpiryInput(Date.UTC(2026,9,16,23,59,59)),'2026-10-17T07:59:59');
  }
 } finally {if(oldTimezone===undefined)delete process.env.TZ;else process.env.TZ=oldTimezone;}
});

test('unlimited, zero seconds, leap days and the final allowed date round-trip',()=>{
 assert.equal(parseAccountExpiry(''),null);
 assert.equal(accountExpiryInput(null),'');
 assert.equal(accountExpiryInput(parseAccountExpiry('2026-10-16T17:31')),'2026-10-16T17:31:00');
 for(const value of ['2028-02-29T12:34:56','2099-12-31T23:59:59'])assert.equal(accountExpiryInput(parseAccountExpiry(value)),value);
});

test('incomplete and invalid calendar values are not silently converted',()=>{
 for(const value of ['2026-10-16','2026-02-29T12:34:56','2026-02-30T12:34:56','2026-10-16T24:00:00','2026-10-16T17:31:60','2100-01-02T00:00:00'])assert.throws(()=>parseAccountExpiry(value));
});
