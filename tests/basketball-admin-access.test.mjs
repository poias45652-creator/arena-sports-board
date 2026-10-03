import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync('app/api/admin/basketball/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function route(allowed){
 const calls=[];
 const dependencies={'@/app/admin-access':{isSiteAdmin:async()=>allowed},'../../nba/route':{GET:async r=>{calls.push(r.url);return Response.json({league:'NBA'});}},'../../wnba/route':{GET:async r=>{calls.push(r.url);return Response.json({league:'WNBA'});}}};
 const handler=new Function('require','exports',code+';return exports.GET;')(id=>dependencies[id],{});
 return {handler,calls};
}
test('non-admin users cannot invoke basketball diagnostic sources',async()=>{
 const r=route(false),response=await r.handler(new Request('https://example.test/api/admin/basketball?league=WNBA&kind=analysis'));
 assert.equal(response.status,403);assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(r.calls.length,0);
});
test('admin requests keep league isolation and reject unsupported diagnostic operations',async()=>{
 const r=route(true);
 for(const league of ['NBA','WNBA']){const response=await r.handler(new Request(`https://example.test/api/admin/basketball?league=${league}&kind=analysis&date=2026-10-04&game=123`));assert.equal((await response.json()).league,league);assert.match(r.calls.at(-1),/game=123/);}
 for(const query of ['league=MLB','league=NBA&kind=player','kind=analysis']){const before=r.calls.length,response=await r.handler(new Request('https://example.test/api/admin/basketball?'+query));assert.equal(response.status,400);assert.equal(r.calls.length,before);}
});
