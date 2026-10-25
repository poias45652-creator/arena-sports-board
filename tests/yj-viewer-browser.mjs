// Run after npm run build. PLAYWRIGHT_MODULE can point to a host-provided module.
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const entry=`import React from 'react';import {createRoot} from 'react-dom/client';
import Boundary from './app/view-only-boundary';import ViewerAccount from './app/admin/viewer-account';
function Demo(){const [clicks,setClicks]=React.useState(0);return <main><nav className="league-switcher"><button onClick={()=>setClicks(n=>n+1)}>瀏覽籃球</button></nav><button onClick={()=>setClicks(n=>n+100)}>調整權重</button><input aria-label="功能輸入" defaultValue="原值"/><a href="/game-life">遊戲人生</a><button data-viewer-allow onClick={()=>setClicks(n=>n+10)}>登出測試</button><p id="clicks">{clicks}</p><details><summary>查看資料</summary><p>賽事資料</p></details></main>}
createRoot(document.getElementById('root')).render(<Boundary>{location.pathname.startsWith('/admin')?<ViewerAccount/>:<Demo/>}</Boundary>);`;
const bundle=await build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'navigation',setup(b){b.onResolve({filter:/^next\/navigation$/},()=>({path:'navigation',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const usePathname=()=>location.pathname;'}));}}]});
const css=readdirSync('.next/static/css').filter(x=>x.endsWith('.css')).map(x=>readFileSync('.next/static/css/'+x,'utf8')).join('\n');
let changes=[],account={username:'aa3344',enabled:1,updatedAt:0,lastLogin:null,signedIn:0};
const server=createServer(async(req,res)=>{
 if(req.url==='/ui.js'){res.setHeader('content-type','application/javascript');return res.end(bundle.outputFiles[0].contents);}
 if(req.url==='/style.css'){res.setHeader('content-type','text/css');return res.end(css);}
 if(req.url==='/api/session'){res.setHeader('content-type','application/json');return res.end(JSON.stringify({signedIn:true,username:'aa3344',accessMode:req.headers.referer?.includes('/admin')?undefined:'view_only'}));}
 if(req.url==='/api/admin/viewer-account'){res.setHeader('content-type','application/json');if(req.method==='PATCH'){let body='';for await(const chunk of req)body+=chunk;const data=JSON.parse(body);changes.push(data);if(data.enabled!==undefined)account.enabled=Number(data.enabled);return res.end(JSON.stringify({message:'密碼已更新，舊登入已登出。'}));}return res.end(JSON.stringify({account}));}
 res.setHeader('content-type','text/html');res.end('<!doctype html><html lang="zh-Hant"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body class="bg-slate-950 text-slate-100"><div id="root" style="max-width:1100px;margin:24px auto;padding:16px"></div><script src="/ui.js"></script></body></html>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await page.getByText('aa3344 · 唯讀測試模式').waitFor();
 const blocked=page.getByRole('button',{name:'調整權重'});await blocked.waitFor();assert.equal(await blocked.getAttribute('aria-disabled'),'true');
 await blocked.click({force:true});assert.equal(await page.locator('#clicks').textContent(),'0');
 await blocked.focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#clicks').textContent(),'0');
 await page.getByLabel('功能輸入').focus();await page.keyboard.type('不可輸入');assert.equal(await page.getByLabel('功能輸入').inputValue(),'原值');
 await page.getByRole('link',{name:'遊戲人生'}).click({force:true});assert.equal(page.url(),origin+'/');
 await page.getByRole('button',{name:'瀏覽籃球'}).click();assert.equal(await page.locator('#clicks').textContent(),'1');
 await page.locator('summary').click();assert.equal(await page.locator('details').getAttribute('open'),'');
 await page.getByRole('button',{name:'登出測試'}).click();assert.equal(await page.locator('#clicks').textContent(),'11');
 await page.goto(origin+'/admin/accounts');await page.getByRole('button',{name:'停用測試帳號'}).waitFor();
 await page.getByLabel('測試帳號新密碼',{exact:true}).fill('browser-test-password');await page.getByLabel('再次輸入測試帳號新密碼').fill('mismatching-password');await page.getByRole('button',{name:'修改測試帳號密碼'}).click();await page.getByRole('alert').waitFor();assert.equal(changes.length,0);
 await page.getByLabel('再次輸入測試帳號新密碼').fill('browser-test-password');await page.getByRole('button',{name:'修改測試帳號密碼'}).click();await page.getByRole('status').waitFor();assert.deepEqual(changes[0],{password:'browser-test-password'});assert.equal(await page.getByLabel('測試帳號新密碼',{exact:true}).inputValue(),'');
 await page.screenshot({path:'/tmp/yj-viewer-admin-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/yj-viewer-admin-mobile.png',fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.getByRole('button',{name:'停用測試帳號'}).click();await page.getByRole('button',{name:'啟用測試帳號'}).waitFor();assert.deepEqual(changes[1],{enabled:false});assert.deepEqual(errors,[]);
 console.log('Viewer mouse/keyboard restrictions, navigation, admin password confirmation/save/reset, disable, and mobile layout passed.');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
