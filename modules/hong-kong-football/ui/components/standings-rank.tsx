export default function StandingsRank({rank, played}: {rank: number | string | null | undefined; played: boolean}) {
  const champion = rank === '優勝';
  const place = champion ? 1 : rank;
  return <span className="standings-rank" data-place={played ? place : undefined} title={champion ? '聯盟冠軍' : undefined}>
    {champion ? '冠' : (rank ?? '—')}
  </span>;
}
