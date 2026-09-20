import {cpblLogos} from '@/lib/cpbl-logos';
import {kboTeamCodes} from '@/lib/kbo-teams';
import {internationalTeam} from '@/lib/international-teams';
const npbLogos:Record<string,string>={
 '中日龍':'dragons','北海道日本火腿鬥士':'fighters','千葉羅德海洋':'marines',
 '埼玉西武獅':'lions','廣島東洋鯉魚':'carp','東京養樂多燕子':'swallows',
 '東北樂天金鷲':'eagles','橫濱 DeNA 海灣之星':'baystars','歐力士猛牛':'buffaloes',
 '福岡軟銀鷹':'hawks','讀賣巨人':'giants','阪神虎':'tigers',
};
export default function InternationalTeamLogo({league,name,size=48}:{league:string;name:string;size?:number}){
 name=internationalTeam(name,league);
 const file=league==='CPBL'&&cpblLogos[name]?`cpbl-${cpblLogos[name]}.png`:league==='NPB'&&npbLogos[name]?`npb-${npbLogos[name]}.gif`:league==='KBO'&&kboTeamCodes[name]?`kbo-${kboTeamCodes[name].toLowerCase()}.png`:null;
 return <span className="grid shrink-0 place-items-center" style={{width:size,height:size}}>{file?<img src={`/team-logos/${file}`} alt={`${name}隊標`} width={size} height={size} className={`object-contain${league==='NPB'?' rounded-md bg-white p-0.5':''}`} style={{width:size,height:size}}/>:<span className="font-black text-yellow-300">{league}</span>}</span>;
}
