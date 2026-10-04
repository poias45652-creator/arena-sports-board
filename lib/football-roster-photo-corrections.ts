import records from '../data/football-roster-photo-corrections.json';
import {normalizeFootballPhotoName} from './football-photo-identity';

type Identity = {name:string;birthDate:string;country:string;position:string;height:string};
type Correction = {
 teamId:string;league:string;season:number;
 sourceRecord:{name:string;birthDate:string;number:string;country?:string};
 identity?:Identity;exclude?:boolean;source:string;evidence:string;
};
const corrections=records as Record<string,Correction>;
export function hasFootballRosterPhotoCorrection(id:string){return Object.hasOwn(corrections,id);}
export function footballRosterPhotoCorrection(id:string,league:string,teamId?:string,season?:number){
 const c=corrections[id];
 return c&&c.league===league&&c.teamId===teamId&&c.season===season?c:undefined;
}
export function matchesFootballRosterCorrection(p:any,c:Correction){
 const name=normalizeFootballPhotoName(String(p.displayName||p.fullName||'')),birth=String(p.dateOfBirth||'').slice(0,10);
 if(String(p.jersey||'')!==c.sourceRecord.number)return false;
 const original=name===normalizeFootballPhotoName(c.sourceRecord.name)&&birth===c.sourceRecord.birthDate&&
  (!c.sourceRecord.country||String(p.citizenship||p.birthPlace?.country||'')===c.sourceRecord.country);
 // Keep the reviewed photo after the upstream service repairs this exact identity.
 const repaired=!!c.identity&&name===normalizeFootballPhotoName(c.identity.name)&&birth===c.identity.birthDate;
 return original||repaired;
}
