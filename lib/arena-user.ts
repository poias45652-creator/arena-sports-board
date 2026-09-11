import {headers} from 'next/headers';
import {readUser} from '../server/auth.mjs';
export async function getArenaUser(){return readUser(new Request('http://arena.internal',{headers:await headers()}));}
