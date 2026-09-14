import {readFile,writeFile,mkdtemp,rm,mkdir,copyFile,lstat,open} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve,dirname,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
const root=import.meta.dirname;
const digest=async path=>{const h=createHash('sha256');for await(const chunk of createReadStream(path))h.update(chunk);return h.digest('hex')};
function safe(name){return typeof name==='string'&&!name.includes('\\')&&!name.includes(':')&&!/[\r\n\0]/.test(name)&&!name.startsWith('/')&&name.split('/').every(x=>x&&!['.','..','.git','node_modules','.next'].includes(x))&&!/(^|\/)\.env($|\.(?!example$))/.test(name)}
async function noLinks(path){for(let p=path;p===root||p.startsWith(root+sep);p=dirname(p)){try{if((await lstat(p)).isSymbolicLink())throw Error('Refusing symlink destination');}catch(e){if(e.code!=='ENOENT')throw e;}if(p===root)break;}}
let stage;
try{
 const release=JSON.parse(await readFile(resolve(root,'arena-render-v127-release.json'),'utf8'));
 if(release.format!=='arena-render-source-v1'||release.gpt_version!==127||release.gpt_commit!=='d502240ad7901fde4c64b50e23c2c700295fcbcc')throw Error('Wrong release manifest');
 const names=new Set();for(const f of release.files){if(!safe(f.path)||names.has(f.path)||!Number.isSafeInteger(f.bytes)||f.bytes<0||!/^[a-f0-9]{64}$/.test(f.sha256))throw Error('Invalid source manifest');names.add(f.path);}
 stage=await mkdtemp(resolve(root,'.arena-v127-stage-'));
 const archive=resolve(stage,'source.tar.gz'),out=await open(archive,'w');
 try{for(const part of release.parts){if(!/^arena-render-v127-source-\d+\.bin$/.test(part.name))throw Error('Invalid part name');const file=resolve(root,part.name);if((await lstat(file)).size!==part.bytes||await digest(file)!==part.sha256)throw Error(`Missing, incomplete or mixed-version part: ${part.name}`);for await(const chunk of createReadStream(file))await out.write(chunk);}}finally{await out.close();}
 if(await digest(archive)!==release.archive_sha256)throw Error('Source archive checksum mismatch');
 const listing=spawnSync('tar',['-tzf',archive],{encoding:'utf8',maxBuffer:8*1024*1024});if(listing.status!==0)throw Error('Cannot read source archive');
 const listed=listing.stdout.trim().split('\n');if(listed.length!==names.size||new Set(listed).size!==names.size||listed.some(n=>!names.has(n)))throw Error('Unexpected source archive paths');
 const unpack=resolve(stage,'source');await mkdir(unpack);
 const extraction=spawnSync('tar',['-xzf',archive,'-C',unpack,'--no-same-owner','--no-same-permissions'],{encoding:'utf8'});if(extraction.status!==0)throw Error('Source extraction failed');
 for(const f of release.files){const path=resolve(unpack,f.path),st=await lstat(path);if(!st.isFile()||st.size!==f.bytes||await digest(path)!==f.sha256)throw Error(`Source verification failed: ${f.path}`);await noLinks(resolve(root,f.path));}
 for(const f of release.files){const target=resolve(root,f.path);await mkdir(dirname(target),{recursive:true});await copyFile(resolve(unpack,f.path),target);}
 console.log(`YJ Render v127: restored and SHA-256 verified ${names.size} source files. GPT ${release.gpt_commit}.`);
}catch(e){console.error(`Cannot prepare Render v127: ${e.message}. Upload every file from the same ZIP to the repository root.`);process.exitCode=1;}
finally{if(stage)await rm(stage,{recursive:true,force:true});}
