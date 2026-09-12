import LoginForm from './form';
import './login.css';
export const dynamic='force-dynamic';
export default function LoginPage(){return <div className="yj-login"><video className="yj-login-video" autoPlay muted loop playsInline aria-hidden="true"><source src="/0912-bg.mp4" type="video/mp4"/></video><div className="yj-login-shade" aria-hidden="true"/><main className="relative z-10 min-h-screen flex items-center justify-center px-5 py-12"><section className="panel w-full max-w-md bg-[#0e1b2a]/90 p-7 backdrop-blur-sm"><div className="mb-7 flex items-center gap-3 text-2xl font-black text-[#ffd538]"><img src="/yj-logo.png" alt="YJ" width={40} height={40} className="size-10 object-contain"/>YJ體育分析</div><LoginForm/></section></main></div>;}
