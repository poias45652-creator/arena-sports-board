import test from 'node:test';import assert from 'node:assert/strict';
import {addNpbContext} from '../server/baseball-npb-context.mjs';
const table=(cls,rows)=>`<table class="${cls}">${rows.map(r=>'<tr>'+r.map(c=>'<td>'+c+'</td>').join('')+'</tr>').join('')}</table>`;
function game(){return {id:'2021039438',date:'2026-09-20',home:{id:'4'},away:{id:'6'},starters:{home:null,away:null},lineups:{home:[],away:[]}};}
const page=text=>({text:`<title>2026年9月20日 中日vs広島</title><meta property="og:url" content="https://baseball.yahoo.co.jp/npb/game/2021039438/top">${text}`,url:'https://baseball.yahoo.co.jp/npb/game/2021039438/top',fetchedAt:'2026-09-20T05:00:00Z'});
test('probable pitchers come from their exact team section and ERA from season row',()=>{
 const section=`<section class="bb-splits__item"><div class="bb-splitsHead--npbTeam4">中日</div>${table('',[['背番号','投','選手名'],['22','左投','大野 雄大']])}${table('',[['','防御率','登板','勝利','敗戦'],['今季','2.14','20','9','6'],['対戦','9.99','1','0','1']])}</section>`;
 const g=addNpbContext(game(),page('<div id="async-starter">'+section+'</div><div id="async-preview"></div>'));
 assert.equal(g.starters.home.name,'大野 雄大');assert.equal(g.starters.home.era,2.14);assert.equal(g.starters.home.wins,9);assert.equal(g.starters.away,null);
});
test('bench and malformed batting orders are not promoted to a complete starting lineup',()=>{
 const h=table('bb-splitsTable--npbTeam4',[['選手名','防御率'],['候補投手','1.00']])+table('bb-splitsTable--npbTeam4',[['打順','位置','選手名'],...Array.from({length:9},()=>['1','中','同一打者'])]);
 const g=addNpbContext(game(),page(h));assert.equal(g.starters.home,null);assert.equal(g.lineups.home.length,0);
});
test('another game or date is rejected before adding player data',()=>{
 assert.throws(()=>addNpbContext(game(),page('').text?{...page(''),text:page('').text.replaceAll('2021039438','2021039439')}:null),/identity/);
 assert.throws(()=>addNpbContext({...game(),date:'2026-09-21'},page('')),/date/);
});
