import type {AiEvidence} from './ai-assistant';
import type {BasketballDetail} from './basketball-live';
import type {FootballGame} from './football';
import type {FootballDetail} from './football-live';
import type {NbaGame} from './nba';

type Game = NbaGame | FootballGame;
const fact = (id:string,text:string):AiEvidence => ({id:'board-'+id,topic:'data',text});
const validScore = (n:number|null):n is number => n!==null&&Number.isInteger(n)&&n>=0;
const periodName = (n:number) => n<=4?`第 ${n} 節`:`延長賽第 ${n-4} 節`;

export function scheduledStartEvidence(start:string,away:string,home:string):AiEvidence{
 const time=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(Date.parse(start));
 return fact('start',`本場尚未開賽。台灣時間 ${time} 開賽，${away}（客）對 ${home}（主）。`);
}

// Use only the site's verified, date-filtered fixture. Final scores and box
// scores are observations and must never become reasons for a pregame pick.
export function scoreboardEvidence(game:Game,now=Date.now()):AiEvidence[]{
 const {state,homeScore,awayScore}=game;
 const football='statusName' in game;
 const start=Date.parse(game.start);
 if(!Number.isFinite(start))return [];
 if(state==='scheduled'&&start<=now)return [];
 const facts:AiEvidence[]=[];
 if(state==='scheduled'&&game.timeConfirmed)facts.push(scheduledStartEvidence(game.start,game.away.name,game.home.name));
 if(state!=='live'&&state!=='final'||start>now)return facts;
 if(football&&state==='final'&&!['STATUS_FULL_TIME','STATUS_FINAL','STATUS_FINAL_AET','STATUS_FINAL_PEN'].includes(game.statusName))return facts;
 if(!validScore(homeScore)||!validScore(awayScore)||!football&&state==='final'&&(homeScore===awayScore||homeScore===0||awayScore===0))return facts;
 const shootout=football&&game.statusName==='STATUS_FINAL_PEN';
 const outcome=homeScore===awayScore?(state==='live'?'雙方平手':'雙方戰平'):`${homeScore>awayScore?game.home.name:game.away.name}${state==='live'?'領先':'獲勝'}`;
 facts.push(fact(state==='final'?'final':'live',`ESPN ${game.statusLabel}，${game.away.name}（客）${awayScore} 比 ${homeScore} ${game.home.name}（主）。${shootout?'此比分未含十二碼決勝結果。':outcome+'。'}`));
 if(!football&&game.quarters.length){
  const quarters=game.quarters.filter(q=>q.period<=game.period&&validScore(q.home)&&validScore(q.away));
  // Partial/mismatched finals must not be presented as a complete breakdown.
  const complete=quarters.length===game.period&&quarters.every((q,i)=>q.period===i+1)&&
   quarters.reduce((s,q)=>s+q.home!,0)===homeScore&&quarters.reduce((s,q)=>s+q.away!,0)===awayScore;
  if(complete&&quarters.length)facts.push(fact('periods',`各節得分（${game.away.name}在前，${game.home.name}在後）\n`+
   quarters.map(q=>`${periodName(q.period)}　${q.away} 比 ${q.home}`).join('\n')));
 }
 return facts;
}

export function boxScoreEvidence(detail:FootballDetail|BasketballDetail,game:Game):AiEvidence[]{
 // A live box score can lag one fetch behind the scoreboard.
 if(detail.game.state!==game.state||detail.game.homeScore!==game.homeScore||detail.game.awayScore!==game.awayScore)return [];
 if('stats' in detail){
  const keys=['totalShots','shotsOnTarget','possessionPct','wonCorners'];
  return detail.stats.filter(s=>keys.includes(s.key)&&[s.away,s.home].every(v=>s.key==='possessionPct'?/^\d+(?:\.\d+)?%$/.test(v)&&Number.parseFloat(v)<=100:/^\d+$/.test(v)))
   .map(s=>fact(s.key,`${s.label}：${game.away.name} ${s.away}，${game.home.name} ${s.home}。`));
 }
 const players:{name:string;team:string;points:number}[]=[];
 for(const side of ['away','home'] as const){
  const team=detail.teams.find(row=>row.team.id===game[side].id);
  if(!team)return [];
  let total=0;
  for(const player of team.players){
   if(player.didNotPlay)continue;
   const points=player.stats.points;
   // Some unused players have an empty row even when didNotPlay is false.
   if(!points&&!player.stats.minutes)continue;
   if(!/^\d+$/.test(points))return [];
   total+=Number(points);
   players.push({name:player.name,team:team.team.name,points:Number(points)});
  }
  if(total!==game[side==='away'?'awayScore':'homeScore'])return [];
 }
 const high=Math.max(...players.map(p=>p.points));
 if(!(high>0))return [];
 const names=players.filter(p=>p.points===high).map(p=>`${p.team}的 ${p.name}`);
 return [fact('scorer',`${game.state==='final'?'全場':'截至目前'}得分最高：${names.join('、')}${names.length>1?'並列':''}，${high} 分。`)];
}
