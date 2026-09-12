import {requireChatGPTUser} from './chatgpt-auth';
import Home from './home';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const user = await requireChatGPTUser('/');
  return <Home isAdmin={user.role === 'admin'}/>;
}
