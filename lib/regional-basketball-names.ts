// Exact senior-team names only. Club codes are scoped to their own league.
export type RegionalLeague='NBL'|'KBL';
export const regionalTeams:Record<RegionalLeague,Record<string,string[]>>={
 NBL:{
  ADL:['阿德雷德36人','阿德萊德36人','阿得雷德36人','Adelaide 36ers'],
  BRI:['布里斯本子彈','布里斯班子彈','Brisbane Bullets'],
  CNS:['凱恩斯太攀蛇','凱恩斯大班','開恩茲太攀蛇','肯因茲太攀蛇','Cairns Taipans'],
  ILL:['伊拉瓦拉籃球','伊拉瓦拉老鷹','伊拉瓦拉鷹','伊拉瓦拉飛鷹','Illawarra Hawks'],
  MEL:['墨爾本聯隊','墨爾本聯','墨爾本聯合','Melbourne United'],
  NZL:['紐西蘭破壞者','新西蘭破壞者','New Zealand Breakers'],
  PER:['伯斯野貓','珀斯野貓','柏斯野貓','Perth Wildcats'],
  SEM:['東南墨爾本鳳凰','東南墨爾本鳳凰隊','South East Melbourne Phoenix'],
  SYD:['雪梨國王','悉尼國王','Sydney Kings'],
  TAS:['塔斯馬尼亞跳蟻','塔斯馬尼亞傑克跳蟻','塔斯曼尼亞跳蟻','Tasmania JackJumpers']},
 KBL:{
  SAM:['首爾三星雷霆','首爾三星迅雷','首爾三星','Seoul Samsung Thunders','서울 삼성 썬더스'],
  JJK:['安養正官庄赤紅火箭','安陽正官庄赤紅火箭','安養正官庄赤色火箭','安養正官庄','Anyang Jung Kwan Jang Red Boosters','안양 정관장 레드부스터스'],
  SK:['首爾SK騎士','首爾騎士','Seoul SK Knights','서울 SK 나이츠'],
  DB:['原州DB新世代','原州DB','原州東浦新世代','Wonju DB Promy','원주 DB 프로미'],
  KOG:['大邱韓國瓦斯飛馬','大邱韓國天然氣公社飛馬','大邱韓國天然氣公社','大邱飛馬','Daegu KOGAS Pegasus','대구 한국가스공사 페가수스'],
  LG:['昌原LG獵隼','昌原LG獵鷹','昌原LG','Changwon LG Sakers','창원 LG 세이커스'],
  KT:['水原KT音速彈','水原KT爆音','水原KT音速彈隊','水原KT','Suwon KT Sonicboom','수원 KT 소닉붐'],
  KCC:['釜山KCC宙斯盾','釜山KCC','Busan KCC Egis','부산 KCC 이지스'],
  SON:['高陽索諾天空槍手','高陽索諾天槍','高陽索諾','Goyang Sono Skygunners','고양 소노 스카이거너스'],
  MOB:['蔚山現代摩比斯太陽神','蔚山現代太陽神','蔚山現代摩比斯','Ulsan Hyundai Mobis Phoebus','울산 현대모비스 피버스']},
};
