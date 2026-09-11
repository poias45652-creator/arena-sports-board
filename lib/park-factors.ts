const teamIds:Record<string,number>={Angels:108,Diamondbacks:109,Orioles:110,'Red Sox':111,Cubs:112,Reds:113,Guardians:114,Rockies:115,Tigers:116,Astros:117,Royals:118,Dodgers:119,Nationals:120,Mets:121,Athletics:133,Pirates:134,Padres:135,Mariners:136,Giants:137,Cardinals:138,Rays:139,Rangers:140,'Blue Jays':141,Twins:142,Phillies:143,Braves:144,'White Sox':145,Marlins:146,Yankees:147,Brewers:158};
export const parkFactorsUrl=(year:number)=>`https://www.fangraphs.com/tools/guts?season=${year}&teamid=0&type=pf`;
export function parseParkFactors(html:string,year:number){
 if(html.length>2000000||!html.includes('All Park Factors have already been halved'))throw new Error('球場因子格式或定義改變');
 const embedded=html.match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];if(!embedded)throw new Error('球場因子資料未取得');
 const q=JSON.parse(embedded)?.props?.pageProps?.dehydratedState?.queries?.find((q:any)=>q.queryKey?.[0]==='tools/guts/data');
 const params=q?.queryKey?.[1],data=q?.state?.data;
 if(params?.season!==year||params?.type!=='pf'||params?.teamid!==0||!Array.isArray(data)||data.length!==30)throw new Error('球場因子年份或完整度不符');
 const seen=new Set<number>();const rows=data.map((r:any)=>{const teamId=teamIds[r.Team];if(!teamId||seen.has(teamId)||r.Season!==year)throw new Error('球場因子球隊無法唯一對應');seen.add(teamId);
  const metrics:Record<string,number>={};for(const k of ['Basic (5yr)','3yr','1yr','1B','2B','3B','HR','SO','BB','GB','FB','LD','IFFB','FIP']){if(typeof r[k]!=='number'||!Number.isFinite(r[k])||r[k]<=0)throw new Error('球場因子數值缺漏');metrics[k]=r[k];}
  return {teamId,team:r.Team,metrics,venueId:null,venueVerified:false};
 });
 return {factorSeason:year,rows,source:parkFactorsUrl(year),fetchedAt:new Date().toISOString(),sourceUpdatedAt:null,scale:'100_neutral_halved_for_full_season',modelApplied:false,status:'reference_only'};
}
