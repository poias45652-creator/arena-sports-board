import {headers} from 'next/headers';
import {getRawDb} from '@/db';
import {readSession} from './arena-session';
export async function memberIdentity(){return (await readSession(getRawDb(),(await headers()).get('cookie')))?.memberId||null;}
