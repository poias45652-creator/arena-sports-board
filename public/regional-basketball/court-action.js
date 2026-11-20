// Classify the recorded play. A team's side on the graphic denotes team identity.
export function courtAction(text, scoring) {
  const value = String(text || '');
  if (/罰球|free throw/i.test(value)) return scoring ? '罰球命中' : /miss|不進|未中|未命中/i.test(value) ? '罰球未中' : '罰球';
  if (scoring) return /三分|three[ -]point|3[ -]pt/i.test(value) ? '三分命中' : '得分';
  if (/rebound|籃板/i.test(value)) return '籃板';
  if (/foul|犯規/i.test(value)) return '犯規';
  if (/turnover|失誤/i.test(value)) return '失誤';
  if (/block|阻攻|封阻/i.test(value)) return '阻攻';
  if (/steal|抄截/i.test(value)) return '抄截';
  if (/miss|未中|未命中|不進/i.test(value)) return '出手未中';
  if (/timeout|暫停/i.test(value)) return '暫停';
  if (/substitution|enters the game|換人|替換/i.test(value)) return '換人';
  return '回合更新';
}
