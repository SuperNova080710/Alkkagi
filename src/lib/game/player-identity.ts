import { type Board } from './engine';

export type DisplayPlayer = {
 id: string;
 nickname: string;
 seat: 1 | 2;
 colorName: '주황색' | '파란색';
 startSide: '왼쪽' | '오른쪽';
 color: string;
 isMe: boolean;
 isTurn: boolean;
 remaining: number;
};
export type IdentityMatch = {
 player1_id: string;
 player2_id: string;
 turn_user_id: string;
 winner_id: string | null;
 status: string;
};

export function getPlayerIdentities(
 match: IdentityMatch,
 viewerId: string,
 players: { seat: number; nickname: string }[],
 board: Board,
): [DisplayPlayer, DisplayPlayer] {
 const slots = [
  { id: match.player1_id, seat: 1 as const, colorName: '주황색' as const, startSide: '왼쪽' as const, color: '#f59e0b' },
  { id: match.player2_id, seat: 2 as const, colorName: '파란색' as const, startSide: '오른쪽' as const, color: '#60a5fa' },
 ];
 return slots.map(slot => ({
  ...slot,
  nickname: players.find(player => player.seat === slot.seat)?.nickname || (slot.seat === 1 ? '선공' : '후공'),
  isMe: slot.id === viewerId,
  isTurn: match.status === 'active' && slot.id === match.turn_user_id,
  remaining: board.pieces.filter(piece => piece.owner === slot.id).length,
 })) as [DisplayPlayer, DisplayPlayer];
}
export function getTurnMessage(
 match: IdentityMatch,
 viewerId: string,
 players: [DisplayPlayer, DisplayPlayer],
 phase: { animating: boolean; pending: boolean; remaining: number | null },
): string {
 if (match.status === 'finished') {
  return match.winner_id === null ? '경기 종료 · 무승부입니다.' :
   match.winner_id === viewerId ? '경기 종료 · 내가 승리했습니다!' : '경기 종료 · 상대가 승리했습니다.';
 }
 const current = players.find(player => player.id === match.turn_user_id);
 const owner = match.turn_user_id === viewerId ? '내' : '상대';
 const identity = current ? current.colorName + ' 알' : '알';
 if (phase.animating) return '알 이동 중 · 다음 차례는 ' + owner + ' 턴 (' + identity + ')';
 if (phase.pending) return '발사 처리 중 · 서버 판정을 기다리고 있습니다.';
 if (phase.remaining === 0) return '제한 시간 종료 · 서버 결과 확인 중';
 if (owner === '내') return '내 턴! ' + identity + '을 뒤로 드래그해 발사하세요.';
 return '상대 턴 · ' + (current?.nickname ?? '상대') + '님이 ' + identity + '을 발사할 차례입니다.';
}
