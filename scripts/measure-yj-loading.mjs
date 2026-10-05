import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const [label='build', destination] = process.argv.slice(2);
let names=[];
let metric='initial-dashboard-JavaScript-from-prerendered-HTML';
const htmlFile=['.next/server/app/index.html','.next/server/app/page.html'].find(file=>fs.existsSync(file));
if(htmlFile) {
  const html=fs.readFileSync(htmlFile,'utf8');
  names=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match=>match[1]).filter(name=>name.startsWith('/_next/')&&name.split('?')[0].endsWith('.js'));
}
if(!names.length) {
  metric='dashboard-and-layout-client-module-chunks';
  const manifestFile='.next/server/app/page_client-reference-manifest.js';
  assert.ok(fs.existsSync(manifestFile),'Missing production dashboard manifest');
  const context={};
  vm.runInNewContext(fs.readFileSync(manifestFile,'utf8'),context,{timeout:2000});
  const manifest=context.__RSC_MANIFEST?.['/page'];
  assert.ok(manifest,'Missing dashboard entry in client manifest');
  for(const [entry, data] of Object.entries(manifest.clientModules ?? {})) {
    if(/(?:^|[\\/])app[\\/](?:page|layout)\.[jt]sx?$/.test(entry)) names.push(...(data.chunks??[]).filter(name=>typeof name==='string'&&name.endsWith('.js')));
  }
}
assert.ok(names.length,'Unable to locate dashboard production chunks');
const files=[...new Set(names)].map(name=>{
  const relative=name.split('?')[0].replace(/^\/?_next\//,'').replace(/^\//,'');
  const location=path.join('.next',relative);
  assert.ok(fs.existsSync(location),'Missing chunk: '+location);
  const bytes=fs.readFileSync(location);
  return {file:relative,bytes:bytes.length,gzipBytes:gzipSync(bytes).length};
});
const report={label,capturedAt:new Date().toISOString(),metric,files,bytes:files.reduce((n,f)=>n+f.bytes,0),gzipBytes:files.reduce((n,f)=>n+f.gzipBytes,0)};
console.log(JSON.stringify(report,null,2));
if(destination)fs.writeFileSync(destination,JSON.stringify(report,null,2)+'\n');
