import {createDatabase} from '../server/database.mjs';
export interface Statement {
 bind(...values:unknown[]):Statement;
 first<T=Record<string,any>>():Promise<T|null>;
 all<T=Record<string,any>>():Promise<{results:T[];success:boolean;meta:{changes:number}}>;
 run():Promise<{success:boolean;meta:{changes:number}}>;
}
export interface Database {prepare(sql:string):Statement;batch(statements:Statement[]):Promise<{success:boolean;results:any[];meta:{changes:number}}[]>;}
export function getRawDb():Database {return createDatabase() as Database;}
