import Link from 'next/link';
import TeamsDirectory from '../teams-directory';
export default function TeamsPage(){return <main className="arena-shell min-h-screen"><header className="team-page-nav"><Link href="/">← 賽前分析・串關</Link><span>MLB 美國職棒</span></header><div className="team-page-container"><TeamsDirectory/></div></main>;}
