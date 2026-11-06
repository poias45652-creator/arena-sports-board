import {normalizeFootballPhotoName} from './football-photo-identity';
import policies from '../data/football-photo-policy.json';

type Scope = {league:string; team:string; season:number; name:string; position:string};
const scoped = policies.scoped as Record<string, Scope[]>;

export function footballPhotoPending(id:string) {
  return policies.pending.includes(id);
}

export function footballPhotoScopeAllowed(id:string, league:string, team?:string, season?:number) {
  return !scoped[id] || scoped[id].some(s => s.league === league && s.team === team && s.season === season);
}

/** Scope restrictions apply only to the portrait, independently of the player's biography. */
export function footballPhotoUrl(id:string, league:string, team:string, season:number, athlete:{displayName?:string;fullName?:string;position?:{abbreviation?:string}}, includeTeam:boolean) {
  if (!/^\d{1,12}$/.test(id) || footballPhotoPending(id)) return '';
  const scopes = scoped[id];
  if (scopes && !scopes.some(s => s.league === league && s.team === team && s.season === season &&
    normalizeFootballPhotoName(s.name) === normalizeFootballPhotoName(String(athlete.displayName || athlete.fullName || '')) &&
    s.position === athlete.position?.abbreviation)) return '';
  const url = `/api/football-player-photo?player=${id}&league=${league}`;
  return team && (includeTeam || scopes) ? `${url}&team=${team}&season=${season}` : url;
}
