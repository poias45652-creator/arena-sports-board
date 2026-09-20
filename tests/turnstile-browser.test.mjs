import test from 'node:test';import assert from 'node:assert/strict';import ts from 'typescript';import {readFileSync} from 'node:fs';
const code=ts.transpileModule(readFileSync('lib/turnstile-browser.ts','utf8'),{compilerOptions:{module:99,target:9}}).outputText;
const {loadTurnstile}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
function env(){const scripts=[];const win={setTimeout,clearTimeout,setInterval,clearInterval};const doc={scripts,baseURI:'https://site.test',createElement:()=>({src:'',addEventListener(){},removeEventListener(){}}),head:{appendChild(s){scripts.push(s);}}};return {win,doc,scripts};}
const api=()=>({render(){return 'widget';},remove(){},ready(fn){fn();}});
test('existing API adds no script',async()=>{const e=env();e.win.turnstile=api();assert.equal(await loadTurnstile(e.win,e.doc),e.win.turnstile);assert.equal(e.scripts.length,0);});
test('existing untagged script and concurrent callers are reused until ready',async()=>{const e=env();const s=e.doc.createElement();s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?onload=platform';e.scripts.push(s);const a=loadTurnstile(e.win,e.doc),b=loadTurnstile(e.win,e.doc);assert.equal(a,b);e.win.turnstile=api();await a;assert.equal(e.scripts.length,1);});
test('fresh parallel callers insert exactly one script',async()=>{const e=env();const a=loadTurnstile(e.win,e.doc),b=loadTurnstile(e.win,e.doc);assert.equal(e.scripts.length,1);e.win.turnstile=api();await Promise.all([a,b]);assert.equal(e.scripts.length,1);});

test('named HTML element is not mistaken for an initialized Turnstile API',async()=>{const e=env();e.win.turnstile={tagName:'SECTION',id:'turnstile'};const result=loadTurnstile(e.win,e.doc);assert.equal(e.scripts.length,1);e.win.turnstile=api();assert.equal(await result,e.win.turnstile);});
test('admin markup never declares the global SDK name as an HTML id',()=>{assert.doesNotMatch(readFileSync('app/admin/turnstile-settings.tsx','utf8'),/id=["']turnstile["']/);});

test('usable API does not wait on a ready callback that never completes',async()=>{const e=env();e.win.turnstile={render(){},remove(){},ready(){throw new Error('must not call ready')}};assert.equal(await loadTurnstile(e.win,e.doc),e.win.turnstile);});
