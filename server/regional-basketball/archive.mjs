import {open, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {gunzipSync} from 'node:zlib';

const root=join(process.cwd(),'data','regional-basketball');
let index;
export async function archiveEntry(key){
  index ??= JSON.parse(await readFile(join(root,'index.json'),'utf8'));
  if(!Object.hasOwn(index,key))return null;
  const [pack,offset,length]=index[key];
  const file=await open(join(root,pack),'r');
  try {
    const data=Buffer.alloc(length);
    let used=0;
    while(used<length){
      const {bytesRead}=await file.read(data,used,length-used,offset+used);
      if(!bytesRead)throw Error('資料檔案不完整');
      used+=bytesRead;
    }
    return data;
  } finally {await file.close();}
}
export async function snapshot(path){
  if(!path.startsWith('/data/')||!path.endsWith('.json'))return null;
  const file=await archiveEntry(path.slice(1));
  return file?JSON.parse(gunzipSync(file)):null;
}
