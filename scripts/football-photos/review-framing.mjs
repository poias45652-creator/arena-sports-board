import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {moduleUrl} from '../../tests/profile-loader.mjs';
const {chromium}=await import(process.env.PORTRAIT_PLAYWRIGHT_MODULE||'playwright');
const {footballPortraitStyle}=await import(moduleUrl('lib/football-portrait-framing.ts'));
const review=JSON.parse(readFileSync('docs/football-europa-portrait-gap-review.json'));
const css=readFileSync('app/football-team-profile.css','utf8');
const out=process.argv[2]||'/tmp/europa-portrait-framing';mkdirSync(out,{recursive:true});
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rows=review.accepted.slice(33);
const cards=rows.map(p=>{
 const style=footballPortraitStyle(p.id,p.name);
 const inline=Object.entries(style||{}).map(([k,v])=>k.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())+':'+(typeof v==='number'?v+'px':v)).join(';');
 return `<article class="team-player-card football-player-card"><div class="football-player-portrait"><span class="football-player-photo-frame"><img src="data:${p.type};base64,${readFileSync('public'+p.localPath).toString('base64')}" alt="${escape(p.name)}" style="${inline}" width="100" height="100"></span></div><h3>${escape(p.name)}</h3></article>`;
}).join('');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1100,height:550},deviceScaleFactor:2});
 await page.setContent(`<html><head><style>${css}body{background:#102136;color:#e2e8f0;font:14px sans-serif;padding:24px}main{display:grid;grid-template-columns:repeat(5,1fr);gap:24px}.team-player-card{text-align:center;min-width:0}.team-player-card h3{font-size:14px;font-weight:500}</style></head><body><main>${cards}</main></body></html>`);
 await page.locator('img').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
 if(await page.locator('img').count()!==rows.length)throw Error('Missing portrait');
 await page.screenshot({path:out+'/portraits-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:850});
 await page.addStyleTag({content:'main{grid-template-columns:repeat(2,1fr)}'});
 await page.screenshot({path:out+'/portraits-mobile.png',fullPage:true});
 writeFileSync(out+'/checked.json',JSON.stringify({players:rows.map(p=>({id:p.id,name:p.name,sha256:p.sha256})),loaded:rows.length},null,2));
}finally{await browser.close();}
