import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { spawn } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';
import {migrate,createDatabase,postgresSql} from '../server/database.mjs';
import {handleTzBinding} from '../lib/tz-binding-service.ts';
import {hrConnection} from '../lib/hr9988-connection.ts';
import {readFileSync} from 'node:fs';

// Destructive fixtures are restricted to a dedicated local/CI database, never Render.
const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) throw new Error('Set TEST_DATABASE_URL to the disposable arena_admin_setup_test database.');
const database = new URL(connectionString);
if (!['localhost', '127.0.0.1', 'postgres'].includes(database.hostname) || database.pathname !== '/arena_admin_setup_test') {
  throw new Error('Refusing to run destructive fixtures outside the dedicated local test database.');
}
const pool = new pg.Pool({ connectionString, ssl: false });
const setupToken = randomBytes(48).toString('base64url');
const password = 'Local-test-password-123!';
const origins = ['http://127.0.0.1:18101', 'http://127.0.0.1:18102'];
const workers = [];
async function startWorker(origin, token = setupToken) {
  const worker = spawn(process.execPath, ['scripts/render-start.mjs'], {
    env: { ...process.env, DATABASE_URL: connectionString, PORT: new URL(origin).port, APP_ORIGIN: origin,
      ARENA_SETUP_TOKEN: token, TZ_BINDING_KEY: randomBytes(32).toString('base64'),
      CONNECTOR_KEY: '', CONNECTOR_URL: 'http://127.0.0.1:1', NODE_ENV: 'production' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  workers.push(worker);
  let output = '';
  worker.stdout.on('data', chunk => { output = (output + chunk).slice(-6000); });
  worker.stderr.on('data', chunk => { output = (output + chunk).slice(-6000); });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (worker.exitCode !== null) throw new Error(`Test server exited: ${output}`);
    try {
      const response = await fetch(`${origin}/health`, { signal: AbortSignal.timeout(500) });
      if (response.ok && (await response.json()).database) return worker;
    } catch {}
    await delay(100);
  }
  throw new Error(`Test server did not become healthy: ${output}`);
}
async function request(path, data, { origin = origins[0], cookie, requestOrigin = origin, raw } = {}) {
  const aliases={'/api/setup-admin':'/api/auth/setup','/api/register':'/api/auth/register','/api/login':'/api/auth/login','/api/logout':'/api/auth/logout','/api/me':'/api/auth/me'};path=aliases[path]||path;
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  if (requestOrigin !== null) headers.Origin = requestOrigin;
  const options = { headers, signal: AbortSignal.timeout(12000) };
  if (data !== undefined || raw !== undefined) {
    options.method = 'POST'; headers['Content-Type'] = 'application/json';
    options.body = raw === undefined ? JSON.stringify(data) : raw;
  }
  const response = await fetch(`${origin}${path}`, options);
  const payload = await response.json();
  return { status: response.status, data: payload, cookie: response.headers.get('set-cookie')?.split(';')[0], headers: response.headers };
}
function setup(username, options = {}) { return request('/api/setup-admin', { username, password, setupToken }, options); }
async function counts() {
  return (await pool.query(`SELECT count(*)::int AS users, count(*) FILTER (WHERE role='admin')::int AS admins,
    (SELECT count(*)::int FROM arena_sessions) AS sessions FROM arena_users`)).rows[0];
}
before(async () => {
 await migrate(pool);
 await pool.query('CREATE TABLE IF NOT EXISTS source_bindings(user_id text PRIMARY KEY REFERENCES arena_users(id),source_username_enc text,source_password_enc text,device_id_enc text)');
 for (const origin of origins) await startWorker(origin);
});
beforeEach(async () => { await pool.query('TRUNCATE source_bindings, arena_sessions, arena_auth_attempts, tz_binding_attempts, hr_connections, tz_bindings, analysis_snapshots, analysis_results, arena_users CASCADE'); });
after(async () => {
  for (const worker of workers) {
    if (worker.exitCode === null) {
      const exited = new Promise(resolve => worker.once('exit', resolve));
      worker.kill('SIGTERM');
      await Promise.race([exited, delay(2000)]);
      if (worker.exitCode === null) worker.kill('SIGKILL');
    }
  }
  await pool.end();
});

test('empty database exposes setup and a healthy database', async () => {
  const meta = await request('/api/meta');
  assert.equal(meta.status, 200); assert.equal(meta.data.setupRequired, true); assert.equal(meta.data.adminSetupVersion, 3);
  assert.equal((await request('/health')).data.database, true);
});
test('registering a member first does not block administrator setup', async () => {
  const member = await request('/api/register', { username: 'existing.member', password });
  assert.equal(member.status, 201); assert.equal(member.data.user.role, 'member');
  assert.equal((await request('/api/meta')).data.setupRequired, true);
  const admin = await setup('owner.admin');
  assert.equal(admin.status, 201); assert.equal(admin.data.user.role, 'admin');
  assert.equal((await request('/api/meta')).data.setupRequired, false);
  assert.equal((await request('/api/me', undefined, { cookie: member.cookie })).data.user.role, 'member');
  assert.deepEqual(await counts(), { users: 2, admins: 1, sessions: 2 });
});
test('ordinary registration cannot assign itself an administrator role', async () => {
  const result = await request('/api/register', { username: 'regular.user', password, role: 'admin', setupToken });
  assert.equal(result.status, 201); assert.equal(result.data.user.role, 'member');
  assert.equal((await counts()).admins, 0);
});
test('wrong or absent setup tokens are rejected without creating accounts', async () => {
  for (const token of ['', 'not-the-token', null]) {
    const result = await request('/api/setup-admin', { username: 'owner.admin', password, setupToken: token });
    assert.equal(result.status, 403);
  }
  assert.deepEqual(await counts(), { users: 0, admins: 0, sessions: 0 });
});
test('setup requires a same-origin request', async () => {
  assert.equal((await setup('owner.admin', { requestOrigin: 'https://different.invalid' })).status, 403);
  assert.equal((await setup('owner.admin', { requestOrigin: null })).status, 403);
  assert.equal((await counts()).users, 0);
});
test('invalid usernames, passwords and payloads are rejected', async () => {
  for (const input of [
    { username: 'x', password }, { username: 'invalid name', password }, { username: 'owner', password: 'short' },
    { username: 'owner', password: 'x'.repeat(1025) }, { username: {}, password },
  ]) {
    assert.equal((await request('/api/setup-admin', { ...input, setupToken })).status, 400);
  }
  assert.equal((await request('/api/setup-admin', null)).status, 400);
  assert.equal((await request('/api/setup-admin', [])).status, 400);
  assert.equal((await request('/api/setup-admin', undefined, { raw: '{bad json' })).status, 400);
  assert.equal((await counts()).users, 0);
});
test('an existing member username is not overwritten or promoted; a different name succeeds', async () => {
  const member = await request('/api/register', { username: 'already.taken', password });
  assert.equal((await setup('already.taken')).status, 409);
  assert.deepEqual(await counts(), { users: 1, admins: 0, sessions: 1 });
  assert.equal((await request('/api/me', undefined, { cookie: member.cookie })).data.user.role, 'member');
  assert.equal((await setup('different.owner')).status, 201);
});
test('eight concurrent setup requests across two processes create exactly one administrator', async () => {
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => setup(`candidate.${i}`, { origin: origins[i % 2] })));
  assert.equal(results.filter(r => r.status === 201).length, 1);
  assert.equal(results.filter(r => r.status === 409).length, 7);
  assert.deepEqual(await counts(), { users: 1, admins: 1, sessions: 1 });
});
test('bootstrap closes after the first administrator is created', async () => {
  assert.equal((await setup('first.owner')).status, 201);
  assert.equal((await setup('second.owner')).status, 409);
  assert.equal((await request('/api/meta')).data.setupRequired, false);
  assert.deepEqual(await counts(), { users: 1, admins: 1, sessions: 1 });
});
test('session insert failure rolls back the administrator account and permits a clean retry', async () => {
  await pool.query("ALTER TABLE arena_sessions ADD CONSTRAINT test_block_session CHECK (user_id='never') NOT VALID");
  try {
    const result = await setup('rollback.owner');
    assert.equal(result.status, 503); assert.equal(result.cookie, undefined);
    assert.deepEqual(await counts(), { users: 0, admins: 0, sessions: 0 });
  } finally { await pool.query('ALTER TABLE arena_sessions DROP CONSTRAINT test_block_session'); }
  assert.equal((await setup('retry.owner')).status, 201);
});
test('administrator sessions, password login, logout and password hashing work', async () => {
  const created = await setup('Mixed.Case');
  assert.equal(created.status, 201); assert.equal(created.data.user.username, 'mixed.case');
  assert.match(created.headers.get('set-cookie'), /HttpOnly/);
  assert.match(created.headers.get('set-cookie'), /SameSite=Lax/);
  assert.match(created.headers.get('cache-control'), /no-store/);
  assert.equal((await request('/api/me', undefined, { cookie: created.cookie })).data.user.role, 'admin');
  const stored = (await pool.query('SELECT password_salt,password_hash FROM arena_users')).rows[0];
  assert.notEqual(stored.password_hash, password); assert.equal(stored.password_hash.length, 128);
  const session = (await pool.query('SELECT token_hash FROM arena_sessions')).rows[0];
  const opaqueToken = decodeURIComponent(created.cookie.split('=')[1]);
  assert.equal(session.token_hash, createHash('sha256').update(opaqueToken).digest('hex'));
  const logged = await request('/api/login', { username: 'mixed.case', password });
  assert.equal(logged.status, 200); assert.equal(logged.data.user.role, 'admin');
  assert.equal((await request('/api/login', { username: 'mixed.case', password: 'wrong-password' })).status, 401);
  assert.equal((await request('/api/logout', {}, { cookie: logged.cookie })).status, 200);
  assert.equal((await request('/api/me', undefined, { cookie: logged.cookie })).status, 401);
});
test('existing member source bindings are preserved when an administrator is added', async () => {
  const member = await request('/api/register', { username: 'bound.member', password });
  await pool.query('INSERT INTO source_bindings VALUES($1,$2,$3,$4)',[member.data.user.id,'legacy-username-ciphertext','legacy-password-ciphertext','legacy-device-ciphertext']);
  const before = (await pool.query('SELECT * FROM source_bindings')).rows;
  assert.equal((await setup('separate.owner')).status, 201);
  assert.deepEqual((await pool.query('SELECT * FROM source_bindings')).rows, before);
});
test('current Arena pages are preserved and account setup remains available after member login', async () => {
 const member=await request('/api/register',{username:'view.member',password});
 const response=await fetch(`${origins[0]}/`,{headers:{Cookie:member.cookie}});
 assert.equal(response.status,200);const html=await response.text();
 for(const label of ['MLB 美國職棒','概覽','戰績排名','球隊一覽','即時比分','賽前分析'])assert.ok(html.includes(label),label);
 assert.ok(!html.includes('Device ID'));
 assert.equal((await request('/api/meta')).data.setupRequired,true);
 assert.equal((await fetch(`${origins[0]}/login`,{headers:{Cookie:member.cookie}})).status,200);
});
test('an unset server setup token fails closed', async () => {
  const origin = 'http://127.0.0.1:18103';
  await startWorker(origin, '');
  assert.equal((await setup('unconfigured.owner', { origin })).status, 503);
  assert.equal((await counts()).users, 0);
});

