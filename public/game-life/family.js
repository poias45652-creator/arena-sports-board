/* Family stories occupy existing event slots. Reading old careers never creates relatives. */
(function(root){
'use strict';
const PARTNERS=['以晴','若安','沐彤','予夏','語棠','映柔','子寧','心妍'];
const partner=s=>s.family?.partner||PARTNERS[((s.lineage?.generation||1)-1)%PARTNERS.length];
function scene(s,e){if(!e?.id.startsWith('family-'))return e;const separated=s.romance?.bond==='separated'&&e.id==='family-coach',name=separated?'場邊的教練':partner(s),text=t=>typeof t==='string'?t.replaceAll('以晴',name):t;return{...e,text:text(e.text),scene:{...e.scene,voice:name,line:text(e.scene.line)},options:e.options.map(c=>({...c,label:text(c.label),hint:text(c.hint),resultText:text(c.resultText)}))}}
const LABELS={meet:'第一次相遇',date:'成為戀人',distance:'感情的第一次考驗',marry:'結為夫妻',birth:'孩子出生',coach:'第一次陪孩子練球'};
const FOCUS={technique:{name:'細膩技術',index:0},athletic:{name:'運動天賦',index:1},mind:{name:'大心臟',index:2}};
const option=(label,hint,action,resultText,effect={mood:5})=>({label,hint,effect,familyAction:action,resultText});
const story=(id,title,place,line,text,options)=>({id:'family-'+id,title,category:'球場之外 · 家的故事',chainOnly:true,once:true,minAge:id==='meet'?17:id==='date'?18:id==='marry'?20:id==='birth'?21:19,scene:{place,voice:'以晴',line},text,options});
const EVENTS=[
 story('meet','雨停之前，先記住你的名字','球場旁的舊書店','你不用每次都贏，才有資格進來躲雨。','練習賽輸了，你躲進書店，不想讓隊友看見眼眶。以晴把自己的傘推過來。她沒有問比分，只問你明天還會不會去練球。第一次，有人先看見你，再看見球衣。',[
  option('留下名字，約好還傘','認識以晴，明年還有故事。','meet','你把名字寫在書籤背面。她收好書籤，說：「那下次，換你告訴我一件開心的事。」'),
  option('聊聊她正在畫的夢想','認識以晴，也聽見她想成為插畫家的心願。','meet','你們聊到雨停。她想畫一本自己的書，你想站上更大的球場。離開時，你忽然覺得夢想沒有那麼孤單。'),
  option('謝謝她，先把心放在球場','維持萍水相逢；這段感情線到此為止。','single','你認真道謝，把傘留給下一個淋雨的人。這次相遇很溫柔，但你想先學會照顧自己的夢想。')
 ]),
 story('date','那句練習了很多次的話','十八歲以後的河堤','我不是在等大明星。我是在等你。','你已經成年。休假那晚，以晴帶著第一份作品集來找你。你們各自說起害怕失敗的事，忽然安靜下來。原來最難開口的，不是賽後訪問，而是想和她一起走下去。',[
  option('告訴她：我想和妳交往','彼此確認心意，成為男女朋友。','date','「我也喜歡你。」她笑著說。你們沒有掌聲，也沒有聚光燈，只有河面倒映著兩個靠近的影子。'),
  option('先約定，都別放棄自己的夢想','確認交往，也尊重彼此的工作與選擇。','date','你說會認真比賽，也會認真聽她說話。她伸出小指：「那我們一起，把各自的夢走遠一點。」'),
  option('坦白說，現在只想做朋友','好好說清楚，感情線在友情中收尾。','single','她安靜了一會，仍把作品集翻給你看。不是每段相遇都要變成愛情；你們都值得一個誠實的答案。')
 ]),
 story('distance','時差另一端，還亮著一盞燈','客場旅館 · 深夜視訊','我也會累。可不可以有一天，是你先問我？','客場移動讓你錯過她的展覽。螢幕裡，以晴身後堆滿了畫稿。你準備好的「最近真的很忙」，突然說不出口。愛情第一次需要的，不是漂亮的承諾，而是你願不願意聽。',[
  option('先聽她說，再一起排出相聚的日子','走過磨合，留下固定陪伴的約定。','distance','你關掉比賽重播，聽她說完那場展覽。日曆上多了一個屬於彼此的小圈圈。你明白，陪伴也需要練習。'),
  option('請假到展覽最後一天，親口說抱歉','用一次赴約回應她；體力 -6。','distance','你站在展場最後一排。她看見你時沒有立刻笑，只是慢慢走過來，握住你的手。這一次，你沒有缺席。',{mood:8,energy:-6}),
  option('好好告別，不再讓承諾落空','和平分手，保留一起走過的回憶。','single','你們說了很久，最後互相祝福。回到球場，你仍會想起她；也開始學著不輕易答應做不到的事。')
 ]),
 story('marry','不是冠軍戒指，卻一樣珍貴','休季的海邊','以後贏了，回家一起慶祝；輸了，也要回家。','你們已經一起走過忙碌、爭吵和重逢。今天沒有賽程，以晴把手放進你的外套口袋。你終於知道，想和她一起擁有的，不只是某個高光時刻，而是許多平凡的明天。',[
  option('求婚，把往後的日子一起寫下去','她願意，你們在親友祝福下結婚。','marry','她紅著眼點頭。婚禮那天，你的手比決勝時刻還抖。她握緊你：「別怕，我們是一隊的。」',{mood:12,flags:{family:1}}),
  option('一起登記，辦一場小小的婚禮','共同決定結婚，把重心放在往後的生活。','marry','沒有盛大的排場。你們在證書上寫下名字，回家煮了一鍋有點太鹹的湯。她笑著說，這會是第一個家庭笑話。',{mood:12,flags:{family:1}}),
  option('繼續相愛，不急著結婚','維持交往；這段生涯不進入婚育支線。','settled','你們說好不拿別人的時間表衡量自己。日子照樣往前，而你們仍願意牽著彼此。')
 ]),
 story('birth','第一次，被叫作爸爸','休季的家 · 一盞床頭燈','如果真的要成為爸媽，我希望我們一起學。','婚後，你們認真談過想要的生活，也談過育兒會改變什麼。以晴把兩隻小襪子放在掌心，問你是不是也準備好，為另一個小小的夢想留出位置。',[
  option('我們一起，迎接這個孩子','時間推進至孩子出生；加入家庭與傳承故事。','birth','這一年，你們成為父母。孩子第一次握住你的手指時，你忘了所有賽前演練過的勇敢。以晴輕聲說：「小星，這是爸爸。」',{mood:15,flags:{family:1}}),
  option('先排好照顧計畫，再迎接新成員','一起分擔照顧，孩子出生後仍支持彼此的夢想。','birth','你們把賽程、畫展和育兒時間寫在同一本日曆。小星出生那天，你在新的一頁寫下：「這一次，我想學會每天都在。」',{mood:15,flags:{family:1}}),
  option('我們更喜歡兩個人的生活','共同決定不生育，保留你們的家庭故事。','settled','她點點頭。你們不需要用另一種人生證明幸福。以後的假期，還有很多想一起去的地方。')
 ]),
 story('coach','小小的手，接住同一個夢','休季午後 · 社區球場','先陪孩子玩。喜歡，比贏更重要。','小星抱著比自己膝蓋還高的球，歪歪斜斜地跑向你。你放慢腳步，第一次發現：當年急著追上的背影，現在變成了自己。你想把什麼，留在孩子的起點？',[
  option('陪孩子玩控球小遊戲','培養細膩技術；下一代技術起點 +6。','technique','你把最難的動作拆成最好笑的遊戲。小星跌坐在草地上，仍抱著球說「再一次」。你看見了比獎盃更長遠的事。'),
  option('一起跑跳，先愛上運動','培養運動天賦；下一代體能起點 +6。','athletic','你故意跑慢半步，讓小星第一次追上你。那一串笑聲，成了這座小球場最響亮的加油聲。'),
  option('每次失手，都先給一個擁抱','培養大心臟；下一代心理起點 +6。','mind','球沒有接住，小星有點想哭。你蹲下來說：「沒關係，我們一起再試。」那句你年輕時最想聽見的話，終於由你說出口。')
 ])
];
function next(s){
 if(s.retired||s.age<17)return null;
 const f=s.family;if(!f)return 'family-meet';
 if(s.romance?.bond==='separated')return f.child&&!f.milestones.some(m=>m.id==='coach')?'family-coach':null;
 if(f.settled||f.stage==='single'||f.milestones.some(m=>m.age===s.age))return null;
 const has=id=>f.milestones.some(m=>m.id===id);
 if(f.stage==='met'&&s.age>=18)return 'family-date';
 if(f.stage==='dating'&&!has('distance'))return 'family-distance';
 if(f.stage==='dating'&&s.age>=20)return 'family-marry';
 if(f.stage==='married'&&s.age>=21)return 'family-birth';
 if(f.stage==='parent'&&!has('coach'))return 'family-coach';
 return null;
}
function choose(s,event,choice){
 const action=choice.familyAction;if(!action)return;
 const f=s.family||(s.family={v:1,partner:partner(s),stage:'met',settled:false,milestones:[],child:null});
 f.milestones.push({id:event.id.slice(7),age:s.age,action});
 if(action==='single'){f.stage='single';f.settled=true}
 else if(action==='settled')f.settled=true;
 else if(action==='meet')f.stage='met';
 else if(action==='date')f.stage='dating';
 else if(action==='marry')f.stage='married';
 else if(action==='birth'){f.stage='parent';f.child={name:'小星',bornAt:s.age,focus:null}}
 else if(FOCUS[action]&&f.child)f.child.focus=action;
}
function inherit(parent,params,create,ovr){
 if(!parent.retired||parent.reason==='chapter'||!parent.family?.child)throw Error('請先完成引退，再開啟下一代的故事。');
 if(!FOCUS[params.focus]||!/^[A-Za-z0-9-]{1,100}$/.test(params.parentId))throw Error('傳承設定不正確。');
 const generation=(parent.lineage?.generation||1)+1;if(generation>100)throw Error('這個家族已完成一百代傳承。');
 // Same family and choices always produce the same child; no parent RNG is consumed.
 let h=2166136261;for(const c of parent.id+'|'+generation)h=Math.imul(h^c.charCodeAt(0),16777619);
 const child=create({sport:parent.sport,pos:parent.pos,country:parent.country,number:parent.number,name:params.name||parent.family.child.name,seed:'HEIR-'+(h>>>0).toString(36)+'-'+generation,pace:'quick',length:'short',talent:FOCUS[params.focus].index});
 child.potential=Math.min(99,Math.max(88,parent.potential+6));
 child.caps=child.caps.map((cap,i)=>Math.min(99,Math.max(parent.caps[i],child.potential-3+(i===FOCUS[params.focus].index?6:0))));
 child.a=child.a.map((n,i)=>Math.min(child.caps[i],n+4+(parent.family.child.focus&&FOCUS[parent.family.child.focus].index===i?6:0)));
 child.peak=ovr(child);
 child.lineage={v:1,generation,parentId:params.parentId,parentName:parent.name,parentPotential:parent.potential,parentAge:parent.age,parentSeasons:parent.history.length,parentCups:parent.proCups,elapsedYears:Math.max(0,16-(parent.age-parent.family.child.bornAt)),focus:params.focus};
 child.log.unshift(`16歲｜接過${parent.name}的 ${parent.number} 號球衣。天賦上限 ${parent.potential} → ${child.potential}，這次由你寫下自己的故事。`);
 return child;
}
function validate(s){
 const fail=()=>{throw Error('家庭與傳承存檔格式不正確')},f=s.family,l=s.lineage;
 if(f!==undefined){
  if(!f||f.v!==1||!PARTNERS.includes(f.partner)||!['met','dating','married','parent','single'].includes(f.stage)||typeof f.settled!=='boolean'||!Array.isArray(f.milestones)||!f.milestones.length||f.milestones.length>6)fail();
  const ids=f.milestones.map(m=>m?.id);if(new Set(ids).size!==ids.length||ids[0]!=='meet')fail();
  for(let i=0;i<f.milestones.length;i++){const m=f.milestones[i],def=EVENTS.find(e=>e.id==='family-'+m.id);if(!def||!def.options.some(c=>c.familyAction===m.action)||!Number.isInteger(m.age)||m.age<def.minAge||m.age>s.age||(i&&m.age<=f.milestones[i-1].age))fail();}
  for(const [id,prior] of [['date','meet'],['distance','date'],['marry','distance'],['birth','marry'],['coach','birth']])if(ids.includes(id)&&(!ids.includes(prior)||ids.indexOf(id)<ids.indexOf(prior)))fail();
  if((f.stage==='parent')!==!!f.child||['dating','married','parent'].includes(f.stage)&&!ids.includes('date')||['married','parent'].includes(f.stage)&&!ids.includes('marry'))fail();
  if(f.child&&(!ids.includes('birth')||f.child.name!=='小星'||f.child.bornAt!==f.milestones.find(m=>m.id==='birth').age||!(f.child.focus===null||FOCUS[f.child.focus])||!!f.child.focus!==ids.includes('coach')))fail();
  if(f.successorId!==undefined&&(!f.child||!s.retired||s.reason==='chapter'||!/^[A-Za-z0-9-]{1,100}$/.test(f.successorId)))fail();
 }
 if(l!==undefined){if(!l||l.v!==1||!Number.isInteger(l.generation)||l.generation<2||l.generation>100||!/^[A-Za-z0-9-]{1,100}$/.test(l.parentId)||typeof l.parentName!=='string'||l.parentName.length>100||!FOCUS[l.focus])fail();for(const k of ['parentPotential','parentAge','parentSeasons','parentCups','elapsedYears'])if(!Number.isFinite(l[k])||l[k]<0)fail();if(l.parentPotential>99||l.parentAge>60||l.parentSeasons>100||l.elapsedYears>16)fail();}
}
const api={partner,scene,EVENTS,LABELS,FOCUS,next,choose,inherit,validate};if(typeof module!=='undefined')module.exports=api;else root.XZFamily=api;
})(globalThis);
