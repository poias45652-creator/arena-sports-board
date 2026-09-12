import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const code=ts.transpileModule(readFileSync(new URL('../lib/pitcher-era.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {parsePitcherEras,parsePitcherRates}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const row=(era,extra={})=>({season:'2026',sport:{id:1},gameType:'R',player:{id:123},team:{id:147},stat:{era},...extra});
const data=(splits,group='pitching',type='season')=>({people:[{id:123,stats:[{group:{displayName:group},type:{displayName:type},splits}]}]});

test('reads official season ERA and preserves a genuine zero',()=>{
  assert.equal(parsePitcherEras(data([row('3.41')]),2026)[123],3.41);
  assert.equal(parsePitcherEras(data([row('0.00')]),2026)[123],0);
});
test('does not turn missing or undefined ERA into zero',()=>{
  for(const value of [null,undefined,'','-.--','∞','NaN','-1.00',Infinity])assert.equal(parsePitcherEras(data([row(value)]),2026)[123],null);
});
test('rejects the wrong pitcher, season, competition and stat group',()=>{
  for(const extra of [{season:'2025'},{sport:{id:11}},{gameType:'S'},{player:{id:456}}])assert.equal(parsePitcherEras(data([row('3.41',extra)]),2026)[123],null);
  assert.equal(parsePitcherEras(data([row('3.41')],'hitting'),2026)[123],null);
  assert.equal(parsePitcherEras(data([row('3.41')],'pitching','career'),2026)[123],null);
});
test('uses the all-team total after a trade and rejects ambiguous stints',()=>{
  const stints=[row('1.00'),row('5.00',{team:{id:137}})];
  assert.equal(parsePitcherEras(data(stints),2026)[123],null);
  assert.equal(parsePitcherEras(data([...stints,row('4.20',{team:undefined})]),2026)[123],4.2);
});

test('WHIP uses the pitching WHIP field, independently of ERA and opponent OBP',()=>{
  const rates=parsePitcherRates(data([row('3.41',{stat:{era:'3.41',whip:'1.09',obp:'.273'}})]),2026)[123];
  assert.deepEqual(rates,{era:3.41,whip:1.09});
  assert.equal(parsePitcherRates(data([row(null,{stat:{whip:'2.25'}})]),2026)[123].whip,2.25);
});
test('WHIP preserves zero, rejects missing values and respects season identity',()=>{
  assert.equal(parsePitcherRates(data([row('3.41',{stat:{era:'3.41',whip:'0.00'}})]),2026)[123].whip,0);
  for(const whip of [null,undefined,'','-.--',Infinity,'-1.00'])assert.equal(parsePitcherRates(data([row('3.41',{stat:{era:'3.41',whip}})]),2026)[123].whip,null);
  assert.deepEqual(parsePitcherRates(data([row('3.41',{season:'2025',stat:{era:'3.41',whip:'1.09'}})]),2026)[123],{era:null,whip:null});
});
