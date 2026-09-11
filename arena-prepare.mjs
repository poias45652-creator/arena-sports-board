import {readFileSync, writeFileSync, mkdirSync, lstatSync, renameSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {dirname, resolve, sep, isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const targetRoot = resolve(root, '.arena-app');
const parts = [{"name": "arena-source-1.bin", "bytes": 20971520, "sha256": "0887de4a7fa658918c6603e86083553d0bc5472983f4e90c67435483a87f4a38"}, {"name": "arena-source-2.bin", "bytes": 14296997, "sha256": "1d94d070c22876727bb02cc34e6d2057069a64299f4331938e183fa67d8dab8d"}];
const archiveHash = '5b701def66618f3e1ca8b2e58d9c710d84a2bf7a3901285976d4b707b2962701';
const digest = data => createHash('sha256').update(data).digest('hex');

// Patch the verified bundled source during preparation, because Render builds
// .arena-app. Merely editing the unused repository-root lib/ would not fix it.
// This small replacement preserves the original two source bundles and their
// checksums, and includes regression coverage for both observed name aliases.
function applyTeamAliasFix(files) {
  const source = files.find(file => file.path === 'lib/super007.ts');
  const tests = files.find(file => file.path === 'tests/super007-settlement.test.mjs');
  const manifest = files.find(file => file.path === 'release-manifest.json');
  if (!source || source.sha256 !== "45bcf5f223b043538ce9a659c377995a6d1e20a00a63a5f85778c425391789d5" ||
      !tests || tests.sha256 !== "6ea717ce3ecfda504a7a312b6d9741dd1491d7b50746e070cdf07b3d9c1257b4" || !manifest) {
    throw new Error('SUPER team-alias patch does not match the bundled source version.');
  }
  const replace = (file, text) => {
    const bytes = Buffer.from(text, 'utf8');
    file.data = bytes.toString('base64');
    file.bytes = bytes.length;
    file.sha256 = digest(bytes);
  };
  const before = "const clean=(s:string)=>s.replace(/\\(主\\)|（主）/g,'').replace(/落磯山|洛磯山/g,'洛磯').replace(/\\s/g,'');";
  const after = "// Exact SUPER aliases observed in the 2026-09-12 source display.\n// Retain team orientation, the ten-minute window and unique-event checks.\nconst teamAliases=new Map<string,string>([\n ['聖路易斯紅雀','聖路易紅雀'],\n ['奧克蘭運動家','運動家'],\n]);\nconst clean=(s:string)=>{\n const name=s.replace(/\\(主\\)|（主）/g,'').replace(/落磯山|洛磯山/g,'洛磯').replace(/\\s/g,'');\n return teamAliases.get(name)??name;\n};";
  const original = Buffer.from(source.data, 'base64').toString('utf8');
  if (original.split(before).length !== 2) throw new Error('Expected SUPER matching function was not found exactly once.');
  replace(source, original.replace(before, after));
  replace(tests, Buffer.from(tests.data, 'base64').toString('utf8') + "\n// Regression inputs transcribed from the user's 2026-09-12 SUPER screenshots.\n// Event IDs below are synthetic; no account data or source credentials are fixtures.\nfunction aliasFixture(which='white-sox') {\n const cards=which==='white-sox';\n const g={id:cards?9101:9102,date:cards?'2026-09-12T00:15:00Z':'2026-09-12T01:40:00Z',\n  home:{id:cards?138:133,name:cards?'St. Louis Cardinals':'Athletics',zh:cards?'聖路易紅雀':'運動家'},\n  away:{id:cards?145:136,name:cards?'Chicago White Sox':'Seattle Mariners',zh:cards?'芝加哥白襪':'西雅圖水手'}};\n const r={id:cards?9201:9202,home:cards?'聖路易斯紅雀(主)':'奧克蘭運動家(主)',away:g.away.zh,\n  start:cards?'2026/09/12 08:15:00':'2026/09/12 09:40:00',live:false,\n  markets:[{type:103,quotes:[{primary:true,homeLine:'',awayLine:cards?'1+90':'1-80',homePrice:'0.950',awayPrice:'0.950'}]},\n   {type:104,quotes:[{primary:true,total:cards?'8-30':'10-55',over:'0.940',under:'0.940'}]}]};\n return {g,r,snapshot:{source:'hr9988',fetchedAt:'2026-09-11T18:20:00Z',games:[r]}};\n}\nfor(const which of ['white-sox','mariners']) {\n test(`SUPER alias pairs ${which} without changing handicap, total, prices or identifiers`,()=>{\n  const {g,r,snapshot}=aliasFixture(which),before=JSON.stringify(snapshot);\n  const rows=superOdds(snapshot,[g],t=>t.zh).games;\n  assert.equal(rows.length,1);\n  const out=rows[0];\n  assert.equal(out.id,r.id);assert.equal(out.home,g.home.name);assert.equal(out.away,g.away.name);assert.equal(out.start,g.date);\n  assert.equal(out.spread.line,1);assert.equal(out.spread.first,.95);assert.equal(out.spread.second,.95);\n  assert.equal(out.spread.boundary,which==='white-sox'?-.9:.8);\n  assert.equal(out.spread.display,which==='white-sox'?'客讓 1+90':'客讓 1-80');\n  assert.equal(out.total.line,which==='white-sox'?8:10);assert.equal(out.total.boundary,which==='white-sox'?-.3:-.55);\n  assert.equal(out.total.first,.94);assert.equal(out.total.second,.94);\n  assert.equal(JSON.stringify(snapshot),before);\n });\n}\ntest('aliases work in either home/away position and preserve existing whitespace/host-marker normalization',()=>{\n const {g,r,snapshot}=aliasFixture();\n [g.home,g.away]=[g.away,g.home];[r.home,r.away]=[r.away,r.home];\n r.away=' 聖路易斯紅雀（主） ';\n assert.equal(superOdds(snapshot,[g],t=>t.zh).games.length,1);\n});\ntest('alias matching still rejects reversed teams, wrong opponents and unknown variants',()=>{\n for(const change of [r=>{[r.home,r.away]=[r.away,r.home];},r=>{r.away='芝加哥小熊';},r=>{r.home='其他運動家(主)';}]){\n  const {g,r,snapshot}=aliasFixture('mariners');change(r);\n  assert.equal(superOdds(snapshot,[g],t=>t.zh).games.length,0);\n }\n});\ntest('alias matching keeps the ten-minute window, live-game exclusion and unique-schedule requirement',()=>{\n const {g,r,snapshot}=aliasFixture();\n g.date='2026-09-12T00:25:00Z';assert.equal(superOdds(snapshot,[g],t=>t.zh).games.length,1);\n g.date='2026-09-12T00:25:01Z';assert.equal(superOdds(snapshot,[g],t=>t.zh).games.length,0);\n g.date='2026-09-13T00:15:00Z';assert.equal(superOdds(snapshot,[g],t=>t.zh).games.length,0);\n g.date='2026-09-12T00:15:00Z';r.live=true;assert.equal(superOdds(snapshot,[g],t=>t.zh).games.length,0);r.live=false;\n assert.equal(superOdds(snapshot,[g,{...g,id:9103}],t=>t.zh).games.length,0);\n});\ntest('matched aliases still reject alternate-only or missing primary markets',()=>{\n const {g,r,snapshot}=aliasFixture();\n r.markets[0].quotes[0].primary=false;r.markets[1].quotes=[];\n const rows=superOdds(snapshot,[g],t=>t.zh).games;\n assert.equal(rows.length,1);assert.equal(rows[0].spread,null);assert.equal(rows[0].total,null);\n assert.match(rows[0].issues.spread,/主盤/);assert.match(rows[0].issues.total,/主盤/);\n});\n");
  const metadata = JSON.parse(Buffer.from(manifest.data, 'base64').toString('utf8'));
  for (const changed of [source, tests]) {
    const record = metadata.files.find(file => file.path === changed.path);
    if (!record) throw new Error(`Missing patched file in release manifest: ${changed.path}`);
    record.bytes = changed.bytes;
    record.sha256 = changed.sha256;
  }
  metadata.source_patches = ['super-team-aliases-20260912'];
  replace(manifest, JSON.stringify(metadata, null, 2) + '\n');
}

function applyLoginBrandFix(files) {
  const page = files.find(file => file.path === 'app/login/page.tsx');
  const manifest = files.find(file => file.path === 'release-manifest.json');
  if (!page || page.sha256 !== '462d9d2ef47dd12fad2786930ab2999c6a89b435cc4541f345abc71535f6706b' || !manifest) {
    throw new Error('Login brand patch does not match the bundled source version.');
  }
  const replace = (file, text) => {
    const bytes = Buffer.from(text, 'utf8');
    file.data = bytes.toString('base64');
    file.bytes = bytes.length;
    file.sha256 = digest(bytes);
  };
  const original = Buffer.from(page.data, 'base64').toString('utf8');
  if (original.split('>ARENA</div>').length !== 2) throw new Error('Expected login brand was not found exactly once.');
  replace(page, original.replace('>ARENA</div>', '>YJ體育分析</div>'));
  const metadata = JSON.parse(Buffer.from(manifest.data, 'base64').toString('utf8'));
  const record = metadata.files.find(file => file.path === page.path);
  if (!record) throw new Error(`Missing patched file in release manifest: ${page.path}`);
  record.bytes = page.bytes;
  record.sha256 = page.sha256;
  metadata.source_patches = [...new Set([...(metadata.source_patches || []), 'login-brand-yj-20260911'])];
  replace(manifest, JSON.stringify(metadata, null, 2) + '\n');
}

function applyAdminOnlyAccountFix(files) {
  const expected = new Map([
    ['server/auth.mjs', '1a1d70ac2e2a890b4b3b064bdbd3992437bb810e02481e75c9cbe6ef01e3be0a'],
    ['app/login/form.tsx', '6caf989dd247776549defade5217b615e20a4acd090659229ba8e5155061cb2e'],
    ['app/api/meta/route.ts', '5f3c0effb5a4cb602a4a2f4465b74b14039481d3c5d617263229e2deaa9f63f8'],
    ['app/admin/tools.tsx', 'f5a67b716752b25f05d852adb2e45cd902162d5842da9e72072b61d6dd93c7c8'],
  ]);
  const manifest = files.find(file => file.path === 'release-manifest.json');
  if (!manifest) throw new Error('Missing release manifest for admin-only account patch.');
  const metadata = JSON.parse(Buffer.from(manifest.data, 'base64').toString('utf8'));
  const replace = (file, bytes) => {
    file.data = bytes.toString('base64');
    file.bytes = bytes.length;
    file.sha256 = digest(bytes);
  };
  for (const [path, expectedHash] of expected) {
    const file = files.find(candidate => candidate.path === path);
    if (!file || file.sha256 !== expectedHash) throw new Error(`Admin-only account patch does not match bundled source: ${path}`);
    replace(file, readFileSync(resolve(root, path)));
    const record = metadata.files.find(candidate => candidate.path === path);
    if (!record) throw new Error(`Missing patched file in release manifest: ${path}`);
    record.bytes = file.bytes;
    record.sha256 = file.sha256;
  }
  metadata.source_patches = [...new Set([...(metadata.source_patches || []), 'admin-only-accounts-20260911'])];
  replace(manifest, Buffer.from(JSON.stringify(metadata, null, 2) + '\n', 'utf8'));
}

function existing(path) {
  try { return lstatSync(path); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

function checkedTarget(name) {
  if (typeof name !== 'string' || isAbsolute(name) || name.includes('\\') ||
      name.split('/').some(part => !part || ['.', '..', '.git', 'node_modules', '.next'].includes(part)) ||
      name.includes(':') || /(^|\/)\.env($|\.(?!example$))/.test(name)) {
    throw new Error(`Invalid source path: ${name}`);
  }
  const target = resolve(targetRoot, name);
  if (!target.startsWith(targetRoot + sep)) throw new Error(`Invalid source path: ${name}`);
  for (let path = target; path.length >= targetRoot.length; path = dirname(path)) {
    if (existing(path)?.isSymbolicLink()) throw new Error(`Refusing to overwrite a link: ${path}`);
  }
  if (existing(target)?.isDirectory()) throw new Error(`A directory conflicts with ${name}`);
  return target;
}

try {
  const chunks = parts.map(part => {
    let bytes;
    try { bytes = readFileSync(resolve(root, part.name)); }
    catch (error) {
      if (error.code === 'ENOENT') throw new Error(`Missing upload file: ${part.name}. Upload all 10 files from the ZIP to the repository root.`);
      throw error;
    }
    if (bytes.length !== part.bytes || digest(bytes) !== part.sha256) {
      throw new Error(`Upload file is incomplete or from another version: ${part.name}. Upload both arena-source files from the same ZIP.`);
    }
    return bytes;
  });
  const packed = Buffer.concat(chunks);
  if (digest(packed) !== archiveHash) throw new Error('Source archive checksum mismatch.');
  const payload = JSON.parse(gunzipSync(packed, {maxOutputLength: 192 * 1024 * 1024}).toString('utf8'));
  if (payload.format !== 'arena-source-v1' || !Array.isArray(payload.files) || payload.files.length !== 255) {
    throw new Error('Invalid complete-source payload.');
  }
  const seen = new Set();
  // Check every file before modifying the generated application directory.
  for (const file of payload.files) {
    const target = checkedTarget(file.path);
    if (seen.has(target)) throw new Error(`Duplicate source file: ${file.path}`);
    seen.add(target);
    const bytes = Buffer.from(file.data, 'base64');
    if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) {
      throw new Error(`Source verification failed: ${file.path}`);
    }
  }
  applyTeamAliasFix(payload.files);
  applyLoginBrandFix(payload.files);
  applyAdminOnlyAccountFix(payload.files);
  for (const file of payload.files) {
    const target = checkedTarget(file.path);
    mkdirSync(dirname(target), {recursive: true});
    const temporary = target + `.arena-write-${process.pid}`;
    writeFileSync(temporary, Buffer.from(file.data, 'base64'), {flag: 'wx'});
    renameSync(temporary, target);
    if (digest(readFileSync(target)) !== file.sha256) throw new Error(`Restored file verification failed: ${file.path}`);
  }
  console.log('Arena source restored and verified: 255 / 255 files.');
} catch (error) {
  console.error(`Arena preparation failed: ${error.message}`);
  process.exitCode = 1;
}
