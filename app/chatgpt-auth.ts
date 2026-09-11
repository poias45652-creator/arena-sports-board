import {redirect} from 'next/navigation';
import {getArenaUser} from '@/lib/arena-user';
export const getChatGPTUser=getArenaUser;
export async function requireChatGPTUser(returnTo:string){const user=await getArenaUser();if(user)return user;redirect(chatGPTSignInPath(returnTo));}
function safe(value:string){try{const u=new URL(value,'https://arena.internal');return u.origin==='https://arena.internal'&&!['/login','/signin-with-chatgpt','/signout-with-chatgpt'].includes(u.pathname)?u.pathname+u.search+u.hash:'/';}catch{return '/';}}
export function chatGPTSignInPath(returnTo='/'){return '/login?return_to='+encodeURIComponent(safe(returnTo));}
export function chatGPTSignOutPath(returnTo='/'){return '/signout-with-chatgpt?return_to='+encodeURIComponent(safe(returnTo));}
