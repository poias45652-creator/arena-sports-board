import {nblPhase} from '../../public/regional-basketball/nbl-phase.mjs';
const calendar = 'https://schedule.nbl.com.au/api/calendar/';
const matchSite = 'https://schedule.nbl.com.au/match?league=nbl&match=';
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const scoreKeys = ['home','away'];
const espnIds = {
  "401881692": "24ff5551-7116-11f1-9cfa-319ad1831e40",
  "401885159": "ad1c4217-6ba9-11f1-9596-77eb1ebeae90",
  "401885515": "215f9ade-6baa-11f1-bb6b-07d52d4d0bee",
  "401881691": "7db697a5-6baa-11f1-88f6-c5c21d3ac5e7",
  "401875415": "fff96538-589e-11f1-8ba1-ef8e431e586e",
  "401875411": "6fbdf1fb-58a2-11f1-97b9-4be3834fb189",
  "401875413": "8804e232-58a2-11f1-b145-5fde0a48d643",
  "401875414": "9ee46f14-58a2-11f1-a513-af6c1d773ffa",
  "401875406": "d31781ae-58a2-11f1-8889-5d2da9e328ea",
  "401875405": "bc4084a5-58a2-11f1-bbbc-27dab0c7edff",
  "401875410": "62779346-58a3-11f1-a0fa-254978c4e77d",
  "401875412": "7c796a24-58a3-11f1-a418-35ee37a73882",
  "401875409": "2435e797-58a7-11f1-89ee-7d5c83c81942",
  "401875404": "3d09795f-58a7-11f1-aed3-b7a799a5060e",
  "401912367": "7169f9fd-9a9e-11f1-8ce7-4f7f20603153",
  "401913070": "3c4c6df2-9cf9-11f1-beab-e764f22a2faf",
  "401915913": "37c8878a-a503-11f1-949b-c5f9a40c90fb",
  "401907769": "61007dcc-9484-11f1-a9bd-e70314674d85",
  "401875251": "36dbeb55-58ad-11f1-a69b-43a6b5595d3e",
  "401875243": "36e0e11c-58ad-11f1-93d0-e78395b5c13c",
  "401875263": "3700706c-58ad-11f1-ae9e-a93048d70593",
  "401875242": "36e225dc-58ad-11f1-b0d4-e94b8c35b649",
  "401875253": "36e80b8c-58ad-11f1-ab03-2572c13c410b",
  "401875244": "36e7aa3c-58ad-11f1-b88d-1138b8cb68ba",
  "401875241": "36e0818b-58ad-11f1-89d2-fb9d3a8baf78",
  "401875267": "3705a1db-58ad-11f1-af46-11cc539397b9",
  "401875245": "36e93c3b-58ad-11f1-8215-c5dc2cf09b1f",
  "401875252": "36f361e7-58ad-11f1-a449-59142d8bd7d5",
  "401875254": "36f4ac8b-58ad-11f1-bf00-2942781e7154",
  "401875257": "36f8857c-58ad-11f1-9db7-b15d4ea6aed8",
  "401875277": "3715a95f-58ad-11f1-9621-61e4f965035a",
  "401875246": "36f8c608-58ad-11f1-aa0e-2bbb920071b5",
  "401875279": "3718a994-58ad-11f1-add9-d98e318e0a1e",
  "401875255": "36f713cb-58ad-11f1-b8d2-f1316c48f9c2",
  "401875256": "36f2e004-58ad-11f1-aa96-6775645a7b9a",
  "401875287": "3724384a-58ad-11f1-bbdc-6d6f61141df2",
  "401875250": "37007b03-58ad-11f1-89e4-67a8251482c3",
  "401875260": "36fd4a13-58ad-11f1-9ca2-a9a6cbaba447",
  "401875262": "36fdee6b-58ad-11f1-ac5d-19f7d3a187d4",
  "401875248": "36fff950-58ad-11f1-8de3-37c9e1eacb09",
  "401875259": "36fc0fd6-58ad-11f1-8ed4-c9ba3efad88d",
  "401875265": "37023ff5-58ad-11f1-88e1-6f9744c8d3ab",
  "401875247": "36fe21e3-58ad-11f1-ba69-dd12ee8972e9",
  "401875266": "3703c23b-58ad-11f1-bf9b-db7d6019155e",
  "401875268": "3705bd4d-58ad-11f1-8baa-ede76c1d904d",
  "401875249": "36fffdc1-58ad-11f1-b499-f3575d2dc39f",
  "401875258": "36fb1b72-58ad-11f1-a2a4-7da015763581",
  "401875269": "3706e834-58ad-11f1-8519-a362560fc147",
  "401875261": "36fd506c-58ad-11f1-a57f-6d6fb61b331b",
  "401875264": "3700bf63-58ad-11f1-89a0-03625b994063",
  "401875270": "37082c14-58ad-11f1-8882-9bf90a853321",
  "401875271": "3707e960-58ad-11f1-a8d4-819ec06531e4",
  "401875281": "37085418-58ad-11f1-9e12-411a11259918",
  "401875272": "371032f3-58ad-11f1-a72d-69c2b72ae0a9",
  "401875282": "370d79db-58ad-11f1-8bd9-59a0fb078f66",
  "401875283": "370e679e-58ad-11f1-acba-8b618b817e22",
  "401875274": "371130fd-58ad-11f1-aac7-754512109772",
  "401875273": "37106a00-58ad-11f1-a7e9-87e414b8c2d5",
  "401875275": "3711a017-58ad-11f1-b649-93b9302663c0",
  "401875276": "3714bc12-58ad-11f1-bdd2-69207a436dad",
  "401875284": "3716743f-58ad-11f1-8c04-1fa229f84a5e",
  "401875292": "371aff1e-58ad-11f1-b4cd-0919017f2391",
  "401875280": "37196322-58ad-11f1-9f91-61e38b2284ba",
  "401875293": "371d934c-58ad-11f1-8edf-4b570c3bab13",
  "401875278": "3718733a-58ad-11f1-b000-3ffa71afcf53",
  "401875291": "3719f6ce-58ad-11f1-b7b9-736e6b79ac99",
  "401875285": "37214b47-58ad-11f1-9b38-e78395b5c13c",
  "401875313": "374fd3d1-58ad-11f1-945e-cbcb1725dbfe",
  "401875288": "372517f1-58ad-11f1-b481-53622f199a68",
  "401875301": "372b8b55-58ad-11f1-9407-d95637fbed2b",
  "401875290": "3729bbac-58ad-11f1-b394-cbe0cbdf48fe",
  "401875295": "3723e003-58ad-11f1-b68b-09df0c3978fa",
  "401875294": "3723d8e8-58ad-11f1-b04c-17c1a1f1f487",
  "401875289": "37256511-58ad-11f1-b841-b5c487635207",
  "401875286": "3723d03c-58ad-11f1-9032-15ea51636534",
  "401875307": "37495c97-58ad-11f1-8f28-d7e4e018b88d",
  "401875296": "37289ea9-58ad-11f1-9790-bd240d5ec994",
  "401875326": "37541928-58ad-11f1-86bd-87c06d92085a",
  "401875328": "375813e7-58ad-11f1-8c9c-2572c13c410b",
  "401875297": "373d1fa2-58ad-11f1-ac10-0b8a9f33c19f",
  "401875310": "374d40eb-58ad-11f1-926c-d7c956f67204",
  "401875299": "3746d2f5-58ad-11f1-9032-1138b8cb68ba",
  "401875356": "377ccd38-58ad-11f1-9384-d30081aaf8c6",
  "401875302": "3743885e-58ad-11f1-b2f7-c9ba3efad88d",
  "401875298": "3746a5e8-58ad-11f1-8707-7d800a023985",
  "401875300": "37470d73-58ad-11f1-9bf1-130129845108",
  "401875306": "3748f8f0-58ad-11f1-bb02-b15d4ea6aed8",
  "401875305": "3748b33b-58ad-11f1-9f9a-71e9315f7411",
  "401875351": "37779e30-58ad-11f1-a2d6-d729b42cc855",
  "401875338": "37726ee0-58ad-11f1-8d86-85bf0639ac6b",
  "401875314": "3750b552-58ad-11f1-a12d-7ddf75ccac0d",
  "401875315": "37514d45-58ad-11f1-917b-0f009f2e4d02",
  "401875309": "374c5a9d-58ad-11f1-8829-1daf76a0ede8",
  "401875308": "374bfa7a-58ad-11f1-80a5-a590ae8a6049",
  "401875304": "3748a57b-58ad-11f1-a4fa-fb9d3a8baf78",
  "401875321": "37509e79-58ad-11f1-9e3b-fbbd24deadd3",
  "401875323": "3751fcc5-58ad-11f1-a32f-279e256f2655",
  "401875340": "37770bc1-58ad-11f1-a93a-ebcda8a5e5b1",
  "401875311": "3747bbe2-58ad-11f1-a09d-892c4438c413",
  "401875312": "374e0e41-58ad-11f1-a41a-bf8ef84c1f3a",
  "401875325": "3752cf25-58ad-11f1-9654-2942781e7154",
  "401875303": "3747bba2-58ad-11f1-b586-c9fe4bf38829",
  "401875339": "37754382-58ad-11f1-a2bf-754528413e51",
  "401875346": "37788a52-58ad-11f1-b28e-b7b6f460181f",
  "401875322": "37510e22-58ad-11f1-b8d1-0361ae94d7e7",
  "401875316": "3754cc1a-58ad-11f1-bc46-67e3bf80bedf",
  "401875332": "375da128-58ad-11f1-86da-f1316c48f9c2",
  "401875324": "37529d1c-58ad-11f1-8656-3fa3ca05d3dc",
  "401875318": "3755d06f-58ad-11f1-9b2c-679c79eacdbc",
  "401875317": "3754e87b-58ad-11f1-bcdd-c1f492925f49",
  "401875330": "375d497d-58ad-11f1-bfc4-7b56785c5eab",
  "401875329": "375a042e-58ad-11f1-a652-5bbfc6dce39b",
  "401875341": "375df79f-58ad-11f1-b396-39b3918ccc00",
  "401875334": "3761d184-58ad-11f1-84ea-411a11259918",
  "401875327": "3757e2b3-58ad-11f1-801d-e3b03d7fb141",
  "401875319": "37596f75-58ad-11f1-af00-fdfc50d4d18e",
  "401875331": "375b49f9-58ad-11f1-94c1-5dfcf5a874c7",
  "401875320": "3759b81c-58ad-11f1-a957-a93048d70593",
  "401875347": "377fd891-58ad-11f1-a6fa-c1b6941c6419",
  "401875333": "3761c65a-58ad-11f1-85ee-9bf90a853321",
  "401875342": "3763a871-58ad-11f1-bb01-15ea51636534",
  "401875337": "3770b91e-58ad-11f1-9efe-a362560fc147",
  "401875383": "379201a1-58ad-11f1-a7bf-ede76c1d904d",
  "401875343": "37699500-58ad-11f1-888a-e79a703f0b90",
  "401875335": "376b0d82-58ad-11f1-ba1c-11cc539397b9",
  "401875336": "376b1b7d-58ad-11f1-9638-61e4f965035a",
  "401875344": "3769a2ba-58ad-11f1-ba9d-6f9744c8d3ab",
  "401875371": "378eac70-58ad-11f1-89d4-c958368c756f",
  "401875382": "3791ec9a-58ad-11f1-8e37-819ec06531e4",
  "401875345": "376dd566-58ad-11f1-a40d-e78395b5c13c",
  "401875353": "377a706f-58ad-11f1-9081-95101c4b3f9d",
  "401875355": "377c8615-58ad-11f1-9f3b-1fa229f84a5e",
  "401875352": "3778a221-58ad-11f1-93c2-61e38b2284ba",
  "401875354": "377af928-58ad-11f1-af79-ad562dad26a0",
  "401875358": "377ea044-58ad-11f1-bd17-43a6b5595d3e",
  "401875357": "377cd763-58ad-11f1-8114-69c2b72ae0a9",
  "401875360": "37810606-58ad-11f1-9339-69207a436dad",
  "401875359": "377f12e2-58ad-11f1-a03f-e94b8c35b649",
  "401875361": "37811115-58ad-11f1-8a48-93b9302663c0",
  "401875348": "3784706a-58ad-11f1-962d-09df0c3978fa",
  "401875364": "37876f5f-58ad-11f1-b7ed-b5c487635207",
  "401875362": "3784d7da-58ad-11f1-88d9-53622f199a68",
  "401875394": "37a7ea49-58ad-11f1-903e-c9ba3efad88d",
  "401875369": "378cef96-58ad-11f1-a398-d95637fbed2b",
  "401875397": "37b32cce-58ad-11f1-8d47-bd240d5ec994",
  "401875395": "37abe4a4-58ad-11f1-9473-fb9d3a8baf78",
  "401875363": "3786d8e9-58ad-11f1-9a23-c5dc2cf09b1f",
  "401875396": "37b09e5c-58ad-11f1-8cc2-3f7e445158a4",
  "401875350": "3788eca5-58ad-11f1-a7af-754512109772",
  "401875400": "37b85f23-58ad-11f1-9eb0-2bbb920071b5",
  "401875367": "378ad286-58ad-11f1-b7d9-03625b994063",
  "401875402": "37b72cf1-58ad-11f1-9c01-6775645a7b9a",
  "401875366": "378a267b-58ad-11f1-b1d5-67a8251482c3",
  "401875384": "3794465d-58ad-11f1-a534-cb26a6dd9fe9",
  "401875368": "378b3988-58ad-11f1-a999-cb5b62df0525",
  "401875349": "3787b813-58ad-11f1-a901-7da015763581",
  "401875398": "37b5f457-58ad-11f1-bb17-2d4587dc1484",
  "401875365": "37882039-58ad-11f1-b46f-4bbabfa2dd4f",
  "401875370": "378d7045-58ad-11f1-be6f-59142d8bd7d5",
  "401875375": "37947616-58ad-11f1-a290-8da1c4ae1ac0",
  "401875399": "37b7122e-58ad-11f1-9780-077ff55f3c82",
  "401875373": "379304e6-58ad-11f1-a000-6d6f61141df2",
  "401875381": "37912f47-58ad-11f1-a905-9b50298fb358",
  "401875372": "37927ea9-58ad-11f1-816a-db7d6019155e",
  "401875376": "3794848c-58ad-11f1-8498-35ee37a73882",
  "401875374": "37931e61-58ad-11f1-982d-a93048d70593",
  "401875390": "379afd67-58ad-11f1-bee5-37c9e1eacb09",
  "401875385": "379682fb-58ad-11f1-bbe4-a9a6cbaba447",
  "401875386": "3796b045-58ad-11f1-ad75-2572c13c410b",
  "401875380": "379a322b-58ad-11f1-9321-87e414b8c2d5",
  "401875403": "37bd67c8-58ad-11f1-9904-6d6fb61b331b",
  "401875392": "379c3809-58ad-11f1-a3c5-0919017f2391",
  "401875378": "3799258e-58ad-11f1-9453-39f5f9ac4ced",
  "401875389": "37995628-58ad-11f1-a2d1-491075c94f1a",
  "401875388": "3797a4ad-58ad-11f1-bd80-679c79eacdbc",
  "401875379": "37995304-58ad-11f1-bced-f323fa41d58d",
  "401875377": "3797f6e3-58ad-11f1-87a8-fbbd24deadd3",
  "401875387": "37974b51-58ad-11f1-85a6-d3f8eb4e543c",
  "401875407": "37be2ab4-58ad-11f1-841c-2942781e7154",
  "401875391": "379c1ff2-58ad-11f1-b2ec-411a11259918",
  "401875408": "37c1c5ea-58ad-11f1-956b-892c4438c413",
  "401875401": "379eac2d-58ad-11f1-90d4-d98e318e0a1e",
  "401875393": "379fc3fc-58ad-11f1-9644-736e6b79ac99"
}; // Generated from fixtures matched on Taiwan date and both clubs.
const numeric = value => value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value);
const utcStamp = value => /[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value+'Z';
const taipei = value => new Date(new Date(value).getTime()+8*3600000).toISOString();
const teamCode = team => typeof team === 'object' && team ? team.team_code || null : null;
const refId = value => typeof value === 'string' ? value : value?.external_id || value?.id || null;
const norm = v => String(v||'').replace(/[^a-z0-9]/gi,'').toLowerCase();

function periodNumber(value, type) {
  const n=numeric(value);
  if (!n || n<0) return null;
  if (n>=11) return n-6;
  if (type==='overtime' && n<=4) return n+4;
  return n;
}
const label = n => !n ? null : n<=4 ? 'Q'+n : 'OT'+(n-4);
function gameClock(input) {
  if (input == null || input === '') return null;
  if (typeof input === 'number') return minuteString(Math.round(input*60));
  const v=String(input);
  const match=/^(?:(\d+):)?(\d{1,3}):(\d{2})(?:\.\d+)?$/.exec(v);
  if (match) return minuteString(((Number(match[1])||0)*60+Number(match[2]))*60+Number(match[3]));
  const iso=/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i.exec(v);
  return iso ? minuteString(Math.round((+iso[1]||0)*3600+(+iso[2]||0)*60+(+iso[3]||0))) : null;
}
const minuteString = seconds => String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');
const clockSeconds = time => time ? Number(time.split(':')[0])*60+Number(time.split(':')[1]) : null;
const fields={fgm:'field_goals_made',fga:'field_goals_attempted',threeMade:'three_points_made',threeAttempted:'three_points_attempted',twoMade:'two_points_made',twoAttempted:'two_points_attempted',ftm:'free_throws_made',fta:'free_throws_attempted',oreb:'offensive_rebounds',dreb:'defensive_rebounds',reb:'rebounds',ast:'assists',stl:'steals',blk:'blocks',turnovers:'turnovers',fouls:'personal_fouls',plusMinus:'plus_minus'};
const shooting={fg:['fgm','fga'],three:['threeMade','threeAttempted'],ft:['ftm','fta']};

function stats(record,participated=true) {
  const result={};
  for (const [key,field] of Object.entries(fields)) result[key]=participated ? numeric(record?.[field]) : null;
  result.tov=result.turnovers;
  for (const [key,[made,attempted]] of Object.entries(shooting)) {
    result[key]=result[made] != null && result[attempted] != null ? result[made]+'/'+result[attempted] : null;
  }
  return result;
}

const actions={fixture:'比賽',period:'本節',substitution:'換人','2pt':'兩分球','3pt':'三分球',assist:'助攻',turnover:'失誤',steal:'抄截',rebound:'籃板',foul:'犯規',freeThrow:'罰球',block:'阻攻',timeOut:'暫停',jumpBall:'跳球'};
const types={start:'開始',end:'結束',pending:'準備中',confirmed:'確認',in:'上場',out:'退場',defensive:'防守',offensive:'進攻',won:'取得球權',lost:'未取得球權',full:'長暫停',officials:'裁判暫停',commercial:'媒體暫停',personal:'個人犯規',drawn:'造成對手犯規',flagrant:'違反運動精神犯規',unsportsmanlike:'違反運動精神犯規',technical:'技術犯規',offensivegoaltending:'進攻干擾球',shotclock:'進攻時間到期',travel:'走步',badpass:'傳球失誤',outofbounds:'出界',backcourt:'回場',doubledribble:'二次運球',ballhandling:'控球失誤',carrying:'翻球','3sec':'三秒違例','5sec':'五秒違例','8sec':'八秒違例',alleyoop:'空中接力',alleyoopdunk:'空中接力灌籃',drivinglayup:'切入上籃',dunk:'灌籃',eurostep:'歐洲步',fadeaway:'後仰跳投',floatingjumpshot:'拋投',hookshot:'鉤射',jumpshot:'跳投',layup:'上籃',pullupjumpshot:'急停跳投',reverselayup:'反手上籃',stepbackjumpshot:'後撤步跳投',tipin:'補籃',turnaroundjumpshot:'轉身跳投',benchtechnical:'板凳技術犯規',coachtechnical:'教練技術犯規',categoryonetechnical:'第一類技術犯規',categorytwotechnical:'第二類技術犯規',disruptive:'干擾'};
const shotValue = type => ({'2pt':2,'3pt':3,freeThrow:1}[type] || 0);

function makePlay(raw,index,teamFor,people) {
  const n=periodNumber(raw.period,raw.period_type),time=gameClock(raw.clock);
  const pid=refId(raw.player)||raw.personId||null;
  const personName=raw.player?.full_name||people.get(pid)?.name||null;
  const k=norm(raw.sub_type);
  const freeThrow=/^(\d)of(\d)$/.exec(k);
  const type=actions[raw.action_type]||raw.readable_action_type||raw.action_type;
  const sub=freeThrow ? freeThrow[1]+'/'+freeThrow[2] : (types[k]||raw.sub_type);
  const result=shotValue(raw.action_type) && typeof raw.success==='boolean' ? (raw.success?'命中':'未進') : null;
  const team=teamFor(raw.team)||teamFor(raw.entityId);
  const clockOrder=clockSeconds(time) ?? (['end','confirmed'].includes(k) ? 0 : Infinity);
  const id=raw.eventId || raw.external_id || [label(n),raw.action_id??index,raw.timestamp??index].join('/');
  return {
    order:[n||0,clockOrder,String(raw.timestamp||''),numeric(raw.action_id)??index,index],
    play:{id,actionId:raw.action_id??null,period:label(n),clock:time,team,playerId:pid,name:personName,playerName:personName,
      type:raw.action_type||null,subType:raw.sub_type||null,made:shotValue(raw.action_type) && typeof raw.success==='boolean' ? raw.success : null,
      text:[personName,[type,sub].filter(Boolean).join('・'),result].filter(Boolean).join(' '),
      homeScore:numeric(raw.score_1),awayScore:numeric(raw.score_2)}
  };
}

function playerBox(row,team,final) {
  const p=row.player,id=refId(p);
  if (!id) return null;
  const min=gameClock(row.minutes) || gameClock(row.minutes_string);
  const floorTime=clockSeconds(min);
  const activeStats=['points','rebounds','assists','turnovers','steals','blocks','field_goals_attempted','free_throws_attempted','personal_fouls'].some(key=>(numeric(row[key])??0)>0);
  const participated=floorTime>0 || activeStats || row.participated===true;
  const recordedBench=!participated && (row.participated===false || floorTime===0);
  const didNotPlay=recordedBench && final;
  const name=p?.full_name || [p?.first_name,p?.last_name].filter(Boolean).join(' ') || null;
  return {id,playerId:id,team,name,number:row.jersey_number??null,position:row.playing_position||p?.playing_position||null,
    starter:row.starter??null,participated:participated?true:recordedBench?false:null,didNotPlay,status:participated?'played':didNotPlay?'DNP':recordedBench?'bench':'listed',
    minutes:min,pts:recordedBench?null:numeric(row.points),...stats(row,!recordedBench)};
}

function auditSide(score,periods,team,totals,players,plays,side) {
  const playerPoints=players.length && players.every(p=>p.participated===false||p.pts!=null) ? players.reduce((s,p)=>s+(p.pts??0),0) : null;
  const periodPoints=periods.length && periods.every(p=>p[side]!=null) ? periods.reduce((s,p)=>s+p[side],0) : null;
  const recorded=plays.filter(p=>p.team===team && !p.playerId && p.made===true).reduce((s,p)=>s+shotValue(p.type),0);
  const difference=score!=null && playerPoints!=null ? score-playerPoints : null;
  // Some official two-point baskets are credited to the team without an individual scorer.
  const unassignedPoints=difference>0 && difference===recorded ? recorded : 0;
  return {score,teamPoints:totals.points,periodPoints,playerPoints,unassignedPoints,
    playerSumMatches:score!=null && playerPoints===score,
    scoreVerified:score!=null && playerPoints!=null && playerPoints+unassignedPoints===score && totals.points===score && periodPoints===score};
}

export function parseOfficialNblDetail(payload,options={}) {
  const m=payload?.match;
  if (!uuid.test(refId(m)||'') || !teamCode(m.home_team) || !teamCode(m.away_team) || !m.start_time_datetime) throw Error('NBL 官方單場資料格式異常');
  const id=refId(m), time=taipei(utcStamp(m.start_time_datetime)),sideMap=new Map();
  const lookup=new Map(),players={},teamStats={},periods=new Map();
  for(const side of scoreKeys) {
    const team=m[side+'_team'];const code=teamCode(team);
    for(const k of [team.id,team.external_id,code].filter(Boolean)) sideMap.set(k,code);
  }
  const teamFor=v=>teamCode(v)||sideMap.get(refId(v))||null;
  for(const side of scoreKeys) {
    const team=teamCode(m[side+'_team']);const rows=(m.team_match_statistics||[]).filter(r=>teamFor(r.team)===team);
    const total=rows.find(r=>String(r.period)==='0');
    teamStats[side]={...stats(total),points:numeric(total?.points)};
    const unique=new Map();
    for(const r of m.player_match_statistics||[]) {
      if(String(r.period)!=='0'||teamFor(r.team)!==team) continue;
      const pl=playerBox(r,team,m.phase==='complete'||m.match_status==='complete'||m.match_status==='completed');
      if(pl){unique.set(pl.id,pl);lookup.set(pl.id,pl);}
    }
    players[side]=[...unique.values()];
    for(const r of rows) {
      const n=periodNumber(r.period,r.period_type);
      if(!n) continue;
      const entry=periods.get(n)||{label:label(n),home:null,away:null};
      entry[side]=numeric(r.points);periods.set(n,entry);
    }
  }
  const events=(m.play_by_play||[]).map((p,i)=>makePlay(p,i,teamFor,lookup)).filter(e=>e.play.text);
  // The source can restart action_id within a match. The game clock establishes quarter order.
  events.sort((a,b)=>b.order[0]-a.order[0] || a.order[1]-b.order[1] || b.order[2].localeCompare(a.order[2]) || b.order[3]-a.order[3] || b.order[4]-a.order[4]);
  const plays=[...new Map(events.map(e=>[e.play.id,e.play])).values()];
  const status=({complete:'final',live:'in_progress',upcoming:'scheduled'})[m.phase]||m.match_status;
  const active=['final','in_progress'].includes(status);
  const result={id,officialId:id,league:'NBL',phase:nblPhase(m.season?.season_type,payload.roundLabel||m.round),seasonYear:numeric(m.season?.year),
    round:payload.roundLabel||m.round||null,date:time.slice(0,10),time:time.slice(11,16),home:teamCode(m.home_team),away:teamCode(m.away_team),homeName:m.home_team.name,awayName:m.away_team.name,
    homeScore:active?numeric(m.home_score):null,awayScore:active?numeric(m.away_score):null,status,
    period:active?label(periodNumber(m.current_period)):null,clock:status==='in_progress'?gameClock(m.clock):null,
    periods:[...periods].sort((a,b)=>a[0]-b[0]).map(e=>e[1]),venue:m.venue?.name||null,players,teamStats,plays,minutes:null,
    url:matchSite+id,source:'NBL',asOf:options.asOf||new Date().toISOString(),sourceUpdatedAt:m.mqtt_timestamp||m.play_by_play_updated_datetime||null};
  if(status==='final' && result.periods.length>=4) result.minutes=40+5*result.periods.filter(r=>r.label.startsWith('OT')).length;
  result.quality={};
  for(const side of scoreKeys) result.quality[side]=auditSide(result[side+'Score'],result.periods,result[side],teamStats[side],players[side],plays,side);
  result.quality.scoreVerified=scoreKeys.every(s=>result.quality[s].scoreVerified);
  return result;
}

async function fetchJson(url,fetcher,ttl) {
  const response=await fetcher(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000),cf:{cacheEverything:true,cacheTtl:ttl}});
  if(!response.ok) throw Error('NBL 比賽來源回應 '+response.status);
  return response.json();
}

