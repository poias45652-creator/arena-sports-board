import {createBaseballRefreshLoops} from '@/server/baseball-refresh-loop.mjs';
import {getBackgroundController,setBackgroundController} from '@/server/baseball-background-state.mjs';
import {dayInTaipei} from '@/server/baseball-current.mjs';
import {getInternationalLive,getInternationalPregame} from './international-feed';
export function startInternationalBackground(){
 if(getBackgroundController())return;
 const controller=createBaseballRefreshLoops({day:dayInTaipei,getLive:getInternationalLive,getPregame:getInternationalPregame,
  onTick:(state:any)=>console.info('baseball-background-tick',JSON.stringify(state))});
 setBackgroundController(controller);controller.start();
 for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>controller.stop());
 console.info('baseball-background-started',JSON.stringify({leagues:['CPBL','NPB','KBO'],mode:'in-process',livePollMs:60000,statsPollMs:300000,continuousAcrossHostingSleep:false}));
}
