import {cpblLogos} from './cpbl-logos';
import {kboTeamCodes} from './kbo-teams';
import {internationalTeam} from './international-teams';
const npbLogos:Record<string,string>={
 '中日龍':'dragons','北海道日本火腿鬥士':'fighters','千葉羅德海洋':'marines',
 '埼玉西武獅':'lions','廣島東洋鯉魚':'carp','東京養樂多燕子':'swallows',
 '東北樂天金鷲':'eagles','橫濱 DeNA 海灣之星':'baystars','歐力士猛牛':'buffaloes',
 '福岡軟銀鷹':'hawks','讀賣巨人':'giants','阪神虎':'tigers',
};
export function internationalTeamLogoPath(league:string,name:string):string|null{
 name=internationalTeam(name,league);
 const file=league==='CPBL'&&cpblLogos[name]?`cpbl-${cpblLogos[name]}.png`:league==='NPB'&&npbLogos[name]?`npb-${npbLogos[name]}.gif`:league==='KBO'&&kboTeamCodes[name]?`kbo-${kboTeamCodes[name].toLowerCase()}.png`:null;
 return file?`/team-logos/${file}`:null;
}