export async function resolveNblOfficialId(id,options={}) {
  id=String(id||'');
  if(uuid.test(id)) return id.toLowerCase();
  if(!/^\d{7,12}$/.test(id)) throw Error('無效 NBL 場次編號');
  if(uuid.test(options.officialId||'')) return options.officialId.toLowerCase();
  if(espnIds[id]) return espnIds[id];
  const fetcher=options.fetcher||fetch;
  const source=await fetchJson('https://site.api.espn.com/apis/site/v2/sports/basketball/nbl/summary?event='+id,fetcher,1800);
  const comp=source.header?.competitions?.[0];
  if(source.header?.league?.slug!=='nbl'||String(comp?.id)!==id||!comp.date) throw Error('無法識別 NBL 賽程來源');
  const date=taipei(comp.date).slice(0,10);
  const start=Number(date.slice(0,4))-(Number(date.slice(5,7))<7?1:0);
  const teams=Object.fromEntries(comp.competitors.map(x=>[x.homeAway,({HWK:'ILL',PNX:'SEM'})[x.team.abbreviation]||x.team.abbreviation]));
  const schedule=await fetchJson(calendar+'schedule?league=nbl&year='+start+'&limit=500&offset=0',fetcher,300);
  const hits=(schedule.matches||[]).filter(r=>r.starts_at_ms && taipei(r.starts_at_ms).slice(0,10)===date &&
    r.home?.team_code===teams.home && r.away?.team_code===teams.away);
  if(hits.length!==1 || !uuid.test(hits[0].id)) throw Error('官方賽程尚無唯一可配對場次');
  return hits[0].id;
}

