import {redirect} from 'next/navigation';
export type ChatGPTUser={displayName:string;email:string;fullName:string|null};
// Sites-injected identity headers are untrusted on a public Render service.
export async function getChatGPTUser():Promise<ChatGPTUser|null>{return null;}
export async function requireChatGPTUser(_returnTo:string):Promise<ChatGPTUser>{redirect('/login');}
export function chatGPTSignInPath(_returnTo:string){return '/login';}
export function chatGPTSignOutPath(_returnTo='/'){return '/login';}
