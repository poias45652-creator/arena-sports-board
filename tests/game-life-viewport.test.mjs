import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/game-life/viewport.js',import.meta.url),'utf8');
const ctx=vm.createContext({});vm.runInContext(source,ctx);
const {position}=ctx.XZViewport;

test('choices already visible keep the reading position; offscreen scenes move only as needed',()=>{
 assert.equal(position({top:400,bottom:1000,current:300,height:936,max:1200}),300);
 assert.equal(position({top:700,bottom:1500,current:0,height:936,max:1200}),588);
 assert.equal(position({top:400,bottom:900,current:827,height:936,max:1200}),376);
});

test('long phone scenes start at the story, and short pages stay within document bounds',()=>{
 assert.equal(position({top:650,bottom:2100,current:1200,height:640,max:1700}),626);
 assert.equal(position({top:400,bottom:1400,current:0,height:936,max:500}),376);
 assert.equal(position({top:10,bottom:400,current:500,height:936,max:0}),0);
});

test('restore uses story and actionable choices, without the tall sidebar or closed details',()=>{
 const scrolls=[],focuses=[];
 const node=(top,bottom,{hidden=false,details=false,action=null}={})=>({
  getBoundingClientRect:()=>({top,bottom}),getClientRects:()=>hidden?[]:[{}],
  closest:()=>details?{}:null,getAttribute:()=>action,setAttribute(){},
  focus:options=>focuses.push({top,options})
 });
 const story=node(-100,200),choice=node(300,600),extra=node(900,1200,{details:true}),hidden=node(0,0,{hidden:true});
 const stage={getBoundingClientRect:()=>({top:-400,bottom:2200}),querySelector:()=>story,querySelectorAll:()=>[choice,extra,hidden]};
 const host={querySelector:()=>stage,querySelectorAll:()=>[choice,extra]};
 const runtime=vm.createContext({window:{scrollY:800,innerHeight:936,scrollTo:x=>scrolls.push(x)},document:{documentElement:{scrollHeight:2500}}});
 vm.runInContext(source,runtime);runtime.XZViewport.restore(host,{top:800,action:null});
 assert.equal(scrolls.at(-1).top,676);assert.equal(scrolls.at(-1).behavior,'instant');
 assert.equal(focuses.at(-1).top,-100);assert.equal(focuses.at(-1).options.preventScroll,true);
});

test('same-scene setting changes preserve the clicked control and its keyboard tab order',()=>{
 const scrolls=[],attrs=[];let focused=false;
 const button={getAttribute:()=>"trainingIntensity('steady')",getClientRects:()=>[{}],getBoundingClientRect:()=>({top:300,bottom:350}),setAttribute:(...x)=>attrs.push(x),focus:()=>focused=true,closest:()=>null};
 const stage={getBoundingClientRect:()=>({top:-200,bottom:1000}),querySelector:()=>null,querySelectorAll:()=>[button]};
 const host={contains:()=>true,querySelector:()=>stage,querySelectorAll:()=>[button]};
 const runtime=vm.createContext({window:{scrollY:600,innerHeight:936,scrollTo:x=>scrolls.push(x)},document:{activeElement:button,documentElement:{scrollHeight:2500}}});
 vm.runInContext(source,runtime);const before=runtime.XZViewport.capture(host);runtime.XZViewport.restore(host,before,{sameScene:true});
 assert.equal(scrolls.at(-1).top,600);assert(focused);assert.equal(attrs.length,0);
});
