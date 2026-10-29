import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LobbyView, type LobbyData } from '../src/components/lobby/lobby-view';
const data: LobbyData = { nickname: '테스트', rating: null, leaderboard: [], rankingUnavailable: true, activeAi: [], activeCasual: [], recoveryUnavailable: true };
describe('lobby data states', () => {
 it('does not disguise failed queries as empty games or an invented rating', () => {
  const html = renderToStaticMarkup(<LobbyView data={data} modes={null} />);
  expect(html).toContain('불러오지 못했습니다');
  expect(html).not.toContain('진행 중인 경기가 없어요');
  expect(html).not.toContain('1,000 RP');
  expect(html).not.toContain('아직 등록된 순위가 없어요');
 });
 it('preserves both recovery destinations and displays only supplied leaderboard values', () => {
  const html = renderToStaticMarkup(<LobbyView data={{...data, rating: 1056, rankingUnavailable: false, recoveryUnavailable: false, leaderboard:[{position:1,nickname:'실제응답',rating:1098}],activeAi:[{room_id:'ai-room'}],activeCasual:[{id:'match',room_id:'human-room'}]}} modes={null} />);
  expect(html).toContain('href="/rooms/ai-room/ai"');
  expect(html).toContain('href="/rooms/human-room"');
  expect(html).toContain('1,056 RP');
  expect(html).toContain('실제응답');
 });
});
