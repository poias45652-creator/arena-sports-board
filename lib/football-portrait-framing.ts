import frames from '../data/football-europa-photo-framing.json';
import {normalizeFootballPhotoName} from './football-photo-identity';

type Frame = {name:string;width:number;height:number;x:number;y:number;size:number};

// Keep the reviewed original bytes; frame only the explicitly identified player.
export function footballPortraitStyle(id:string,name:string){
 const f=(frames as Record<string,Frame>)[id];
 if(!f||normalizeFootballPhotoName(f.name)!==normalizeFootballPhotoName(name))return undefined;
 if(![f.width,f.height,f.x,f.y,f.size].every(Number.isFinite)||f.size<=0||f.x<0||f.y<0||f.x+f.size>f.width||f.y+f.size>f.height)return undefined;
 const scale=100/f.size;
 return {position:'absolute' as const,width:f.width*scale,height:f.height*scale,left:-f.x*scale,top:-f.y*scale,maxWidth:'none',objectFit:'fill' as const};
}
