// Use the recorded outcome, even when a description mentions several players.
export function courtAction(text, scoring, play={}) {
  const value=String(text||'');
  if(play.action&&/^[\d]{3}$/.test(play.action)){
    const label=value.split('・').at(-1);
    if(label&&/[\u3400-\u9fff]/.test(label))return label;
  }
  if(play.type==='period'||play.type==='fixture')return value.includes('結束')?'比賽時段結束':value.includes('開始')?'比賽時段開始':'比賽狀態更新';
  if(/end of|本節結束|比賽結束/i.test(value))return /end of game|比賽結束/i.test(value)?'比賽結束':'本節結束';
  if(/turnover|失誤/i.test(value))return /bad pass|傳球失誤/i.test(value)?'傳球失誤':'失誤';
  if(/foul|犯規/i.test(value))return '犯規';
  if(/block|阻攻|封阻/i.test(value))return '阻攻';
  const missed=play.made===false||/miss|不進|未進|未中|未命中/i.test(value);
  const shot=play.type==='freeThrow'||/罰球|free throw/i.test(value)?'罰球':
    play.attempt===3||play.type==='3pt'||/三分|three[ -]point|3[ -]pt/i.test(value)?'三分':
    /dunk|灌籃/i.test(value)?'灌籃':/layup|上籃/i.test(value)?'上籃':
    play.attempt===2||play.type==='2pt'?'兩分':'';
  if(scoring)return shot?shot+'命中':'得分';
  if(missed)return (shot||'出手')+'未中';
  if(/rebound|籃板/i.test(value))return /offensive|進攻/i.test(value)?'進攻籃板':/defensive|防守/i.test(value)?'防守籃板':'籃板';
  if(/steal|抄截/i.test(value))return '抄截';
  if(/assist|助攻/i.test(value))return '助攻';
  if(/timeout|暫停/i.test(value))return '暫停';
  if(/substitution|enters the game|換人|替換/i.test(value))return '換人';
  if(/jump ball|gains possession|跳球/i.test(value))return '跳球';
  if(/violation|違例/i.test(value))return '違例';
  if(/challenge|review|判讀/i.test(value))return '裁判審查';
  return '回合更新';
}
