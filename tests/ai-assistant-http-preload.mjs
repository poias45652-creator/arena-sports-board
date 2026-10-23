// Isolated synthetic fixtures for the compiled assistant; never load in production.
import './render-http-preload.mjs';
if(process.env.YJ_AI_ASSISTANT_SMOKE!=='1')throw Error('Test-only assistant fixture');
const realFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
 if(['localhost','127.0.0.1'].includes(url.hostname))return realFetch(input,options);
 const season=new Date().getUTCFullYear();
 if(url.hostname==='api.openai.com'){
  const body=JSON.parse(options.body),data=JSON.parse(body.input);
  const id=data.evidence[0].id;
  return Response.json({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(data.question.includes('股票')?{scope:'out_of_scope',intent:'data',factIds:[]}:{scope:'match',intent:'data',factIds:[id]})}]}]});
 }
 if(url.hostname==='statsapi.mlb.com'&&url.pathname.endsWith('/schedule'))return Response.json({dates:[{games:[{gamePk:999001,gameDate:new Date(Date.now()+3600000).toISOString(),season:String(season),gameType:'R',status:{abstractGameState:'Preview',detailedState:'Scheduled'},teams:{home:{team:{id:147,name:'Yankees'},leagueRecord:{wins:90,losses:60},probablePitcher:{id:123001,fullName:'測試主隊投手'}},away:{team:{id:121,name:'Mets'},leagueRecord:{wins:75,losses:75},probablePitcher:{id:123002,fullName:'測試客隊投手'}}}}]}]});
 if(url.hostname==='statsapi.mlb.com'&&url.pathname.endsWith('/people'))return Response.json({people:[123001,123002].map((id,i)=>({id,stats:[{group:{displayName:'pitching'},type:{displayName:'season'},splits:[{season:String(season),sport:{id:1},gameType:'R',player:{id},stat:{era:i?'4.00':'2.00',whip:i?'1.40':'1.10'}}]}]}))});
 return new Response('Fixture source unavailable',{status:503});
};
