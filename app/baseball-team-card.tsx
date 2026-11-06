import Link from 'next/link';
import type {ReactNode} from 'react';

type BaseballTeamCardProps = {
  league: 'mlb' | 'npb';
  code: number | string;
  href: string;
  name: string;
  logo: ReactNode;
  record?: string;
};

export default function BaseballTeamCard({league, code, href, name, logo, record}: BaseballTeamCardProps) {
  return (
    <Link href={href} prefetch={false} className="panel baseball-team-card">
      <div className="baseball-team-card-copy">
        <div className="baseball-team-card-identity">
          {logo}
          <strong>{name}</strong>
        </div>
        {record && <span className="baseball-team-card-record">{record}</span>}
        <small>查看球隊資料 →</small>
      </div>
      <img className="baseball-team-character" src={`/team-characters/${league}/${code}.webp`}
        width={256} height={256} alt="" loading="lazy" decoding="async" />
    </Link>
  );
}
