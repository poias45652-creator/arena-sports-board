export async function register(){
 if(process.env.NEXT_RUNTIME==='nodejs'&&process.env.YJ_BACKGROUND_REFRESH==='1'){
  const {startInternationalBackground}=await import('./lib/international-background');
  startInternationalBackground();
 }
}