export function preferNblDetail(current,backup) {
  if(!current) return backup||null;
  if(!backup||current.officialId!==backup.officialId||current.home!==backup.home||current.away!==backup.away) return current;
  if(current.status==='final'&&backup.status==='final' && current.homeScore===backup.homeScore && current.awayScore===backup.awayScore) {
    if(backup.quality?.scoreVerified && !current.quality?.scoreVerified) return backup;
    if(backup.quality?.scoreVerified===current.quality?.scoreVerified && !current.plays?.length && backup.plays?.length) return backup;
  }
  if(backup.status==='final'&&current.status!=='final') return backup;
  if(backup.status==='in_progress' && current.status==='scheduled') return backup;
  if(backup.status==='in_progress' && current.status==='in_progress') {
    const t=Date.parse(current.sourceUpdatedAt||current.asOf);
    const u=Date.parse(backup.sourceUpdatedAt||backup.asOf);
    if(Number.isFinite(u) && Number.isFinite(t) && u>t && backup.quality?.scoreVerified) return backup;
    if(current.homeScore===backup.homeScore && current.awayScore===backup.awayScore && !current.quality?.scoreVerified && backup.quality?.scoreVerified) return backup;
  }
  return current;
}

export async function getNblDetail(id,options={}) {
  const officialId=await resolveNblOfficialId(id,options);
  const fetcher=options.fetcher||fetch;
  const [online,offline]=await Promise.allSettled([
    fetchJson(calendar+'match?league=nbl&match='+officialId,fetcher,8).then(raw=>parseOfficialNblDetail(raw)),
    options.loadSnapshot ? options.loadSnapshot(officialId) : Promise.resolve(options.baseline||null)
  ]);
  const live=online.status==='fulfilled' && online.value?.officialId===officialId ? online.value : null;
  const saved=offline.status==='fulfilled' && offline.value?.officialId===officialId ? offline.value : null;
  const detail=preferNblDetail(live,saved);
  if(!detail) throw online.reason||Error('NBL 官方單場資料暫時無法讀取');
  return /^\d+$/.test(String(id)) ? {...detail,espnId:String(id)} : detail;
}
