const KEY=Symbol.for('yj.baseball.background.v1');
export const getBackgroundController=()=>globalThis[KEY]||null;
export function setBackgroundController(controller){globalThis[KEY]=controller;}
export function baseballBackgroundStatus(){
  return getBackgroundController()?.snapshot()||{
    enabled:false,mode:'in-process',continuousAcrossHostingSleep:false,leagues:[]};
}
