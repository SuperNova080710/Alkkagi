type Props = {
  black: boolean;
  myTurn: boolean;
  finished: boolean;
  inCheck: boolean;
  ai?: boolean;
  pending?: boolean;
  error?: boolean;
  confirming?: boolean;
};

export function ChessTurnStatus({black, myTurn, finished, inCheck, ai, pending, error, confirming}: Props) {
  const state = finished ? 'finished' : error ? 'error' : pending ? 'pending'
    : confirming ? 'confirming' : myTurn ? 'mine' : 'opponent';
  const title = {
    finished: '대국 종료', error: ai ? 'AI 응수를 다시 시도해 주세요' : '연결 확인이 필요합니다', pending: '이동을 확인하고 있습니다',
    confirming: '기권을 확인하고 있습니다', mine: '내 차례입니다',
    opponent: ai ? 'AI가 생각 중입니다' : '상대 차례입니다',
  }[state];
  const detail = {
    finished: '결과와 기보를 확인하세요.',
    error: ai ? 'AI 다시 시도 버튼을 눌러 대전을 이어가세요.' : '최신 대국 정보를 확인할 때까지 기다려 주세요.',
    pending: '서버에서 처리 중입니다. 잠시 기다려 주세요.', confirming: '기권을 확정하거나 취소해 주세요.',
    mine: inCheck ? '체크! 킹을 지키는 수를 두세요.' : '내 기물을 선택한 뒤 이동할 칸을 누르세요.',
    opponent: inCheck ? '상대 킹이 체크 상태입니다.' : '상대가 수를 두면 내 차례로 바뀝니다.',
  }[state];
  return <div className="chess-turn-status" data-state={state}>
    <div className="chess-turn-message" role="status" aria-live="polite" aria-atomic="true">
      <span className="chess-turn-icon" aria-hidden="true">{finished ? '⚑' : inCheck ? '♚' : myTurn ? '♟' : '◷'}</span>
      <div><strong>{title}{inCheck && !finished ? ' · 체크' : ''}</strong><p>{detail}</p></div>
    </div>
    <div className="chess-turn-players" aria-label="기물과 현재 차례">
      <span data-active={state === 'mine' || undefined}>
        <i className={'chess-piece--' + (black ? 'b' : 'w')} aria-hidden="true">♟</i>
        나 · {black ? '흑' : '백'}{state === 'mine' ? ' · 착수' : ''}
      </span>
      <span data-active={state === 'opponent' || undefined}>
        <i className={'chess-piece--' + (black ? 'w' : 'b')} aria-hidden="true">♟</i>
        {ai ? 'AI' : '상대'} · {black ? '백' : '흑'}{state === 'opponent' ? ' · 착수' : ''}
      </span>
    </div>
  </div>;
}
