import {getRawDb} from '@/db';
export const dynamic='force-dynamic';
export async function GET(request:Request){
 const id=Number(new URL(request.url).searchParams.get('gameId')),headers={'Cache-Control':'private, no-store'};
 if(!Number.isInteger(id)||id<=0)return Response.json({error:'無效賽事'},{status:400,headers});
 try{
  const row=await getRawDb().prepare('SELECT payload FROM analysis_snapshots WHERE game_id=? AND captured_at<start_time ORDER BY captured_at DESC LIMIT 1').bind(id).first<{payload:string}>();
  return row?Response.json(JSON.parse(row.payload),{headers}):Response.json({error:'此場尚無可供觀看的已儲存分析'},{status:404,headers});
 }catch{return Response.json({error:'分析資料暫時無法讀取'},{status:503,headers});}
}
