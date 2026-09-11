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
