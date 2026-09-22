const npbAliases:Record<string,string>={'日本火腿':'北海道日本火腿鬥士','火腿':'北海道日本火腿鬥士','養樂多':'東京養樂多燕子','廣島':'廣島東洋鯉魚','橫濱':'橫濱 DeNA 海灣之星','歐力士':'歐力士猛牛','Orix':'歐力士猛牛','軟銀':'福岡軟銀鷹','羅德':'千葉羅德海洋','Rakuten':'東北樂天金鷲'};
const leagueAliases:Record<string,Record<string,string>>={
 NPB:{'東北樂天鷹':'東北樂天金鷲','東北樂天金鷹':'東北樂天金鷲','樂天金鷹':'東北樂天金鷲','樂天金鷲':'東北樂天金鷲'},
 KBO:{'鬥山熊':'斗山熊','鬥山':'斗山熊','斗山':'斗山熊','英雄':'培證英雄','培證':'培證英雄','恐龍':'NC 恐龍','巫師':'KT 巫師','登陸者':'SSG 登陸者','雙子':'LG 雙子','三星獅子':'三星獅','KT巫師':'KT 巫師','LG雙子':'LG 雙子','NC恐龍':'NC 恐龍','SSG登陸者':'SSG 登陸者'},
};
const aliases:Record<string,string>={
'橫濱DeNA灣星':'橫濱 DeNA 海灣之星','橫濱 DeNA 灣星':'橫濱 DeNA 海灣之星','千葉羅德':'千葉羅德海洋','廣島鯉魚':'廣島東洋鯉魚',
'阪神タイガース':'阪神虎','読売ジャイアンツ':'讀賣巨人','横浜DeNAベイスターズ':'橫濱 DeNA 海灣之星','広島東洋カープ':'廣島東洋鯉魚','東京ヤクルトスワローズ':'東京養樂多燕子','中日ドラゴンズ':'中日龍','福岡ソフトバンクホークス':'福岡軟銀鷹','北海道日本ハムファイターズ':'北海道日本火腿鬥士','オリックス・バファローズ':'歐力士猛牛','東北楽天ゴールデンイーグルス':'東北樂天金鷲','埼玉西武ライオンズ':'埼玉西武獅','千葉ロッテマリーンズ':'千葉羅德海洋','SAMSUNG':'三星獅','HANWHA':'韓華鷹','DOOSAN':'斗山熊','LOTTE':'樂天巨人','KIWOOM':'培證英雄',
'養樂多燕子':'東京養樂多燕子','橫濱DeNA海灣之星':'橫濱 DeNA 海灣之星','西武獅':'埼玉西武獅','日本火腿鬥士':'北海道日本火腿鬥士',
'Tigers':'阪神虎','阪神':'阪神虎','Giants':'讀賣巨人','巨人':'讀賣巨人','BayStars':'橫濱 DeNA 海灣之星','DeNA':'橫濱 DeNA 海灣之星','Carp':'廣島東洋鯉魚','広島':'廣島東洋鯉魚','Swallows':'東京養樂多燕子','ヤクルト':'東京養樂多燕子','Dragons':'中日龍','中日':'中日龍','Hawks':'福岡軟銀鷹','ソフトバンク':'福岡軟銀鷹','Fighters':'北海道日本火腿鬥士','日本ハム':'北海道日本火腿鬥士','Marines':'千葉羅德海洋','ロッテ':'千葉羅德海洋','Buffaloes':'歐力士猛牛','オリックス':'歐力士猛牛','Golden Eagles':'東北樂天金鷲','楽天':'東北樂天金鷲','Lions':'埼玉西武獅','西武':'埼玉西武獅',
'KT':'KT 巫師','Wiz':'KT 巫師','LG':'LG 雙子','Twins':'LG 雙子','삼성':'三星獅','Samsung':'三星獅','KIA':'起亞虎','두산':'斗山熊','Bears':'斗山熊','NC':'NC 恐龍','Dinos':'NC 恐龍','한화':'韓華鷹','Eagles':'韓華鷹','SSG':'SSG 登陸者','Landers':'SSG 登陸者','롯데':'樂天巨人','키움':'培證英雄','Heroes':'培證英雄'};
export function internationalTeam(name:string,league:string){
 const n=String(name??'').normalize('NFKC').replace(/\s*\((?:主|客|NPB|KBO|CPBL)\)\s*/gi,' ').replace(/\s+/g,' ').trim();
 if(!n||/^[-—–\s]+$/.test(n)||/^(?:TOT|Total|2 Teams|3 Teams)$/i.test(n))return '';
 const scoped=leagueAliases[league]?.[n];if(scoped)return scoped;
 if(league==='NPB'&&npbAliases[n])return npbAliases[n];
 if(league==='KBO'&&n==='Giants')return '樂天巨人';
 if(league==='KBO'&&n==='Lions')return '三星獅';
 if(league==='KBO'&&n==='Tigers')return '起亞虎';
 return aliases[n]||n;
}
