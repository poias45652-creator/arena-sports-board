import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const [label='build', destination] = process.argv.slice(2);
const manifestFile='.next/server/app/page_client-reference-manifest.js';
assert.ok(fs.existsSync(manifestFile), 'Missing production dashboard client manifest');
const context={};
vm.runInNewContext(fs.readFileSync(manifestFile,'utf8'),context,{timeout:2000});
const manifest=context.__RSC_MANIFEST?.['/page'];
assert.ok(manifest, 'Missing dashboard entry in client manifest');
let names=[];
for(const [entry, files] of Object.entries(manifest.entryJSFiles ?? {})) {
  if(/(?:^|[\\/])app[\\/](?:page|layout)(?:\.[jt]sx?)?$/.test(entry)) names.push(...files);
}
if(!names.length) {
  for(const [entry, files] of Object.entries(manifest.entryJSFiles ?? {})) {
    if(entry.endsWith('/page') || entry.endsWith('/layout')) names.push(...files);
  }
}
assert.ok(names.length, 'Unable to determine initial dashboard chunks: '+JSON.stringify(Object.keys(manifest.entryJSFiles ?? {})));
const files=[...new Set(names)].map(name=>{
  const relative=name.replace(/^\/?_next\//,'').replace(/^\//,'');
  const location=path.join('.next',relative);
  assert.ok(fs.existsSync(location), 'Missing chunk: '+location);
  const bytes=fs.readFileSync(location);
  return {file:relative,bytes:bytes.length,gzipBytes:gzipSync(bytes).length};
});
const report={label,capturedAt:new Date().toISOString(),metric:'initial-dashboard-JavaScript-from-entryJSFiles',files,bytes:files.reduce((n,f)=>n+f.bytes,0),gzipBytes:files.reduce((n,f)=>n+f.gzipBytes,0)};
console.log(JSON.stringify(report,null,2));
if(destination)fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n');
