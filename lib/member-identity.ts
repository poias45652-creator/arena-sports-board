import {headers} from 'next/headers';
import {getRawDb} from '@/db';
import {readSession,SESSION_COOKIE} from './arena-session';
export async function memberIdentity(){const h=await headers();const cookie=h.get('cookie');if(cookie?.includes(SESSION_COOKIE+'='))return (await readSession(getRawDb(),cookie))?.memberId||null;return h.get('oai-authenticated-user-id');}
