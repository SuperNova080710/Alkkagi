import Link from 'next/link';

const games = [
  { id: 'omok', name: '오목', english: 'OMOK', href: '/omok', flag: 'OMOK_UI_ENABLED',
    description: '흑돌과 백돌을 번갈아 놓아 다섯 돌을 이으세요.' },
  { id: 'chess', name: '체스', english: 'CHESS', href: '/chess', flag: 'CHESS_UI_ENABLED',
    description: '기물마다 다른 움직임으로 상대 왕을 체크메이트하세요.' },
  { id: 'alkkagi', name: '알까기', english: 'ALKKAGI', href: '/lobby', flag: null,
    description: '방향과 힘을 조절해 상대의 알을 보드 밖으로 밀어내세요.' },
] as const;

export function HomeGameSelection() {
  return <>
    <section className="arena-platform-hero" aria-labelledby="platform-heading">
      <div className="arena-platform-copy">
        <p>설치 없이, 브라우저에서</p>
        <h1 id="platform-heading">한판아레나</h1>
        <p>오목, 체스, 알까기. 오늘의 한 판을 골라보세요.</p>
      </div>
      <div className="arena-platform-emblems" aria-hidden="true">
        <span className="arena-emblem--omok"><i /></span>
        <span className="arena-emblem--chess">♞</span>
        <span className="arena-emblem--alkkagi"><i /></span>
      </div>
    </section>
    <section id="games" className="arena-platform-games" aria-labelledby="platform-games-heading">
      <h2 id="platform-games-heading">게임 선택</h2>
      <ul className="arena-platform-grid">
        {games.map(({ id, name, english, href, flag, description }) => {
          const available = flag === null || process.env[flag] === 'true';
          return <li key={id}>
            <article className="arena-platform-card" aria-labelledby={`game-${id}`}>
              <div className={`arena-platform-art arena-platform-art--${id}`} aria-hidden="true">
                <span>{english}</span>
                {id === 'chess' ? <b>♞</b> : <><i /><i /><i /></>}
              </div>
              <div className="arena-platform-details">
                <h3 id={`game-${id}`}>{name}</h3>
                <p>{description}</p>
                {available
                  ? <Link href={href} className="arena-button">{name} 시작하기 <span aria-hidden="true">›</span></Link>
                  : <p className="arena-platform-unavailable">현재 이용할 수 없습니다</p>}
              </div>
            </article>
          </li>;
        })}
      </ul>
    </section>
  </>;
}
