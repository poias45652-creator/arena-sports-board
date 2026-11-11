import Link from 'next/link';
import {adminIdentity} from '../../admin-access';
import Workspace from './workspace';
export const dynamic='force-dynamic';
export default async function Page(){
 if(!await adminIdentity())return <main><h1>僅限管理者存取</h1><a href="/login">使用管理員帳號登入</a></main>;
 return <main className="arena-shell min-h-screen p-5"><Link prefetch={false} href="/admin">返回管理後台</Link><h1 className="my-4 text-xl font-bold">澳韓籃攻防分析與盤口查核</h1><Workspace/></main>;
}
