export async function register(){
 if(process.env.NEXT_RUNTIME==='nodejs'&&process.env.YJ_BACKGROUND_REFRESH==='1'){
  const {startInternationalBackground}=await import('./lib/international-background');
  startInternationalBackground();
  if(process.env.RENDER_SERVICE_ID==='srv-dahruorm8hqs73d57edg'){
   const {startNbaStartupWarmup}=await import('./lib/nba-startup-warmup');
   startNbaStartupWarmup();
  }
 }
}
