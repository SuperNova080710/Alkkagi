import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import {
  OmokRoomPanel, OmokMatchPanel, OmokChatPanel, type OmokParticipant,
} from '../src/components/omok/omok-match-panels';

const me: OmokParticipant = { id: 'me', nickname: '긴 닉네임 사용자', stone: 'black' };
const other: OmokParticipant = { id: 'other', nickname: '두 번째 참가자', stone: 'white' };
const board = Array.from({ length: 15 }, () => Array<null>(15).fill(null));
const room = (players: OmokParticipant[]) => renderToStaticMarkup(
  <OmokRoomPanel code="ABCD12" players={players} hostId="me"
    currentUserId="me" onStart={() => {}} onLeave={() => {}} />,
);

const match = (props: Partial<Parameters<typeof OmokMatchPanel>[0]> = {}) => renderToStaticMarkup(
  <OmokMatchPanel board={board} players={[me, other]} currentUserId="me"
    turnUserId="me" status="active" onPlace={() => {}} onForfeit={() => {}}
    onRematch={() => {}} onReturn={() => {}} {...props}/>,
);

describe('Omok pre-integration presentation panels (#254)', () => {
  it('shows host waiting room, copyable code, empty seat and disables start until full', () => {
    const html = room([me]);
    expect(html).toContain('오목 대기실');
    expect(html).toContain('ABCD12');
    expect(html).toContain('참가자 <span>1/2</span>');
    expect(html).toContain('친구 기다리는 중');
    expect(html).toContain('arena-room-seats');
    expect(html).toContain('arena-omok-waiting');
    expect(html).not.toContain('class="arena-waiting--v2 arena-omok-waiting"');
    expect(html).toContain('arena-invite');
    expect(html).toContain('arena-button arena-button--gold');
    expect(html).toContain('선공 · 흑돌');
    expect(html).toContain('후공 · 백돌');
    expect(html).toMatch(/disabled=""[^>]*>경기 시작/);
    expect(html).toContain('방 닫기');
    expect(html).not.toContain('href="/omok/rooms/');
  });

  it('shows both players and lets host propose start with ready room', () => {
    const html = room([me, other]);
    expect(html).toContain('참가자 <span>2/2</span>');
    expect(html).toContain('두 번째 참가자');
    expect(html).toContain('두 명이 모였습니다');
    const reverse = room([other, me]);
    const firstSeat = reverse.indexOf('선공 · 흑돌');
    const meName = reverse.indexOf('긴 닉네임 사용자', firstSeat);
    const secondSeat = reverse.indexOf('후공 · 백돌');
    expect(firstSeat).toBeGreaterThan(-1);
    expect(meName).toBeGreaterThan(firstSeat);
    expect(meName).toBeLessThan(secondSeat);
    expect(reverse.indexOf('두 번째 참가자', secondSeat)).toBeGreaterThan(secondSeat);
    expect(html).not.toMatch(/disabled=""[^>]*>경기 시작/);
    const guest = renderToStaticMarkup(<OmokRoomPanel code="ABCD12"
      players={[me, other]} hostId="me" currentUserId="other" onLeave={() => {}}/>);
    expect(guest).toContain('방장의 경기 시작을 기다리고 있습니다');
    expect(guest).not.toContain('>경기 시작</button>');
    expect(guest).toContain('방 나가기');
  });

  it('shares the Alkkagi invitation column without breaking the Omok host callback', () => {
    const html = renderToStaticMarkup(<OmokRoomPanel code="ABCD12" players={[me]}
      hostId="me" currentUserId="me" onStart={() => {}} onLeave={() => {}}
      invitePanel={<section>오목 친구 초대</section>}/>);
    expect(html).toContain('arena-room-side');
    expect(html).toContain('오목 친구 초대');
    const css = readFileSync(new URL('../src/components/omok/omok-waiting-parity.css', import.meta.url), 'utf8');
    expect(css).toContain('arena-omok-waiting');
    expect(css).toContain('min-height:44px');
    expect(css).not.toMatch(/body\s*\{[^}]*overflow:\s*hidden/);
  });

  it('never computes a winner or changes the board; renders only supplied server state', () => {
    const active = match();
    expect(active).toContain('내 차례');
    expect(active.match(/role="gridcell"/g)).toHaveLength(225);
    expect(active).toContain('차례입니다. 빈 교차점에 착수해 주세요.');
    const opponentTurn = match({ turnUserId: 'other' });
    expect(opponentTurn).toContain('상대 차례');
    expect(opponentTurn).toContain('두 번째 참가자님의 착수를 기다리고 있습니다.');
    expect(opponentTurn.match(/aria-disabled="true"/g)).toHaveLength(225);
    const finished = match({ status: 'finished', winnerId: 'other', finishReason: '5목', rematchReadyCount: 1 });
    expect(finished).toContain('대국 종료 · 패배 · 5목');
    expect(finished).toContain('재대결 동의 1/2');
    expect(finished).toContain('재대결 신청');
    expect(finished).not.toContain('>기권</button>');
  });

  it('blocks proposals while reconnecting or pending and reports server errors', () => {
    const html = match({ reconnecting: true, error: '서버 상태를 다시 불러오고 있습니다.' });
    expect(html).toContain('연결 복구 중');
    expect(html).toContain('role="alert"');
    expect(html.match(/aria-disabled="true"/g)).toHaveLength(225);
    expect(html).toMatch(/disabled=""[^>]*>기권/);
    expect(match({ pending: true })).toContain('서버 응답을 확인 중입니다.');
  });

  it('uses a restrained chat UI with no fake network calls and 280-character guard', () => {
    const html = renderToStaticMarkup(<OmokChatPanel currentUserId="me"
      messages={[{ id: '1', senderId: 'me', senderName: '나', body: '안녕하세요' },
        { id: '2', senderId: 'other', senderName: '친구', body: '반갑습니다' }]}
      onSend={async () => true}/>);
    expect(html).toContain('안녕하세요');
    expect(html).toContain('반갑습니다');
    // React SSR may preserve JSX attribute casing; HTML attributes are case-insensitive.
    expect(html.toLowerCase()).toContain('maxlength="280"');
    expect(html).toContain('Enter 전송 · Shift+Enter 줄바꿈');
    expect(html).toContain('aria-label="채팅 메시지"');
    const source = readFileSync(new URL('../src/components/omok/omok-match-panels.tsx', import.meta.url), 'utf8');
    expect(source).toContain('event.nativeEvent.isComposing');
    expect(source).toContain('event.repeat');
    expect(source).toContain('event.currentTarget.form?.requestSubmit()');
    expect(source).toContain('if (await onSend(body))');
    expect(source).not.toContain('fetch(');
    expect(source).not.toContain('createBrowserClient');
  });

  it('keeps UI stylesheet independent, without editing gameplay or global scrolling', () => {
    const css = readFileSync(new URL('../src/components/omok/omok-match-panels.css', import.meta.url), 'utf8');
    expect(css).toContain('grid-template-columns: minmax(0, 1fr)');
    expect(css).toContain('max-width: 420px');
    expect(css).toContain('min-width: 0');
    expect(css).toContain('min-height: 44px');
    expect(css).not.toMatch(/body\s*\{[^}]*overflow:\s*hidden/);
    const source = readFileSync(new URL('../src/components/omok/omok-match-panels.tsx', import.meta.url), 'utf8');
    expect(source).toContain("import { OmokBoardView");
    expect(source).toContain("import './omok-match-panels.css'");
    expect(source).not.toContain('calculateWinner');
  });
});
