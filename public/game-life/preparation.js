/* Seasonal opportunities use one saved roll and occupy no additional story turn. */
(function(root){
'use strict';
const OFFERS=[
 {id:'rebuild',name:'拆掉慣用動作，重練一次',text:'教練拿出兩段影片：熟悉的動作很安全，新動作可能打開另一扇門。',chance:.60,stat:0,effect:{energy:-12,mood:0},good:{a:[7,0,3,0],morale:16,mood:12},bad:{a:[-5,0,-2,0],morale:-18,mood:-12}},
 {id:'duel',name:'和隊內主力正面競爭',text:'先發的位置有人守著。今天你可以走進同一組，讓表現說話。',chance:.55,stat:1,effect:{energy:-16,mood:0},good:{a:[2,6,0,0],morale:22,mood:14},bad:{a:[0,-3,0,0],health:-14,morale:-22,mood:-12}},
 {id:'mentor',name:'接下老將的高難度課表',text:'前輩願意把壓箱技巧教給你，但要先撐過一場不留情面的練習。',chance:.64,stat:2,effect:{energy:-14,mood:0},good:{a:[4,0,5,2],health:10,morale:14,mood:0},bad:{health:-18,morale:-14,mood:-8}},
 {id:'pressure',name:'在全隊面前模擬決勝球',text:'所有人停下來看你。比分可以重設，面對壓力的方式卻會留下。',chance:.58,stat:2,effect:{energy:-10,mood:0},good:{a:[2,0,7,0],morale:24,mood:10},bad:{a:[0,0,-5,0],morale:-24,mood:-14}},
 {id:'defence',name:'挑戰跨位置的防守任務',text:'教練把你放到不熟悉的角度。學會閱讀另一個位置，也可能暫時失去節奏。',chance:.62,stat:3,effect:{energy:-12,mood:0},good:{a:[2,2,0,6],morale:16,mood:12},bad:{a:[-2,0,0,-4],health:-12,morale:-16,mood:0}},
 {id:'comeback',name:'重做上次沒成功的那一球',text:'你把失手的片段留到最後看。今天，願不願意再站回同一個地方？',chance:.66,stat:2,effect:{energy:-12,mood:0},good:{a:[4,0,4,0],mood:26,morale:18},bad:{a:[-2,0,-3,0],mood:-22,morale:-16}}
];
function offer(s){let h=2166136261;for(const c of s.seed)h=Math.imul(h^c.charCodeAt(0),16777619);return OFFERS[((h>>>0)+s.age-16)%OFFERS.length]}
function run(s,id,ctx){const c=offer(s);if(s.retired||s.phase!=='train'||s.sessions!==0||s.preparation?.age===s.age||id!==c.id)return{ok:false,message:'本季挑戰只能在開始訓練前接受一次。'};const chance=ctx.chance(s,c),roll=ctx.random(s),success=roll<chance,before=ctx.apply(s,c.effect),change=ctx.apply(s,success?c.good:c.bad);s.preparation={age:s.age,id,success,detail:[ctx.effectsText(before),ctx.effectsText(change)].filter(Boolean).join(' · ')};ctx.log(s,'本季挑戰「'+c.name+'」'+(success?'成功':'受挫')+'：'+s.preparation.detail);return{ok:true}}
function validate(s){if(s.preparation===undefined)return;const x=s.preparation;if(!x||!Number.isInteger(x.age)||x.age<16||x.age>s.age||!OFFERS.some(o=>o.id===x.id)||typeof x.success!=='boolean'||typeof x.detail!=='string'||x.detail.length>1000)throw Error('本季挑戰存檔格式不正確')}
const api={OFFERS,offer,run,validate};if(typeof module!=='undefined')module.exports=api;else root.XZPreparation=api;
})(globalThis);
