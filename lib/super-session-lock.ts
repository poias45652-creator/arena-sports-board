import type {HrDatabase} from './hr9988-connection';
// One source account must not be logged in by the collector and browser at once.
// Reuse the durable lease table so this coordinates tabs and server processes.
const name=(member:string)=>'super-session:'+member;
export async function claimSuperSession(db:HrDatabase,member:string,owner:string,ttl:number){
 const now=Date.now();
 return !!await db.prepare('INSERT INTO tz_binding_attempts (member_id,allowed_at,operation_id) VALUES (?,?,?) ON CONFLICT(member_id) DO UPDATE SET allowed_at=excluded.allowed_at,operation_id=excluded.operation_id WHERE tz_binding_attempts.allowed_at<=? OR tz_binding_attempts.operation_id=? RETURNING operation_id').bind(name(member),now+ttl,owner,now,owner).first();
}
export async function renewSuperSession(db:HrDatabase,member:string,owner:string){
 return !!await db.prepare('UPDATE tz_binding_attempts SET allowed_at=? WHERE member_id=? AND operation_id=? RETURNING operation_id').bind(Date.now()+120000,name(member),owner).first();
}
export async function releaseSuperSession(db:HrDatabase,member:string,owner:string){
 await db.prepare('DELETE FROM tz_binding_attempts WHERE member_id=? AND operation_id=?').bind(name(member),owner).run();
}
