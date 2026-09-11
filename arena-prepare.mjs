import {readFileSync,writeFileSync,mkdirSync,lstatSync} from 'node:fs';
import {resolve,dirname,isAbsolute,sep} from 'node:path';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';

const root=import.meta.dirname,targetRoot=resolve(root,'.arena-app');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const stat=p=>{try{return lstatSync(p);}catch(e){if(e.code==='ENOENT')return null;throw e;}};
function target(name){
 if(typeof name!=='string'||isAbsolute(name)||name.includes('\\')||name.includes(':')||
   name.split('/').some(p=>!p||['.','..','.git','node_modules','.next'].includes(p))||
   /(^|\/)\.env($|\.(?!example$))/.test(name))throw Error('Invalid source path');
 const dest=resolve(targetRoot,name);
 if(!dest.startsWith(targetRoot+sep))throw Error('Invalid source path');
 for(let p=dest;p.length>=targetRoot.length;p=dirname(p))if(stat(p)?.isSymbolicLink())throw Error('Refusing a symbolic-link source destination');
 if(stat(dest)?.isDirectory())throw Error(`A directory conflicts with ${name}`);
 return dest;
}
try{
 const release=JSON.parse(readFileSync(resolve(root,'arena-release.json'),'utf8'));
 if(release.gpt_version!==74||release.gpt_commit!=='53be8a1dd616a42fcad20f87e7810af56c7d0b0d')throw Error('Wrong release manifest');
 const chunks=release.parts.map(part=>{
  if(!/^arena-source-\d+\.bin$/.test(part.name))throw Error('Invalid archive name');
  let data;try{data=readFileSync(resolve(root,part.name));}catch(e){if(e.code==='ENOENT')throw Error(`Missing ${part.name}. Copy every file from the same ZIP to the repository root.`);throw e;}
  if(data.length!==part.bytes||sha(data)!==part.sha256)throw Error(`Incomplete or mixed-version upload: ${part.name}`);
  return data;
 });
 const packed=Buffer.concat(chunks);
 if(sha(packed)!==release.archive_sha256)throw Error('Archive checksum mismatch');
 const payload=JSON.parse(gunzipSync(packed,{maxOutputLength:384*1024*1024}).toString('utf8'));
 if(payload.format!=='arena-source-v1'||payload.source_commit!==release.gpt_commit||payload.files.length!==release.file_count)throw Error('Incomplete source payload');
 const seen=new Set();
 for(const file of payload.files){
  target(file.path);if(seen.has(file.path))throw Error('Duplicate source file');seen.add(file.path);
  const bytes=Buffer.from(file.data,'base64');
  if(bytes.length!==file.bytes||sha(bytes)!==file.sha256)throw Error(`Source verification failed: ${file.path}`);
 }
 // The application is completely self-contained. Old root app/lib files and
 // previous patch scripts are never inputs to the restored GPT v74 build.
 for(const file of payload.files){const dest=target(file.path);mkdirSync(dirname(dest),{recursive:true});writeFileSync(dest,Buffer.from(file.data,'base64'));}
 console.log(`YJ GPT v${release.gpt_version} source restored and verified: ${seen.size} / ${release.file_count} files (${release.gpt_commit}).`);
}catch(e){console.error(`Cannot prepare YJ GPT v74: ${e.message}`);process.exitCode=1;}