test('legacy credentials still log in after repeat migrations, and forged Sites headers never authenticate',async()=>{
 const {passwordHash}=await import('../server/auth.mjs');
 const id='legacy-user',salt='legacy-test-salt';
 await pool.query('INSERT INTO arena_users(id,username,password_salt,password_hash) VALUES($1,$2,$3,$4)',[id,'legacy.user',salt,await passwordHash(password,salt)]);
 await migrate(pool);await migrate(pool);
 assert.equal((await request('/api/login',{username:'legacy.user',password})).data.user.id,id);
 const forged=await fetch(origins[0]+'/api/tz-binding',{headers:{'oai-authenticated-user-id':id,'oai-authenticated-user-email':'admin@example.invalid'}});
 assert.equal(forged.status,401);
});

test('PostgreSQL adapter preserves verified source login, automatic device ID and private odds',async()=>{
 const member=await request('/api/register',{username:'source.member',password});
 const other=await request('/api/register',{username:'source.other',password});
 const id=member.data.user.id,db=createDatabase(pool),secret=randomBytes(32).toString('base64');
 const token=['test',Buffer.from(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'signature'].join('.');
 const bindingRequest=new Request(origins[0]+'/api/tz-binding',{method:'POST',headers:{origin:origins[0],'content-type':'application/json'},body:JSON.stringify({username:'fixture-user',password:'fixture-password'})});
 let loginCalls=0;
 const bound=await handleTzBinding(bindingRequest,id,()=>db,secret,async(url,options)=>{
  loginCalls++;const body=JSON.parse(options.body);assert.match(body.device_id,/^[a-f0-9]{32}$/);
  return Response.json({code:200,data:{user_id:99,username:'fixture-user',token}});
 });
 assert.equal(bound.status,200);assert.equal(loginCalls,1);assert.ok(!(await bound.text()).includes(token));
 const saved=await handleTzBinding(new Request(origins[0]+'/api/tz-binding',{method:'PATCH',headers:{origin:origins[0],'content-type':'application/json'},body:JSON.stringify({gameUrl:'https://hr9988.net/#/Games'})}),id,()=>db,secret);
 assert.equal(saved.status,200);
 const connected=await hrConnection(id,db,secret,'connect',async(url)=>{
  if(url.includes('/SUPER/login'))return Response.json({code:200,data:{game_method:'GET',game_url:'https://hr9988.net/#/APILogin?MemID=0123456789abcdef0123456789abcdef'}});
  if(url.endsWith('/outApiLogin'))return Response.json({code:200,data:{loginID:'fixture-session',mb:{mbID:'fixture-member'}}});
  return Response.json(JSON.parse(readFileSync(new URL('./fixtures/hr9988-game-detail.json',import.meta.url),'utf8')));
 });
 assert.equal(connected.status,200);assert.equal((await connected.json()).games.length,4);
 assert.equal((await hrConnection(other.data.user.id,db,secret,'read')).status,409);
 await handleTzBinding(new Request(origins[0]+'/api/tz-binding',{method:'DELETE',headers:{origin:origins[0]}}),id,()=>db,secret);
 assert.equal((await pool.query('SELECT * FROM hr_connections WHERE member_id=$1',[id])).rows.length,0);
 const before=(await pool.query('SELECT * FROM tz_binding_attempts WHERE member_id=$1',[id])).rows[0];
 await assert.rejects(()=>db.batch([db.prepare('DELETE FROM tz_binding_attempts WHERE member_id=?').bind(id),db.prepare('INSERT INTO missing_test_table VALUES (?)').bind(id)]));
 assert.deepEqual((await pool.query('SELECT * FROM tz_binding_attempts WHERE member_id=$1',[id])).rows[0],before);
 assert.equal(postgresSql("SELECT '?' AS literal, ? AS parameter"),"SELECT '?' AS literal, $1 AS parameter");
});
