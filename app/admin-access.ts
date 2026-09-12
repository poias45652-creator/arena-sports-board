import { getChatGPTUser } from './chatgpt-auth';

// Explicit owner allowlist, checked on the server using dispatch-authenticated identity.
const OWNER_EMAIL = 'poias45652@gmail.com';
export async function isSiteAdmin() {
  const user = await getChatGPTUser();
  return user?.email.toLowerCase() === OWNER_EMAIL;
}
