'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { useCallback, useEffect, useRef, useState } from 'react';
import { OmokRoomPanel } from './omok-match-panels';
import './omok-live.css';
import { isRecord, isUuid, omokErrorText, omokRequest, parseRoom, type RoomSnapshot } from './omok-client-api';

type Friend = { id: string; nickname: string };
function safeFriends(raw: unknown): Friend[] {
  if (!isRecord(raw) || !Array.isArray(raw.friends)) return [];
  return raw.friends.filter(isRecord).filter(f => isUuid(f.id) && typeof f.nickname === 'string')
    .map(f => ({ id: f.id as string, nickname: f.nickname as string }));
}
function OmokFriendInvitePicker({ roomId }: { roomId: string }) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [targetId, setTargetId] = useState('');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const lock = useRef(false);
  const load = useCallback(async () => {
    try {
      const data = await omokRequest<unknown>('/api/friends');
      setFriends(safeFriends(data)); setError('');
    } catch (e) { setError(omokErrorText(e)); }
  }, []);
  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);
  async function send() {
    if (lock.current || !friends.some(f => f.id === targetId)) return;
    lock.current = true; setPending(true); setError(''); setFeedback('');
    try {
      const result = await omokRequest<unknown>('/api/omok/invites', {
        method: 'POST', body: { roomId, targetId },
      });
      setFeedback(isRecord(result) && result.alreadyPending
        ? '이미 발송한 초대가 있습니다.' : '친구에게 오목 초대를 보냈습니다. 5분 안에 수락할 수 있습니다.');
    } catch (e) { setError(omokErrorText(e)); }
    finally { lock.current = false; setPending(false); }
  }
  return <section className="arena-omok-live-panel" aria-label="오목 친구 초대">
    <h3>친구 초대</h3>
    <p className="arena-omok-panel-hint">친구가 수락하면 두 번째 자리에 자동으로 입장합니다.</p>
    <div className="arena-omok-live-actions">
      <label htmlFor="omok-invite-friend">초대할 친구</label>
      <select id="omok-invite-friend" value={targetId} onChange={e => setTargetId(e.target.value)}>
        <option value="">친구 선택</option>
        {friends.map(friend => <option value={friend.id} key={friend.id}>{friend.nickname}</option>)}
      </select>
      <button type="button" className="arena-button" onClick={() => void send()}
        disabled={pending || !friends.some(f => f.id === targetId)}>
        {pending ? '전송 중…' : '초대 보내기'}
      </button>
      <button type="button" className="arena-button arena-button--outline"
        onClick={() => void load()}>친구 목록 새로고침</button>
    </div>
    {friends.length === 0 && !error && <p className="arena-omok-panel-hint">초대할 친구가 없습니다. 먼저 친구 관계를 맺어 주세요.</p>}
    {feedback && <p role="status">{feedback}</p>}
    {error && <p role="alert" className="arena-omok-live-error">{error}</p>}
  </section>;
}

export function OmokCasualRoomClient({ roomId, currentUserId }: {
  roomId: string; currentUserId: string;
}) {
  const router = useRouter();
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const lock = useRef(false);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const serial = ++sequence.current;
    try {
      const data = await omokRequest<unknown>('/api/omok/rooms/' + roomId);
      const next = parseRoom(data);
      if (serial !== sequence.current) return;
      setRoom(next); setError('');
      if (next.matchId && next.status === 'playing')
        router.replace('/omok/matches/' + next.matchId);
    } catch (cause) {
      if (serial === sequence.current) setError(omokErrorText(cause));
    } finally {
      if (serial === sequence.current) setLoading(false);
    }
  }, [roomId, router]);
  useEffect(() => {
    const sequenceRef = sequence;
    queueMicrotask(() => { void reload(); });
    const poll = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, 4000);
    const focus = () => void reload();
    window.addEventListener('focus', focus);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const client = url && key ? createBrowserClient(url, key) : null;
    const channel = client?.channel('omok-room:' + roomId)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'omok_rooms', filter: 'id=eq.' + roomId,
      }, () => { void reload(); })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'omok_room_players', filter: 'room_id=eq.' + roomId,
      }, () => { void reload(); })
      .subscribe();
    return () => {
      sequenceRef.current++;
      window.clearInterval(poll);
      window.removeEventListener('focus', focus);
      if (client && channel) void client.removeChannel(channel);
    };
  }, [roomId, reload]);

  async function action(endpoint: 'start' | 'leave') {
    if (lock.current) return;
    if (endpoint === 'leave' && !window.confirm('오목 대기실에서 나가시겠습니까? 방장은 방을 닫게 됩니다.')) return;
    lock.current = true; setPending(true); setError('');
    try {
      const data = await omokRequest<unknown>('/api/omok/rooms/' + roomId + '/' + endpoint, { method: 'POST' });
      if (endpoint === 'leave') router.replace('/omok');
      else if (isRecord(data) && isUuid(data.matchId)) router.replace('/omok/matches/' + data.matchId);
      else await reload();
    } catch (e) { setError(omokErrorText(e)); await reload(); }
    finally { lock.current = false; setPending(false); }
  }
  if (loading && !room) return <p role="status" className="arena-omok-live-panel">오목 대기실을 불러오는 중…</p>;
  if (!room) return <section className="arena-omok-live-panel">
    <p role="alert" className="arena-omok-live-error">{error || '대기실 정보를 확인할 수 없습니다.'}</p>
    <button type="button" className="arena-button" onClick={() => void reload()}>다시 조회</button>
    <Link href="/omok" className="arena-button arena-button--outline">오목 로비</Link>
  </section>;
  const host = room.players.find(p => p.seat === 1)?.userId ?? '';
  return <>
    <OmokRoomPanel code={room.code}
      players={room.players.map(p => ({ id: p.userId, nickname: p.nickname,
        stone: p.seat === 1 ? 'black' : 'white' }))}
      hostId={host} currentUserId={currentUserId} pending={pending} error={error}
      onStart={room.status === 'waiting' ? () => void action('start') : undefined}
      onLeave={room.status === 'waiting' ? () => void action('leave') : undefined}
      invitePanel={room.status === 'waiting' && room.players.length === 1 &&
        host === currentUserId ? <OmokFriendInvitePicker roomId={roomId}/> : undefined}/>
    {room.status !== 'waiting' && <div role="status" className="arena-omok-live-panel">
      대기실이 종료되었거나 이미 경기가 시작되었습니다.
      <button type="button" className="arena-button" onClick={() => void reload()}>상태 확인</button>
    </div>}
  </>;
}
