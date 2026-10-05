import {readFile,mkdir,lstat,rename} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
const root=resolve(import.meta.dirname,'..');
const files=JSON.parse(await readFile(new URL('./render-legacy-candidates.json',import.meta.url),'utf8'));
let count=0;
for(const file of files){
 if(!/^(app|lib|server)\//.test(file)||file.includes('\\')||file.split('/').some(p=>!p||p==='.'||p==='..'))throw Error('Invalid legacy path');
 const source=resolve(root,file),target=resolve(root,'.render-legacy-backup',Date.now().toString(),file);
 if(!source.startsWith(root+sep)||!target.startsWith(root+sep))throw Error('Invalid legacy path');
 let found;try{found=await lstat(source);}catch(e){if(e.code==='ENOENT')continue;throw e;}
 if(!found.isFile()||found.isSymbolicLink())throw Error('Refusing unexpected legacy entry: '+file);
 await mkdir(dirname(target),{recursive:true});await rename(source,target);count++;
}
if(count)console.log(`Backed up ${count} obsolete Render files in .render-legacy-backup. No account data changed.`);
