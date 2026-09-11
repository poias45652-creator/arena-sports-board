import {getPool} from '../../../server/database.mjs';
export const dynamic='force-dynamic';
export async function GET(){
 try{await getPool().query('SELECT 1');return Response.json({ok:true,database:true,service:'arena-sports-board',version:'v63-render',adminSetupVersion:3},{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({ok:false,database:false,service:'arena-sports-board'},{status:503});}
}
