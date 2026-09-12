const events:Record<string,string>={single:'一壘安打',double:'二壘安打',triple:'三壘安打',home_run:'全壘打',strikeout:'三振',strikeout_double_play:'三振雙殺',walk:'四壞保送',intent_walk:'故意四壞',hit_by_pitch:'觸身球',field_out:'擊球出局',force_out:'封殺出局',grounded_into_double_play:'滾地雙殺',double_play:'雙殺',triple_play:'三殺',field_error:'失誤上壘',fielders_choice:'野手選擇',fielders_choice_out:'野手選擇出局',sac_fly:'高飛犧牲打',sac_bunt:'犧牲觸擊',sac_fly_double_play:'高飛犧牲雙殺',sac_bunt_double_play:'犧牲觸擊雙殺',catcher_interf:'捕手妨礙',batter_interference:'打者妨礙',runner_out:'跑者出局',other_out:'出局',stolen_base_2b:'盜上二壘',stolen_base_3b:'盜上三壘',stolen_base_home:'盜本壘',caught_stealing_2b:'盜二壘失敗',caught_stealing_3b:'盜三壘失敗',caught_stealing_home:'盜本壘失敗',pickoff_1b:'一壘牽制出局',pickoff_2b:'二壘牽制出局',pickoff_3b:'三壘牽制出局',wild_pitch:'暴投',passed_ball:'捕逸',balk:'投手犯規',pitching_substitution:'更換投手',offensive_substitution:'進攻換人',defensive_substitution:'守備換人',defensive_switch:'守備位置調整',game_advisory:'比賽狀態',mound_visit:'教練上丘',batter_timeout:'打者暫停',pitcher_step_off:'投手退板'};
const outs:Record<string,string>={Flyout:'高飛球出局',Groundout:'滾地球出局',PopOut:'內野高飛球出局','Pop Out':'內野高飛球出局',Lineout:'平飛球出局',BuntGroundout:'觸擊滾地球出局','Bunt Groundout':'觸擊滾地球出局',BuntPopOut:'觸擊高飛球出局','Bunt Pop Out':'觸擊高飛球出局'};
export function playEventZh(type:string,event:string){return outs[event]||events[type]||event||'打席進行中';}
export function pitchCallZh(call:string,fallback:string){return ({B:'壞球',C:'看著好球',S:'揮棒落空',F:'界外球',T:'擦棒被捕',L:'觸擊界外',M:'觸擊落空',W:'擋球揮空',Q:'防盜壘壞球揮空',H:'觸身球',I:'故意壞球',P:'防盜壘壞球',D:'擊球進場',E:'擊球進場・得分',X:'擊球進場・出局'} as Record<string,string>)[call]||fallback;}
export function inningRun(line:any,side:'away'|'home',inning:number,state:string):string{
 const raw=line?.innings?.find((i:any)=>i.num===inning)?.[side]?.runs;
 if(Number.isInteger(raw)&&raw>=0)return String(raw);
 if(raw==='X'||raw==='x')return 'X';
 const current=line?.currentInning,scheduled=line?.scheduledInnings??9;
 if(state==='Final'&&side==='home'&&inning===current&&inning>=scheduled&&line?.isTopInning===true&&Number.isFinite(line?.teams?.home?.runs)&&Number.isFinite(line?.teams?.away?.runs)&&line.teams.home.runs>line.teams.away.runs)return 'X';
 if(!current||inning>current||inning===current&&side==='home'&&line?.isTopInning===true)return '';
 return '—';
}
