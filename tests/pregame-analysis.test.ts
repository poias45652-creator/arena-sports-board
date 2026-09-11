import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleAnalysis,inningsOuts} from '../lib/pregame-analysis';
const now=Date.parse('2026-09-10T12:00:00Z'),stamp=new Date(now).toISOString();
const game:any={id:1,date:'2026-09-10T16:15:00Z',season:2026,gameType:'R',state:'Preview',status:'Scheduled',startTimeTBD:false,away:{id:139,name:'Tampa Bay Rays',pitcherId:100,name2:'',pitcherName:'Pitcher Away',wins:80,losses:60},home:{id:144,name:'Atlanta Braves',pitcherId:200,pitcherName:'Pitcher Home',wins:80,losses:60}};
function fixture(){
 const snapshot=(x:any)=>({fetchedAt:stamp,source:'fixture',...x});const data:any={};
 for(const side of ['away','home']){const team=game[side],base=side==='away'?100:200;data['roster-'+team.id]=snapshot({players:[{id:base,name:team.pitcherName,throws:'R'},...Array.from({length:9},(_,i)=>({id:base+i+1,name:`Player ${base+i+1}`}))]});data['pitcher-'+base]=snapshot({pitcherId:base,season:2026,games:[1,2,3].map((i)=>({date:`2026-09-0${i}`,innings:'6.1',earnedRuns:2,officialPitchCount:90})),speedChanges:[]});}
 const lineupSide=(side:string)=>({teamId:game[side].id,status:'confirmed',pitcher:game[side].pitcherName,players:data['roster-'+game[side].id].players.slice(1).map((p:any)=>({name:p.name,bats:'R'}))});
 data.lineups=snapshot({games:[{dateET:'2026-09-10',timeET:'12:15 PM ET',away:lineupSide('away'),home:lineupSide('home'),dome:false,temperatureF:85,windMph:2,windDirection:'R-L',precipitation:0,umpire:''}]});
 data.bullpen=snapshot({rows:[139,144].map(teamId=>({teamId,name:'Reliever',days:[10,15,0,0,0],last3:25}))});data['fg-injuries']=snapshot({year:2026,rows:[]});
 for(const k of ['fg-bat-left','fg-bat-right'])data[k]=snapshot({year:2026,rows:[139,144].flatMap(id=>data['roster-'+id].players.slice(1).map((p:any)=>({playerId:p.id,sampleSize:80,metrics:{'wRC+':110,wOBA:.34}})))});
 for(const k of ['fg-pit-left','fg-pit-right'])data[k]=snapshot({year:2026,rows:[100,200].map(playerId=>({playerId,sampleSize:100,metrics:{FIP:3.5,'K-BB%':.2}}))});
 return data;
}
test('confirmed, uniquely matched inputs are assembled without inventing advanced probabilities',()=>{const r=assembleAnalysis(game,fixture(),now);assert.deepEqual(r.issues,[]);assert.equal(r.features.away_lineup_wrc_plus,110);assert.equal(r.features.home_bullpen_last3_pitches,25);assert.equal(r.candidate.status,'untrained');assert.equal(r.candidate.probabilities,null);assert.equal(r.features.away_starter_recent_era,54/19);});
test('stale split data, uncertain lineups and injury conflicts block readiness',()=>{const d=fixture();d['fg-bat-right'].fetchedAt='2026-09-09T12:00:00Z';d.lineups.games[0].away.status='expected';d['fg-injuries'].rows=[{teamId:144,playerId:201,activeInjury:true,returnDate:null}];const r=assembleAnalysis(game,d,now);assert.equal(r.features.away_lineup_wrc_plus,null);assert.equal(r.candidate.status,'waiting_data');assert.ok(r.issues.some(x=>x.includes('打線未確認')));assert.ok(r.issues.some(x=>x.includes('傷兵')));});
test('does not guess ambiguous names, accept wrong game time or use same-day pitcher results',()=>{const d=fixture();d['roster-139'].players.push({id:999,name:'Player 101'});d['pitcher-100'].games[0].date='2026-09-10';const r=assembleAnalysis(game,d,now);assert.equal(r.context.sides.away.lineup[0].playerId,null);assert.equal(r.features.away_starter_recent_era,null);d.lineups.games[0].timeET='1:15 PM ET';assert.equal(assembleAnalysis(game,d,now).context.weather,null);});
test('baseball innings are outs, not decimal fractions',()=>{assert.equal(inningsOuts('5.2'),17);assert.equal(inningsOuts('5.3'),null);assert.equal(inningsOuts(null),null);});
